import assert from 'assert';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { app } from '../server/app.js';
import { initDb } from '../server/db.js';
import { buildNvidiaInvokeUrl, getConfiguredNvidiaModel } from '../server/services/nvidiaFlux.js';

async function runSimplifiedAndAiTests() {
  console.log('=== STARTING SIMPLIFIED LINKTWIN + NVIDIA FLUX TESTS ===');

  await initDb(':memory:');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3010, resolve));
  const base = 'http://localhost:3010';

  const origApiKey = process.env.NVIDIA_API_KEY;
  const origModel = process.env.NVIDIA_NIM_MODEL;
  const origBaseUrl = process.env.NVIDIA_NIM_BASE_URL;

  try {
    // 1. Removed Dashboard / Media Studio / Utilities endpoints cleanly return 404 JSON
    const removedRes = await fetch(`${base}/api/utilities/qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'url', data: { url: 'https://example.com' } }),
    });
    assert.strictEqual(removedRes.status, 404);
    const removedJobs = await fetch(`${base}/api/jobs/summary`);
    assert.strictEqual(removedJobs.status, 404);
    console.log('[Pass 1] Removed SaaS Media Studio / Utilities / Jobs routes verified absent (404)');

    // 2. YouTube Thumbnail Downloader (Watch, Shorts, real resolution probing, non-YT rejection, traversal check)
    const shortsThumbRes = await fetch(`${base}/api/thumbnails/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/shorts/5-x1qKq2f1Q' }),
    });
    const shortsThumb: any = await shortsThumbRes.json();
    assert.strictEqual(shortsThumbRes.status, 200);
    assert.strictEqual(shortsThumb.videoId, '5-x1qKq2f1Q');
    assert.ok(Array.isArray(shortsThumb.resolutions) && shortsThumb.resolutions.length === 5);

    const watchThumbRes = await fetch(`${base}/api/thumbnails/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    });
    const watchThumb: any = await watchThumbRes.json();
    assert.strictEqual(watchThumbRes.status, 200);
    assert.ok(watchThumb.highestAvailable && watchThumb.highestAvailable.available === true);

    const badImgTraversal = await fetch(`${base}/api/thumbnails/image?videoId=../../etc/passwd`);
    assert.strictEqual(badImgTraversal.status, 400);

    const imgBytesRes = await fetch(`${base}/api/thumbnails/image?videoId=dQw4w9WgXcQ&quality=hq`);
    assert.strictEqual(imgBytesRes.status, 200);
    assert.strictEqual(imgBytesRes.headers.get('content-type'), 'image/jpeg');
    const imgBuf = await imgBytesRes.arrayBuffer();
    assert.ok(imgBuf.byteLength > 2000);
    console.log('[Pass 2] YouTube & Shorts Thumbnail Downloader extraction, probe & download verified');

    // 3. NVIDIA FLUX Model Slug Normalization & Config Safety
    process.env.NVIDIA_NIM_MODEL = 'black-forest-labs/flux_1-dev';
    assert.strictEqual(getConfiguredNvidiaModel(), 'black-forest-labs/flux.1-dev');
    assert.strictEqual(
      buildNvidiaInvokeUrl(getConfiguredNvidiaModel()),
      'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev'
    );

    delete process.env.NVIDIA_API_KEY;
    const cfgNoKey: any = await fetch(`${base}/api/ai/config`).then((r) => r.json());
    assert.strictEqual(cfgNoKey.configured, false);
    assert.strictEqual(cfgNoKey.model, 'black-forest-labs/flux.1-dev');

    const missKeyRes = await fetch(`${base}/api/ai/thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'PC Build',
        prompt: 'Glowing gaming desktop on clean studio desk',
        preset: 'tech',
        resolution: '1280x720',
      }),
    });
    assert.strictEqual(missKeyRes.status, 503);
    console.log('[Pass 3] Missing NVIDIA_API_KEY fails safely (503) & model slug normalized cleanly');

    // 4. Request Validation & Quota/Rate-Limit/Auth Upstream Error Handling (mocked upstream NIM statuses)
    const badPrompt = await fetch(`${base}/api/ai/thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'ab', resolution: '1280x720' }),
    });
    assert.strictEqual(badPrompt.status, 400);

    const mockNimResponses: Array<{ status: number; body: any; expectedHttp: number }> = [
      { status: 401, body: { detail: 'Unauthorized' }, expectedHttp: 401 },
      { status: 402, body: { detail: 'Insufficient credits' }, expectedHttp: 402 },
      { status: 429, body: { detail: 'Too many requests' }, expectedHttp: 429 },
      { status: 404, body: { detail: 'Model not found' }, expectedHttp: 404 },
    ];

    for (const tc of mockNimResponses) {
      const mockServer = http.createServer((_req, res) => {
        res.statusCode = tc.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(tc.body));
      });
      await new Promise<void>((r) => mockServer.listen(3011, r));
      process.env.NVIDIA_API_KEY = 'nvapi-dummy-secret-never-leak-this-value';
      process.env.NVIDIA_NIM_BASE_URL = 'http://localhost:3011/v1/infer';

      const errRes = await fetch(`${base}/api/ai/thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Clean dark desk studio shot', resolution: '1280x720' }),
      });
      const errText = await errRes.text();
      assert.strictEqual(errRes.status, tc.expectedHttp);
      assert.ok(!errText.includes('nvapi-dummy-secret-never-leak-this-value'), 'API key must NEVER leak');
      await new Promise<void>((r) => mockServer.close(() => r()));
    }
    console.log('[Pass 4] Auth (401), quota (402), rate-limit (429) & unavailable model (404) error mapping + key non-leakage verified');

    // 5. Real NVIDIA Live Endpoint Auth Rejection Check (using deliberately invalid test token, never exposed chat key)
    process.env.NVIDIA_NIM_BASE_URL = 'https://ai.api.nvidia.com/v1/genai';
    process.env.NVIDIA_API_KEY = 'nvapi-invalid-test-token-for-auth-check';
    const liveAuthCheck = await fetch(`${base}/api/ai/thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Studio microphone dark background', resolution: '1280x720' }),
    });
    assert.ok(
      liveAuthCheck.status === 401 || liveAuthCheck.status === 403,
      `Expected live NVIDIA auth failure (401/403), got ${liveAuthCheck.status}`
    );
    const liveAuthText = await liveAuthCheck.text();
    assert.ok(!liveAuthText.includes('nvapi-invalid-test-token-for-auth-check'));
    console.log(`[Pass 5] Live NVIDIA HTTPS endpoint rejected invalid credential cleanly (${liveAuthCheck.status})`);

    // 6. Verify ZERO API key or secrets anywhere inside built dist-client assets
    const distClientAssets = path.resolve(process.cwd(), 'dist-client/assets');
    if (fs.existsSync(distClientAssets)) {
      for (const file of fs.readdirSync(distClientAssets)) {
        const content = fs.readFileSync(path.join(distClientAssets, file), 'utf8');
        assert.ok(!content.includes('NVIDIA_API_KEY'));
        assert.ok(!content.includes('nvapi-'));
        assert.ok(!content.includes('TURSO_AUTH_TOKEN'));
        assert.ok(!content.includes('SESSION_SECRET'));
      }
    }
    console.log('[Pass 6] Zero secrets or NVIDIA_API_KEY references verified inside dist-client bundles');

    console.log('\n🎉 ALL SIMPLIFIED LINKTWIN + NVIDIA FLUX TESTS PASSED!');
  } finally {
    if (origApiKey === undefined) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = origApiKey;
    if (origModel === undefined) delete process.env.NVIDIA_NIM_MODEL;
    else process.env.NVIDIA_NIM_MODEL = origModel;
    if (origBaseUrl === undefined) delete process.env.NVIDIA_NIM_BASE_URL;
    else process.env.NVIDIA_NIM_BASE_URL = origBaseUrl;

    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runSimplifiedAndAiTests().catch((err) => {
  console.error('❌ SIMPLIFIED PRODUCT TEST FAILED:', err);
  process.exit(1);
});
