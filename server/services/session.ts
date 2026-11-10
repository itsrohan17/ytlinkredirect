import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

export const SESSION_COOKIE_NAME = 'lt_session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const MIN_PRODUCTION_SECRET_LENGTH = 32;

const TOKEN_FORMAT_REGEX = /^[a-f0-9]{48,64}$/;
const LOCAL_DEV_ONLY_SESSION_KEY = 'linktwin-local-dev-only-session-key';

let loggedDevSecretWarning = false;

export class SessionConfigError extends Error {
  status = 503;
  constructor(message: string) {
    super(message);
    this.name = 'SessionConfigError';
  }
}

export function handleSessionRouteError(
  res: Response,
  err: unknown,
  logPrefix: string,
  fallbackMessage: string
) {
  if (err instanceof SessionConfigError) {
    console.error(`❌ [Configuration Error] ${err.message}`);
    return res.status(err.status).json({ error: err.message });
  }
  console.error(`❌ [${logPrefix}]:`, err);
  return res.status(500).json({ error: fallbackMessage });
}

export function isProductionSessionEnvironment(): boolean {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
}

export function isSessionSecretConfigured(): boolean {
  const secret = (process.env.SESSION_SECRET || '').trim();
  return secret.length >= MIN_PRODUCTION_SECRET_LENGTH;
}

export function requireSessionSigningSecret(): string {
  const configured = (process.env.SESSION_SECRET || '').trim();
  if (configured.length >= MIN_PRODUCTION_SECRET_LENGTH) {
    return configured;
  }

  if (isProductionSessionEnvironment()) {
    throw new SessionConfigError(
      'Server configuration error: SESSION_SECRET must be configured with at least 32 characters in production.'
    );
  }

  if (!loggedDevSecretWarning) {
    loggedDevSecretWarning = true;
    console.warn(
      '⚠️ [Session] SESSION_SECRET not set. Using local development session key (not permitted in production).'
    );
  }
  return configured || LOCAL_DEV_ONLY_SESSION_KEY;
}

export function generateSessionToken(): string {
  // 256-bit cryptographically random session token (64 hex chars)
  return crypto.randomBytes(32).toString('hex');
}

export function hashSessionTokenWithSecret(token: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`linktwin-session:${token}`).digest('hex');
}

export function hashSessionToken(token: string): string {
  const secret = requireSessionSigningSecret();
  return hashSessionTokenWithSecret(token, secret);
}

/**
 * Computes hashes accepted for backward compatibility with:
 * - Optional `SESSION_SECRET_PREVIOUS` during key rotation
 * - Legacy Phase 5 raw SHA-256 (`c69a452`)
 * - Legacy Phase 5.1 domain-separated SHA-256 fallback
 */
export function getCompatibleLegacyHashes(token: string, primaryHash: string): string[] {
  const candidates = new Set<string>();

  const previousSecret = (process.env.SESSION_SECRET_PREVIOUS || '').trim();
  if (previousSecret.length >= 16) {
    candidates.add(hashSessionTokenWithSecret(token, previousSecret));
  }

  // Exact Phase 5 (commit c69a452) token hash
  candidates.add(crypto.createHash('sha256').update(token).digest('hex'));

  // Exact Phase 5.1 non-HMAC domain fallback hash
  candidates.add(crypto.createHash('sha256').update(`linktwin-session:${token}`).digest('hex'));

  candidates.delete(primaryHash);
  return Array.from(candidates);
}

export interface SessionLookupHashes {
  primaryHash: string;
  compatHashes: string[];
}

export function extractSessionToken(req: Request): string {
  const cookieHeader = String(req.headers.cookie || '');
  const prefix = `${SESSION_COOKIE_NAME}=`;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      const candidate = trimmed.slice(prefix.length).trim();
      if (TOKEN_FORMAT_REGEX.test(candidate)) {
        return candidate;
      }
      return '';
    }
  }
  return '';
}

export function getSessionLookupHashes(req: Request): SessionLookupHashes | null {
  const token = extractSessionToken(req);
  if (!token) {
    // Still enforce production SESSION_SECRET presence even on missing cookie?
    // Wait: unauthenticated requests cleanly receive 401 when missing cookie, while
    // authenticated/creating requests enforce requireSessionSigningSecret() -> 503 if misconfigured.
    return null;
  }
  const primaryHash = hashSessionToken(token);
  const compatHashes = getCompatibleLegacyHashes(token, primaryHash);
  return { primaryHash, compatHashes };
}

export function getCallerSessionHash(req: Request): string | null {
  const token = extractSessionToken(req);
  if (!token) return null;
  return hashSessionToken(token);
}

export function safeEqualHash(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function isHashAuthorizedForSession(
  storedHash: string | null | undefined,
  lookup: SessionLookupHashes
): boolean {
  if (!storedHash) return false;
  if (safeEqualHash(storedHash, lookup.primaryHash)) return true;
  return lookup.compatHashes.some((h) => safeEqualHash(storedHash, h));
}

export function isHttpsRequest(req: Request): boolean {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') return true;
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.split(',')[0].trim().toLowerCase() === 'https') {
    return true;
  }
  return false;
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  const secureFlag = isHttpsRequest(req) ? '; Secure' : '';
  const cookieValue = `${SESSION_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${secureFlag}`;
  res.append('Set-Cookie', cookieValue);
}

export function getAllowedOrigins(req?: Request): Set<string> {
  const allowed = new Set<string>();
  if (process.env.BASE_URL) {
    try {
      allowed.add(new URL(process.env.BASE_URL).origin.toLowerCase());
    } catch {}
  }
  if (process.env.VERCEL_URL) {
    allowed.add(`https://${process.env.VERCEL_URL}`.toLowerCase());
  }
  if (req) {
    const rawHost = req.headers['x-forwarded-host'] || req.get('host');
    const host = Array.isArray(rawHost) ? rawHost[0] : rawHost;
    if (host) {
      allowed.add(`http://${host}`.toLowerCase());
      allowed.add(`https://${host}`.toLowerCase());
    }
  }
  return allowed;
}

/**
 * CSRF protection for state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`).
 * Rejects cross-site requests indicated by `Sec-Fetch-Site` or mismatched `Origin` / `Referer`.
 */
export function enforceSameOriginOnMutations(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  const fetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  if (fetchSite === 'cross-site') {
    res.status(403).json({ error: 'Cross-site state-changing request rejected by CSRF policy.' });
    return;
  }

  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;
  const allowedOrigins = getAllowedOrigins(req);

  if (typeof originHeader === 'string' && originHeader.trim()) {
    const normalizedOrigin = originHeader.trim().toLowerCase();
    if (normalizedOrigin === 'null' || !allowedOrigins.has(normalizedOrigin)) {
      res.status(403).json({ error: 'Invalid request origin for mutating operation.' });
      return;
    }
  } else if (typeof refererHeader === 'string' && refererHeader.trim()) {
    try {
      const refOrigin = new URL(refererHeader).origin.toLowerCase();
      if (!allowedOrigins.has(refOrigin)) {
        res.status(403).json({ error: 'Invalid referer origin for mutating operation.' });
        return;
      }
    } catch {
      res.status(403).json({ error: 'Malformed referer header.' });
      return;
    }
  }

  next();
}
