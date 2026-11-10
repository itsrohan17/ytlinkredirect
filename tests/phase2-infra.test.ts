import assert from 'assert';
import fs from 'fs';
import {
  claimNextQueuedJob,
  createMediaJob,
  failOrRetryMediaJob,
  findActiveJobByDedupeKey,
  getExpiredMediaJobs,
  getRecentLinks,
  initDb,
  markMediaJobExpired,
  updateMediaJob,
} from '../server/db.js';
import {
  isAllowedMimeForCategory,
  sanitizeFilename,
  validatePublicUrlForFetch,
  verifyMagicBytes,
} from '../server/services/fileSecurity.js';
import {
  buildStorageKey,
  createPresignedS3Url,
  generateOwnerToken,
  hashOwnerToken,
  verifyOwnerToken,
} from '../server/services/storage.js';

async function runPhase2Tests() {
  console.log('=== STARTING PHASE 2 INFRASTRUCTURE VERIFICATION ===');

  // 1. Database Migration on isolated copy of data/app.db
  const testDbPath = 'data/app.test-phase2.db';
  if (fs.existsSync('data/app.db')) {
    fs.copyFileSync('data/app.db', testDbPath);
  }

  const db = await initDb(testDbPath);
  try {
    const tablesRes = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('links', 'clicks', 'media_jobs')"
    );
    const tableNames = tablesRes.rows.map((r: any) => String(r.name));
    assert.ok(tableNames.includes('links'));
    assert.ok(tableNames.includes('clicks'));
    assert.ok(tableNames.includes('media_jobs'));

    const preservedLinks = await getRecentLinks(20, db);
    console.log(`[Pass 1] Isolated DB migration succeeded; preserved ${preservedLinks.length} existing links`);

    // 2. Magic-byte File Signature & MIME Validation
    assert.strictEqual(verifyMagicBytes('FFD8FFE000104A464946', 'image').valid, true); // JPG
    assert.strictEqual(verifyMagicBytes('89504E470D0A1A0A0000', 'image').valid, true); // PNG
    assert.strictEqual(verifyMagicBytes('000000206674797069736F6D', 'video').valid, true); // MP4 ftyp
    assert.strictEqual(verifyMagicBytes('1A45DFA39F42868101', 'video').valid, true); // WebM/MKV
    assert.strictEqual(verifyMagicBytes('4944330300000000', 'audio').valid, true); // MP3 ID3
    assert.strictEqual(verifyMagicBytes('255044462D312E37', 'pdf').valid, true); // %PDF-

    // Spoofed executable (.exe renamed to .mp4/.png)
    assert.strictEqual(verifyMagicBytes('4D5A900003000000', 'video').valid, false);
    assert.strictEqual(verifyMagicBytes('4D5A900003000000', 'image').valid, false);
    assert.strictEqual(isAllowedMimeForCategory('application/x-msdownload', 'video'), false);
    assert.strictEqual(sanitizeFilename('../../etc/passwd'), 'passwd');
    console.log('[Pass 2] Magic-byte file signature & filename sanitization verified');

    // 3. SSRF Protection & IP Range Rejection
    const blockedUrls = [
      'http://localhost:3000/api/health',
      'http://127.0.0.1/admin',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.5/internal',
      'http://192.168.1.1/',
      'file:///etc/passwd',
    ];
    for (const u of blockedUrls) {
      let rejected = false;
      try {
        await validatePublicUrlForFetch(u);
      } catch {
        rejected = true;
      }
      assert.strictEqual(rejected, true, `Expected SSRF block for ${u}`);
    }
    const validPublic = await validatePublicUrlForFetch('https://www.youtube.com');
    assert.strictEqual(validPublic.hostname, 'www.youtube.com');
    console.log('[Pass 3] SSRF URL & private IP rejection verified');

    // 4. Signed URL Generation, Expiration & Ownership Validation
    process.env.S3_BUCKET = 'linktwin-private-test';
    process.env.S3_REGION = 'auto';
    process.env.S3_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
    process.env.S3_ACCESS_KEY_ID = 'test_access_key';
    process.env.S3_SECRET_ACCESS_KEY = 'test_secret_key';

    const key = buildStorageKey('job_test123', '../unsafe name!.mp4', 'uploads');
    assert.strictEqual(key, 'linktwin/uploads/job_test123/unsafe_name_.mp4');

    const putUrl = createPresignedS3Url('PUT', key, 300);
    assert.ok(putUrl && putUrl.includes('X-Amz-Algorithm=AWS4-HMAC-SHA256'));
    assert.ok(putUrl.includes('X-Amz-Expires=300'));
    assert.ok(putUrl.includes('X-Amz-Signature='));

    const token = generateOwnerToken();
    const tokenHash = hashOwnerToken(token);
    assert.strictEqual(verifyOwnerToken(token, tokenHash), true);
    assert.strictEqual(verifyOwnerToken('wrong-token', tokenHash), false);
    console.log('[Pass 4] Signed S3/R2 URL generation, expiry & ownership validation verified');

    // 5. Job Lifecycle: Creation, Deduplication, Atomic Claim, Retries, Failure & Expiration Cleanup
    const job1 = await createMediaJob(
      {
        jobId: 'job_phase2_1',
        module: 'video-converter',
        processingMode: 'server-worker',
        inputFilename: 'sample.mp4',
        inputMime: 'video/mp4',
        inputSize: 150 * 1024 * 1024,
        outputFormat: 'webm',
        status: 'queued',
        storageKey: key,
        ownerTokenHash: tokenHash,
        dedupeKey: 'dedupe_sample_150mb_webm',
        maxRetries: 1,
        expiresAt: '2020-01-01 00:00:00', // Already expired for cleanup test
      },
      db
    );
    assert.strictEqual(job1.status, 'queued');

    const dup = await findActiveJobByDedupeKey('dedupe_sample_150mb_webm', db);
    assert.ok(dup && dup.job_id === 'job_phase2_1');

    const claimed1 = await claimNextQueuedJob(db);
    assert.ok(claimed1 && claimed1.job_id === 'job_phase2_1' && claimed1.status === 'processing');

    // Second concurrent claim must return null
    const claimed2 = await claimNextQueuedJob(db);
    assert.strictEqual(claimed2, null);

    // Retry 1 -> re-queues
    const retried = await failOrRetryMediaJob('job_phase2_1', 'Transient timeout', db);
    assert.strictEqual(retried?.status, 'queued');
    assert.strictEqual(retried?.retry_count, 1);

    // Claim again & fail -> exceeds maxRetries (1) -> failed
    await claimNextQueuedJob(db);
    const failed = await failOrRetryMediaJob('job_phase2_1', 'Permanent codec error', db);
    assert.strictEqual(failed?.status, 'failed');

    // Cleanup sweep on expired job
    const expiredList = await getExpiredMediaJobs(db);
    assert.ok(expiredList.some((j) => j.job_id === 'job_phase2_1'));
    await markMediaJobExpired('job_phase2_1', db);
    const afterExpire = await updateMediaJob('job_phase2_1', {}, db);
    assert.strictEqual(afterExpire?.status, 'expired');
    assert.strictEqual(afterExpire?.storage_key, null);
    console.log('[Pass 5] Job deduplication, atomic claim, retries, failure & expiration cleanup verified');

    console.log('=== ALL PHASE 2 INFRASTRUCTURE TESTS PASSED ===');
  } finally {
    delete process.env.S3_BUCKET;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    try {
      db.close();
    } catch {}
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
  }
}

runPhase2Tests().catch((err) => {
  console.error('Phase 2 Test Failed:', err);
  process.exit(1);
});
