import crypto from 'crypto';
import { sanitizeFilename } from './fileSecurity.js';

export const MAX_BROWSER_MB = Number(process.env.MAX_BROWSER_MB || 100);
export const MAX_WORKER_MB = Number(process.env.MAX_WORKER_MB || 500);
export const FILE_TTL_HOURS = Number(process.env.FILE_TTL_HOURS || 24);
export const SIGNED_URL_TTL_SECONDS = Math.min(900, Math.max(60, Number(process.env.SIGNED_URL_TTL_SECONDS || 300)));

export function generateOwnerToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function hashOwnerToken(token: string): string {
  const secret = process.env.STORAGE_TOKEN_SECRET || 'linktwin-default-token-salt';
  return crypto.createHmac('sha256', secret).update(token, 'utf8').digest('hex');
}

export function verifyOwnerToken(providedToken: string | undefined, expectedHash: string | null): boolean {
  if (!providedToken || !expectedHash) return false;
  const providedHash = hashOwnerToken(providedToken);
  const a = Buffer.from(providedHash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

interface S3Config {
  bucket: string;
  region: string;
  endpoint: string; // e.g. https://<account>.r2.cloudflarestorage.com or https://s3.us-east-1.amazonaws.com
  accessKeyId: string;
  secretAccessKey: string;
}

function getS3Config(): S3Config | null {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) return null;

  const region = process.env.S3_REGION || 'auto';
  const endpoint =
    process.env.S3_ENDPOINT || `https://s3.${region}.amazonaws.com`;

  return {
    bucket,
    region,
    endpoint: endpoint.replace(/\/+$/, ''),
    accessKeyId,
    secretAccessKey,
  };
}

export function isObjectStorageConfigured(): boolean {
  return getS3Config() !== null;
}

export function buildStorageKey(jobId: string, filename: string, folder: 'uploads' | 'outputs'): string {
  const safe = sanitizeFilename(filename);
  return `linktwin/${folder}/${jobId}/${safe}`;
}

export function getExpirationIso(hours = FILE_TTL_HOURS): string {
  const d = new Date(Date.now() + hours * 3600 * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function encodeRfc3986(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

/**
 * Generates an AWS Signature Version 4 presigned URL for S3 / Cloudflare R2 / MinIO
 * without requiring heavy external AWS SDK dependencies.
 */
export function createPresignedS3Url(
  method: 'PUT' | 'GET' | 'DELETE',
  storageKey: string,
  expiresSeconds = 900
): string | null {
  const cfg = getS3Config();
  if (!cfg) return null;

  const endpointUrl = new URL(cfg.endpoint);
  const host = endpointUrl.host;
  const keyPath = storageKey
    .split('/')
    .map((s) => encodeRfc3986(s))
    .join('/');
  const canonicalUri = `/${encodeRfc3986(cfg.bucket)}/${keyPath}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${cfg.region}/s3/aws4_request`;

  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${cfg.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': 'host',
  };

  const canonicalQueryString = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(queryParams[k])}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmacSha256(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, cfg.region);
  const kService = hmacSha256(kRegion, 's3');
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return `${cfg.endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

export async function deleteObjectFromStorage(storageKey: string | null): Promise<boolean> {
  if (!storageKey) return false;
  const deleteUrl = createPresignedS3Url('DELETE', storageKey, 120);
  if (!deleteUrl) return false;

  try {
    const res = await fetch(deleteUrl, { method: 'DELETE' });
    return res.ok || res.status === 404;
  } catch (err) {
    console.error('❌ [Storage Cleanup Error]:', err);
    return false;
  }
}
