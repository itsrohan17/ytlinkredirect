import assert from 'assert';
import http from 'http';
import { app } from '../server/app.js';
import { initDb } from '../server/db.js';
import { safeFetchExternalUrl, validatePublicUrlForFetch } from '../server/services/fileSecurity.js';

async function runPhase3Tests() {
  console.log('=== STARTING PHASE 3 MEDIA STUDIO & SECURITY TESTS ===');

  // 1. SSRF IPv4-mapped IPv6 & Private IP Rejection
  const ssrfTargets = [
    'http://[::1]:3000/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:7f00:1]/',
    'http://100.64.0.1/',
    'http://172.16.0.5/',
    'http://198.18.0.1/',
  ];
  for (const target of ssrfTargets) {
    let blocked = false;
    try {
      await validatePublicUrlForFetch(target);
    } catch {
      blocked = true;
    }
    assert.strictEqual(blocked, true, `Expected SSRF block for ${target}`);
  }
  console.log('[Pass 1] IPv4-mapped IPv6 & CGNAT/RFC1918 SSRF vectors blocked');

  // 2. Test HTTP API Job Lifecycle, Ownership Cookie & Security Boundaries
  await initDb(':memory:');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3005, resolve));

  try {
    const base = 'http://localhost:3005';

    // 2a. Spoofed MZ executable signature rejected
    const spoofRes = await fetch(`${base}/api/jobs/validate-signature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'payload.mp4',
        mime: 'video/mp4',
        headerHex: '4D5A900003000000',
        category: 'video',
      }),
    });
    assert.strictEqual(spoofRes.status, 400);

    // 2b. Oversized browser upload rejected (413)
    const bigRes = await fetch(`${base}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: 'video-converter',
        processingMode: 'browser-wasm',
        inputFilename: 'huge.mp4',
        inputMime: 'video/mp4',
        inputSize: 250 * 1024 * 1024,
        outputFormat: 'webm',
        headerHex: '000000206674797069736F6D',
      }),
    });
    assert.strictEqual(bigRes.status, 413);

    // 2c. Worker job when S3 unconfigured returns clear 503 explanation
    delete process.env.S3_BUCKET;
    const noS3Res = await fetch(`${base}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: 'video-converter',
        processingMode: 'server-worker',
        inputFilename: 'large.mp4',
        inputMime: 'video/mp4',
        inputSize: 150 * 1024 * 1024,
        outputFormat: 'mp4',
        headerHex: '000000206674797069736F6D',
      }),
    });
    assert.strictEqual(noS3Res.status, 503);
    console.log('[Pass 2] Spoofed signatures (400), size limits (413) & missing storage notice (503) verified');

    // 2d. Worker job with S3 configured: sets HttpOnly cookie, hides raw token in JSON, enforces ownership
    process.env.S3_BUCKET = 'private-bucket';
    process.env.S3_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
    process.env.S3_ACCESS_KEY_ID = 'test_key';
    process.env.S3_SECRET_ACCESS_KEY = 'test_secret';

    const createRes = await fetch(`${base}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: 'audio-studio',
        processingMode: 'server-worker',
        inputFilename: 'podcast.mp3',
        inputMime: 'audio/mpeg',
        inputSize: 120 * 1024 * 1024,
        outputFormat: 'wav',
        headerHex: '4944330300000000',
        dedupeKey: 'podcast_dedupe_1',
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const createBody = await createRes.json();
    assert.strictEqual((createBody as any).ownerToken, undefined, 'Raw ownerToken must NOT leak in JSON');
    assert.strictEqual((createBody.job as any).owner_token_hash, undefined, 'Token hash must NOT leak');
    assert.ok(createBody.signedUploadUrl.includes('X-Amz-Expires='));

    const setCookie = createRes.headers.get('set-cookie') || '';
    assert.ok(setCookie.includes('HttpOnly'));
    const jobCookie = setCookie.split(';')[0];
    const jobId = createBody.job.job_id;

    // Duplicate dedupeKey must be rejected with 409
    const dupRes = await fetch(`${base}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: 'audio-studio',
        processingMode: 'server-worker',
        inputFilename: 'podcast.mp3',
        inputMime: 'audio/mpeg',
        inputSize: 120 * 1024 * 1024,
        outputFormat: 'wav',
        headerHex: '4944330300000000',
        dedupeKey: 'podcast_dedupe_1',
      }),
    });
    assert.strictEqual(dupRes.status, 409);

    // Status without ownership cookie -> 403
    const unauthStatus = await fetch(`${base}/api/jobs/${jobId}`);
    assert.strictEqual(unauthStatus.status, 403);

    // Status WITH ownership cookie -> 200
    const authStatus = await fetch(`${base}/api/jobs/${jobId}`, {
      headers: { cookie: jobCookie },
    });
    assert.strictEqual(authStatus.status, 200);

    // Single-job cleanup without cookie -> 403
    const unauthClean = await fetch(`${base}/api/jobs/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });
    assert.strictEqual(unauthClean.status, 403);

    // Global cleanup without CRON_SECRET -> 401
    const unauthGlobalClean = await fetch(`${base}/api/jobs/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(unauthGlobalClean.status, 401);

    // Single-job cleanup WITH cookie -> 200
    const authClean = await fetch(`${base}/api/jobs/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: jobCookie },
      body: JSON.stringify({ jobId }),
    });
    assert.strictEqual(authClean.status, 200);
    console.log('[Pass 3] HttpOnly job ownership, zero token leaks, deduplication & cleanup auth verified');

    // Verify safeFetchExternalUrl rejects private target
    let fetchBlocked = false;
    try {
      await safeFetchExternalUrl('http://127.0.0.1:3005/api/health');
    } catch {
      fetchBlocked = true;
    }
    assert.strictEqual(fetchBlocked, true);
    console.log('[Pass 4] safeFetchExternalUrl loopback rejection verified');

    console.log('=== ALL PHASE 3 TESTS PASSED ===');
  } finally {
    delete process.env.S3_BUCKET;
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    server.close();
  }
}

runPhase3Tests().catch((err) => {
  console.error('Phase 3 Test Failed:', err);
  process.exit(1);
});
