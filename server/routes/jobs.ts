import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import {
  createMediaJob,
  findActiveJobByDedupeKey,
  getMediaJobById,
  getRecentMediaJobs,
  getStorageUsageSummary,
  markMediaJobExpired,
} from '../db.js';
import {
  isAllowedMimeForCategory,
  sanitizeFilename,
  verifyMagicBytes,
} from '../services/fileSecurity.js';
import {
  buildStorageKey,
  createPresignedS3Url,
  deleteObjectFromStorage,
  generateOwnerToken,
  getExpirationIso,
  hashOwnerToken,
  isObjectStorageConfigured,
  MAX_BROWSER_MB,
  MAX_WORKER_MB,
  SIGNED_URL_TTL_SECONDS,
  verifyOwnerToken,
} from '../services/storage.js';
import { MediaJobRecord, MediaModule, ProcessingMode } from '../types.js';
import { runCleanupSweep } from '../../worker/mediaWorker.js';

export const jobsRouter = Router();

const VALID_MODULES = new Set<MediaModule>([
  'video-converter',
  'image-studio',
  'thumbnail-studio',
  'audio-studio',
  'file-compressor',
]);

function moduleToCategory(module: MediaModule): 'image' | 'video' | 'audio' | 'pdf' {
  if (module === 'image-studio' || module === 'thumbnail-studio') return 'image';
  if (module === 'audio-studio') return 'audio';
  return 'video';
}

function sanitizeJobForClient(job: MediaJobRecord) {
  return {
    job_id: job.job_id,
    module: job.module,
    processing_mode: job.processing_mode,
    input_filename: job.input_filename,
    input_mime: job.input_mime,
    input_size: job.input_size,
    output_format: job.output_format,
    output_size: job.output_size,
    status: job.status,
    retry_count: job.retry_count,
    max_retries: job.max_retries,
    error_message: job.error_message,
    expires_at: job.expires_at,
    created_at: job.created_at,
    updated_at: job.updated_at,
  };
}

// POST /api/jobs/validate-signature - Validate magic bytes & MIME before processing/uploading
jobsRouter.post('/validate-signature', (req: Request, res: Response) => {
  const { filename, mime, headerHex, category } = req.body || {};
  const cat = String(category || '') as 'image' | 'video' | 'audio' | 'pdf';

  if (!['image', 'video', 'audio', 'pdf'].includes(cat)) {
    return res.status(400).json({ valid: false, error: 'Invalid file category.' });
  }
  if (!mime || !isAllowedMimeForCategory(String(mime), cat)) {
    return res.status(400).json({ valid: false, error: `MIME type "${mime}" is not permitted for ${cat}.` });
  }
  const sig = verifyMagicBytes(String(headerHex || ''), cat);
  if (!sig.valid) {
    return res.status(400).json({ valid: false, error: sig.reason || 'Invalid file signature.' });
  }

  return res.json({
    valid: true,
    sanitizedFilename: sanitizeFilename(String(filename || 'file')),
    detectedFormat: sig.detectedFormat,
  });
});

// GET /api/jobs/summary - Aggregate job & storage telemetry (non-sensitive)
jobsRouter.get('/summary', async (_req: Request, res: Response) => {
  try {
    const objectConfigured = isObjectStorageConfigured();
    const summary = await getStorageUsageSummary(objectConfigured);
    const recent = (await getRecentMediaJobs(10)).map(sanitizeJobForClient);
    return res.json({
      success: true,
      summary,
      recentJobs: recent,
      limits: {
        maxBrowserMb: MAX_BROWSER_MB,
        maxWorkerMb: MAX_WORKER_MB,
        fileTtlHours: Number(process.env.FILE_TTL_HOURS || 24),
        signedUrlTtlSeconds: SIGNED_URL_TTL_SECONDS,
      },
    });
  } catch (err) {
    console.error('❌ [Jobs Summary Error]:', err);
    return res.status(500).json({ error: 'Failed to load media jobs summary.' });
  }
});

// POST /api/jobs - Create a media processing job (browser log or server-worker queue with signed URLs)
jobsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      module,
      processingMode,
      inputFilename,
      inputMime,
      inputSize,
      outputFormat,
      outputSize,
      headerHex,
      category,
      dedupeKey,
    } = req.body || {};

    if (!module || !VALID_MODULES.has(module)) {
      return res.status(400).json({ error: 'Invalid media module.' });
    }

    const mode: ProcessingMode =
      processingMode === 'server-worker' || processingMode === 'browser-canvas'
        ? processingMode
        : 'browser-wasm';

    const sizeBytes = Number(inputSize || 0);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return res.status(400).json({ error: 'Invalid file size.' });
    }

    const maxBytes =
      (mode === 'server-worker' ? MAX_WORKER_MB : MAX_BROWSER_MB) * 1024 * 1024;
    if (sizeBytes > maxBytes) {
      return res.status(413).json({
        error: `File exceeds limit of ${mode === 'server-worker' ? MAX_WORKER_MB : MAX_BROWSER_MB} MB for ${mode}.`,
      });
    }

    const cat = (category || moduleToCategory(module)) as 'image' | 'video' | 'audio' | 'pdf';
    if (!inputMime || !isAllowedMimeForCategory(String(inputMime), cat)) {
      return res.status(400).json({ error: `Unsupported MIME type: ${inputMime}` });
    }

    if (mode === 'server-worker' && !headerHex) {
      return res.status(400).json({ error: 'File signature headerHex is required for worker jobs.' });
    }
    if (headerHex) {
      const sig = verifyMagicBytes(String(headerHex), cat);
      if (!sig.valid) {
        return res.status(400).json({ error: `File signature rejected: ${sig.reason}` });
      }
    }

    // Duplicate-job prevention for server-worker queue
    if (mode === 'server-worker' && dedupeKey && typeof dedupeKey === 'string') {
      const existing = await findActiveJobByDedupeKey(dedupeKey);
      if (existing) {
        return res.status(409).json({
          error: 'An identical processing job is already queued or running.',
          existingJobId: existing.job_id,
          status: existing.status,
        });
      }
    }

    const safeName = sanitizeFilename(String(inputFilename || 'media'));
    const jobId = `job_${nanoid(12)}`;
    const ownerToken = generateOwnerToken();
    const ownerTokenHash = hashOwnerToken(ownerToken);

    let storageKey: string | null = null;
    let signedUploadUrl: string | null = null;

    if (mode === 'server-worker') {
      if (!isObjectStorageConfigured()) {
        return res.status(503).json({
          error:
            'Server worker processing requires S3/R2 Object Storage (S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY). Use browser processing for files under ' +
            MAX_BROWSER_MB +
            ' MB or configure object storage.',
        });
      }
      storageKey = buildStorageKey(jobId, safeName, 'uploads');
      signedUploadUrl = createPresignedS3Url('PUT', storageKey, SIGNED_URL_TTL_SECONDS);
    }

    const record = await createMediaJob({
      jobId,
      module,
      processingMode: mode,
      inputFilename: safeName,
      inputMime: String(inputMime),
      inputSize: sizeBytes,
      outputFormat: String(outputFormat || 'mp4').slice(0, 16),
      outputSize: outputSize !== undefined && outputSize !== null ? Number(outputSize) : null,
      status: mode === 'server-worker' ? 'queued' : 'completed',
      storageKey,
      ownerTokenHash,
      dedupeKey: dedupeKey ? String(dedupeKey).slice(0, 128) : null,
      maxRetries: Number(process.env.WORKER_MAX_RETRIES || 2),
      expiresAt: mode === 'server-worker' ? getExpirationIso() : null,
    });

    const cookieFlags = `HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${process.env.VERCEL ? '; Secure' : ''}`;
    res.setHeader('Set-Cookie', `lt_job_${jobId}=${ownerToken}; ${cookieFlags}`);

    return res.status(201).json({
      success: true,
      job: sanitizeJobForClient(record),
      signedUploadUrl,
      signedUrlExpiresInSeconds: signedUploadUrl ? SIGNED_URL_TTL_SECONDS : null,
    });
  } catch (err: any) {
    console.error('❌ [Create Media Job Error]:', err);
    return res.status(500).json({ error: 'Failed to create media job.' });
  }
});

function extractJobToken(req: Request, jobId: string): string {
  const headerToken = req.headers['x-job-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }
  const cookieHeader = String(req.headers['cookie'] || '');
  const prefix = `lt_job_${jobId}=`;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length).trim();
    }
  }
  return '';
}

// POST /api/jobs/cleanup - Enforces either job owner token (for single job) or configured CRON_SECRET (for global sweep)
jobsRouter.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const jobId = req.body?.jobId ? String(req.body.jobId) : null;
    if (jobId) {
      const job = await getMediaJobById(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found.' });
      }
      const token = extractJobToken(req, jobId);
      if (!verifyOwnerToken(token, job.owner_token_hash)) {
        return res.status(403).json({ error: 'Invalid or missing job ownership token.' });
      }
      if (job.storage_key) await deleteObjectFromStorage(job.storage_key);
      if (job.output_storage_key) await deleteObjectFromStorage(job.output_storage_key);
      await markMediaJobExpired(job.job_id);
      return res.json({ success: true, cleanedCount: 1 });
    }

    const secret = process.env.CRON_SECRET || process.env.WORKER_SECRET;
    const authHeader = String(req.headers['authorization'] || '');
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized global cleanup request.' });
    }

    const result = await runCleanupSweep();
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('❌ [Cleanup Sweep Error]:', err);
    return res.status(500).json({ error: 'Cleanup sweep failed.' });
  }
});

// GET /api/jobs/:jobId - Check job status & obtain expiring signed download URL (requires owner token)
jobsRouter.get('/:jobId', async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.jobId || '');
    const job = await getMediaJobById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    const token = extractJobToken(req, jobId);
    if (!verifyOwnerToken(token, job.owner_token_hash)) {
      return res.status(403).json({ error: 'Invalid or missing job ownership token.' });
    }

    let signedDownloadUrl: string | null = null;
    if (job.status === 'completed' && job.output_storage_key && isObjectStorageConfigured()) {
      signedDownloadUrl = createPresignedS3Url('GET', job.output_storage_key, SIGNED_URL_TTL_SECONDS);
    }

    return res.json({
      success: true,
      job: sanitizeJobForClient(job),
      signedDownloadUrl,
      signedUrlExpiresInSeconds: signedDownloadUrl ? SIGNED_URL_TTL_SECONDS : null,
    });
  } catch (err) {
    console.error('❌ [Get Job Error]:', err);
    return res.status(500).json({ error: 'Failed to retrieve media job.' });
  }
});
