import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  claimNextQueuedJob,
  failOrRetryMediaJob,
  getExpiredMediaJobs,
  initDb,
  markMediaJobExpired,
  updateMediaJob,
} from '../server/db.js';
import { verifyMagicBytes } from '../server/services/fileSecurity.js';
import {
  buildStorageKey,
  createPresignedS3Url,
  deleteObjectFromStorage,
  isObjectStorageConfigured,
} from '../server/services/storage.js';
import { MediaJobRecord } from '../server/types.js';

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS || 5000);
const JOB_TIMEOUT_MS = Number(process.env.WORKER_JOB_TIMEOUT_MS || 120000);
const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';

export async function runCleanupSweep(): Promise<{ cleanedCount: number }> {
  const expiredJobs = await getExpiredMediaJobs();
  let cleanedCount = 0;

  for (const job of expiredJobs) {
    if (job.storage_key) {
      await deleteObjectFromStorage(job.storage_key);
    }
    if (job.output_storage_key) {
      await deleteObjectFromStorage(job.output_storage_key);
    }
    await markMediaJobExpired(job.job_id);
    cleanedCount++;
  }

  return { cleanedCount };
}

function runFfmpegWithTimeout(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    const timer = setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch {}
      reject(new Error(`FFmpeg processing exceeded timeout of ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 4000) {
        stderr = stderr.slice(-4000);
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to launch FFmpeg (${FFMPEG_BIN}): ${err.message}`));
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-300)}`));
      }
    });
  });
}

async function processJob(job: MediaJobRecord): Promise<void> {
  if (!job.storage_key) {
    throw new Error('Queued worker job is missing storage_key');
  }
  if (!isObjectStorageConfigured()) {
    throw new Error('Object storage (S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY) is not configured');
  }

  const downloadUrl = createPresignedS3Url('GET', job.storage_key, 300);
  if (!downloadUrl) {
    throw new Error('Could not generate signed GET URL for input file');
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `linktwin-job-${job.job_id}-`));
  const inputPath = path.join(workDir, 'input');
  const outExt = job.output_format.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  const outputPath = path.join(workDir, `output.${outExt}`);

  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch input object from storage (HTTP ${res.status})`);
    }
    const inputBuf = Buffer.from(await res.arrayBuffer());

    // Validate actual magic bytes before passing to FFmpeg
    const category = job.module === 'audio-studio' ? 'audio' : 'video';
    const headerHex = inputBuf.subarray(0, 16).toString('hex');
    const sigCheck = verifyMagicBytes(headerHex, category);
    if (!sigCheck.valid) {
      throw new Error(`Security rejection: ${sigCheck.reason}`);
    }

    fs.writeFileSync(inputPath, inputBuf);

    // Build FFmpeg args cleanly based on output format
    const ffmpegArgs = ['-y', '-i', inputPath];
    if (outExt === 'mp4') {
      ffmpegArgs.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-c:a', 'aac', '-movflags', '+faststart', outputPath);
    } else if (outExt === 'webm') {
      ffmpegArgs.push('-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-c:a', 'libopus', outputPath);
    } else if (outExt === 'mp3') {
      ffmpegArgs.push('-vn', '-c:a', 'libmp3lame', '-b:a', '192k', outputPath);
    } else {
      ffmpegArgs.push(outputPath);
    }

    await runFfmpegWithTimeout(ffmpegArgs, JOB_TIMEOUT_MS);

    const outBuf = fs.readFileSync(outputPath);
    const outKey = buildStorageKey(job.job_id, `converted.${outExt}`, 'outputs');
    const uploadUrl = createPresignedS3Url('PUT', outKey, 300);
    if (!uploadUrl) {
      throw new Error('Could not generate signed PUT URL for output');
    }

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: outBuf,
    });
    if (!putRes.ok) {
      throw new Error(`Failed to upload processed output to storage (HTTP ${putRes.status})`);
    }

    await updateMediaJob(job.job_id, {
      status: 'completed',
      outputSize: outBuf.byteLength,
      outputStorageKey: outKey,
      errorMessage: null,
    });
    console.log(`✅ [Worker] Completed job ${job.job_id} (${outBuf.byteLength} bytes)`);
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {}
  }
}

async function workerTick(): Promise<void> {
  try {
    await runCleanupSweep();
    const job = await claimNextQueuedJob();
    if (!job) return;

    console.log(`⚙️ [Worker] Processing job ${job.job_id} (attempt ${job.retry_count + 1}/${job.max_retries + 1})`);
    try {
      await processJob(job);
    } catch (err: any) {
      console.error(`❌ [Worker] Job ${job.job_id} error:`, err.message);
      await failOrRetryMediaJob(job.job_id, err.message || 'Worker processing failed');
    }
  } catch (err) {
    console.error('❌ [Worker] Tick error:', err);
  }
}

// Start polling loop only when run directly
const isMain = process.argv[1] && path.resolve(process.argv[1]).includes('mediaWorker');
if (isMain) {
  (async () => {
    await initDb();
    console.log(`🚀 [Worker] LinkTwin Media Worker started (poll=${POLL_INTERVAL_MS}ms, timeout=${JOB_TIMEOUT_MS}ms)`);
    await workerTick();
    setInterval(workerTick, POLL_INTERVAL_MS);
  })();
}
