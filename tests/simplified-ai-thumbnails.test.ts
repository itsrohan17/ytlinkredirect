import assert from 'assert';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { app } from '../server/app.js';
import { initDb } from '../server/db.js';
import { buildNvidiaInvokeUrl, getConfiguredNvidiaModel } from '../server/services/nvidiaFlux.js';
import { computeBackgroundPlacement, recommendBackgroundFitMode } from '../client/src/utils/thumbnailFit.js';

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

    const youtuBeThumbRes = await fetch(`${base}/api/thumbnails/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://youtu.be/dQw4w9WgXcQ' }),
    });
    const youtuBeThumb: any = await youtuBeThumbRes.json();
    assert.strictEqual(youtuBeThumbRes.status, 200);
    assert.strictEqual(youtuBeThumb.videoId, 'dQw4w9WgXcQ');

    const nonYtThumb = await fetch(`${base}/api/thumbnails/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.instagram.com/p/C12345/' }),
    });
    assert.strictEqual(nonYtThumb.status, 400);

    const unavailableThumbRes = await fetch(`${base}/api/thumbnails/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=___________' }),
    });
    const unavailableThumb: any = await unavailableThumbRes.json();
    assert.strictEqual(unavailableThumbRes.status, 200);
    assert.strictEqual(unavailableThumb.videoId, '___________');
    assert.strictEqual(unavailableThumb.highestAvailable, null);

    const badImgTraversal = await fetch(`${base}/api/thumbnails/image?videoId=../../etc/passwd`);
    assert.strictEqual(badImgTraversal.status, 400);

    const missingImgRes = await fetch(`${base}/api/thumbnails/image?videoId=___________&quality=hq`);
    assert.strictEqual(missingImgRes.status, 404);

    const imgBytesRes = await fetch(`${base}/api/thumbnails/image?videoId=dQw4w9WgXcQ&quality=hq`);
    assert.strictEqual(imgBytesRes.status, 200);
    assert.strictEqual(imgBytesRes.headers.get('content-type'), 'image/jpeg');
    const imgBuf = await imgBytesRes.arrayBuffer();
    assert.ok(imgBuf.byteLength > 2000);
    console.log('[Pass 2] YouTube Watch, youtu.be, Shorts, unavailable & image download checks verified');

    // 3. NVIDIA FLUX Model Slug Normalization, URL Builder (Hosted + Self-Hosted) & Config Safety
    process.env.NVIDIA_NIM_MODEL = 'black-forest-labs/flux_1-dev';
    const configuredModel = getConfiguredNvidiaModel();
    assert.strictEqual(configuredModel, 'black-forest-labs/flux.1-dev');

    delete process.env.NVIDIA_NIM_BASE_URL;
    assert.strictEqual(
      buildNvidiaInvokeUrl(configuredModel),
      'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev'
    );
    process.env.NVIDIA_NIM_BASE_URL = 'https://ai.api.nvidia.com';
    assert.strictEqual(
      buildNvidiaInvokeUrl(configuredModel),
      'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev'
    );
    process.env.NVIDIA_NIM_BASE_URL = 'https://ai.api.nvidia.com/v1';
    assert.strictEqual(
      buildNvidiaInvokeUrl(configuredModel),
      'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev'
    );
    process.env.NVIDIA_NIM_BASE_URL = 'http://localhost:8000';
    assert.strictEqual(buildNvidiaInvokeUrl(configuredModel), 'http://localhost:8000/v1/infer');
    process.env.NVIDIA_NIM_BASE_URL = 'http://localhost:8000/v1';
    assert.strictEqual(buildNvidiaInvokeUrl(configuredModel), 'http://localhost:8000/v1/infer');
    process.env.NVIDIA_NIM_BASE_URL = 'http://localhost:8000/v1/infer';
    assert.strictEqual(buildNvidiaInvokeUrl(configuredModel), 'http://localhost:8000/v1/infer');
    delete process.env.NVIDIA_NIM_BASE_URL;

    delete process.env.NVIDIA_API_KEY;
    const cfgNoKey: any = await fetch(`${base}/api/ai/config`).then((r) => r.json());
    assert.strictEqual(cfgNoKey.configured, false);
    assert.strictEqual(cfgNoKey.model, 'black-forest-labs/flux.1-dev');
    assert.strictEqual(cfgNoKey.defaultResolution, '1344x768');
    const defaultResSpec = cfgNoKey.resolutions.find((r: any) => r.id === '1344x768');
    assert.strictEqual(defaultResSpec.aspectRatio, '7:4');
    assert.ok(!String(defaultResSpec.label).includes('(16:9'), '1344x768 must not be labeled exact 16:9');
    const vertResSpec = cfgNoKey.resolutions.find((r: any) => r.id === '768x1344');
    assert.strictEqual(vertResSpec.aspectRatio, '4:7');

    const missKeyRes = await fetch(`${base}/api/ai/thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'PC Build',
        prompt: 'Glowing gaming desktop on clean studio desk',
        preset: 'tech',
        resolution: '1344x768',
      }),
    });
    assert.strictEqual(missKeyRes.status, 503);
    console.log('[Pass 3] Missing NVIDIA_API_KEY (503), model slug & hosted/self-hosted NIM URLs verified');

    // 4. Request Validation, Exact NVIDIA Payload/Decode Contract & Upstream Error Handling
    process.env.NVIDIA_API_KEY = 'nvapi-dummy-secret-never-leak-this-value';
    const badPrompt = await fetch(`${base}/api/ai/thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'ab', resolution: '1344x768' }),
    });
    assert.strictEqual(badPrompt.status, 400);

    for (const unsupportedRes of ['1280x720', '1024x576']) {
      const badRes = await fetch(`${base}/api/ai/thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Clean dark desk studio shot', resolution: unsupportedRes }),
      });
      assert.strictEqual(badRes.status, 400, `Expected ${unsupportedRes} to be rejected with 400`);
    }

    // Verify full request/response contract against mocked self-hosted root base URL (http://localhost:3011 -> /v1/infer)
    let capturedPath = '';
    let capturedAuth = '';
    let capturedPayload: any = null;
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const fakePngBase64 = Buffer.concat([pngHeader, Buffer.alloc(120, 0x41)]).toString('base64');

    const okMockServer = http.createServer((req, res) => {
      capturedPath = req.url || '';
      capturedAuth = String(req.headers.authorization || '');
      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk;
      });
      req.on('end', () => {
        capturedPayload = JSON.parse(raw);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ artifacts: [{ base64: fakePngBase64, seed: 4242 }] }));
      });
    });
    await new Promise<void>((r) => okMockServer.listen(3011, r));
    process.env.NVIDIA_NIM_BASE_URL = 'http://localhost:3011';
    const okGenRes = await fetch(`${base}/api/ai/thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Clean dark desk studio shot',
        resolution: '1344x768',
        steps: 28,
        cfgScale: 3.5,
      }),
    });
    const okGenBody: any = await okGenRes.json();
    await new Promise<void>((r) => okMockServer.close(() => r()));

    assert.strictEqual(okGenRes.status, 200);
    assert.ok(okGenRes.headers.get('ratelimit-limit') || okGenRes.headers.get('x-ratelimit-limit'));
    assert.strictEqual(capturedPath, '/v1/infer');
    assert.strictEqual(capturedAuth, 'Bearer nvapi-dummy-secret-never-leak-this-value');
    assert.strictEqual(capturedPayload.width, 1344);
    assert.strictEqual(capturedPayload.height, 768);
    assert.strictEqual(capturedPayload.mode, 'base');
    assert.strictEqual(capturedPayload.steps, 28);
    assert.strictEqual(capturedPayload.cfg_scale, 3.5);
    assert.strictEqual(okGenBody.mimeType, 'image/png');
    assert.strictEqual(okGenBody.seed, 4242);
    assert.ok(String(okGenBody.dataUrl).startsWith(`data:image/png;base64,${fakePngBase64}`));

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
      process.env.NVIDIA_NIM_BASE_URL = 'http://localhost:3011/v1/infer';

      const errRes = await fetch(`${base}/api/ai/thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Clean dark desk studio shot', resolution: '1344x768' }),
      });
      const errText = await errRes.text();
      assert.strictEqual(errRes.status, tc.expectedHttp);
      assert.ok(!errText.includes('nvapi-dummy-secret-never-leak-this-value'), 'API key must NEVER leak');
      await new Promise<void>((r) => mockServer.close(() => r()));
    }
    console.log('[Pass 4] Request schema, dimension guard, base64 decode & upstream error mapping verified');

    // 5. Real NVIDIA Live Endpoint Auth Rejection Check (using deliberately invalid test token, never exposed chat key)
    process.env.NVIDIA_NIM_BASE_URL = 'https://ai.api.nvidia.com/v1/genai';
    process.env.NVIDIA_API_KEY = 'nvapi-invalid-test-token-for-auth-check';
    const liveAuthCheck = await fetch(`${base}/api/ai/thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Studio microphone dark background', resolution: '1344x768' }),
    });
    assert.ok(
      liveAuthCheck.status === 401 || liveAuthCheck.status === 403,
      `Expected live NVIDIA auth failure (401/403), got ${liveAuthCheck.status}`
    );
    const liveAuthText = await liveAuthCheck.text();
    assert.ok(!liveAuthText.includes('nvapi-invalid-test-token-for-auth-check'));
    console.log(`[Pass 5] Live NVIDIA HTTPS endpoint rejected invalid credential cleanly (${liveAuthCheck.status})`);

    // 6. Security: Session Isolation, CSRF/CORS Enforcement & Smart Link Redirect Preservation
    const csrfBlocked = await fetch(`${base}/api/ai/thumbnail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil.example',
      },
      body: JSON.stringify({ prompt: 'Cross site test', resolution: '1344x768' }),
    });
    assert.strictEqual(csrfBlocked.status, 403);
    assert.strictEqual(csrfBlocked.headers.get('access-control-allow-origin'), null);

    const createLinkRes = await fetch(`${base}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    });
    assert.strictEqual(createLinkRes.status, 201);
    const linkData: any = await createLinkRes.json();
    const createdCode = linkData.link?.code;
    assert.ok(createdCode, 'Expected linkData.link.code');
    const sessionCookie = createLinkRes.headers.get('set-cookie')?.split(';')[0] || '';
    assert.ok(sessionCookie.startsWith('lt_session='), 'Expected lt_session cookie on link creation');

    const unauthRecentRes = await fetch(`${base}/api/links/recent`);
    assert.strictEqual(unauthRecentRes.status, 401);

    const ownLinksRes = await fetch(`${base}/api/links/recent`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(ownLinksRes.status, 200);
    const ownLinksBody: any = await ownLinksRes.json();
    assert.ok(Array.isArray(ownLinksBody.links) && ownLinksBody.links.some((l: any) => l.code === createdCode));

    const forgedSessionRes = await fetch(`${base}/api/links/recent`, {
      headers: { Cookie: 'lt_session=short-invalid-cookie' },
    });
    assert.strictEqual(forgedSessionRes.status, 401);

    const secondSessionInit = await fetch(`${base}/api/links/session`, { method: 'POST' });
    assert.strictEqual(secondSessionInit.status, 200);
    const secondCookie = secondSessionInit.headers.get('set-cookie')?.split(';')[0] || '';
    assert.ok(secondCookie.startsWith('lt_session=') && secondCookie !== sessionCookie);

    const otherLinksRes = await fetch(`${base}/api/links/recent`, {
      headers: { Cookie: secondCookie },
    });
    assert.strictEqual(otherLinksRes.status, 200);
    const otherLinksBody: any = await otherLinksRes.json();
    assert.ok(!otherLinksBody.links?.some((l: any) => l.code === createdCode), 'Other session must not see link');

    const crossReadCodeRes = await fetch(`${base}/api/links/${createdCode}`, {
      headers: { Cookie: secondCookie },
    });
    assert.strictEqual(crossReadCodeRes.status, 403);

    const redirectRes = await fetch(`${base}/${createdCode}`, { redirect: 'manual' });
    assert.strictEqual(redirectRes.status, 302);
    assert.ok((redirectRes.headers.get('location') || '').includes('youtube.com/watch?v=dQw4w9WgXcQ'));
    console.log('[Pass 6] CSRF/CORS rejection, lt_session isolation & Smart Link 302 redirect verified');

    // 7. Verify ZERO API key or secrets anywhere inside built dist-client assets
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
    console.log('[Pass 7] Zero secrets or NVIDIA_API_KEY references verified inside dist-client bundles');

    // 8. Canvas 1280x720 Export Aspect-Preservation (zero distortion across all 5 FLUX resolutions)
    assert.strictEqual(recommendBackgroundFitMode(1344, 768), 'cover');
    assert.strictEqual(recommendBackgroundFitMode(1024, 1024), 'contain-blur');
    assert.strictEqual(recommendBackgroundFitMode(768, 1344), 'contain-blur');

    for (const [iw, ih] of [
      [1344, 768],
      [1280, 768],
      [1216, 832],
      [1024, 1024],
      [768, 1344],
    ]) {
      const natAspect = iw / ih;
      const cover = computeBackgroundPlacement(iw, ih, 1280, 720, 'cover', 'center');
      assert.ok(cover.foregroundRect.width >= 1280 - 1e-6 && cover.foregroundRect.height >= 720 - 1e-6);
      assert.ok(Math.abs(cover.foregroundRect.width / cover.foregroundRect.height - natAspect) < 1e-6);

      const contain = computeBackgroundPlacement(iw, ih, 1280, 720, 'contain-blur', 'center');
      assert.ok(contain.backdropRect !== null);
      assert.ok(contain.foregroundRect.width <= 1280 + 1e-6 && contain.foregroundRect.height <= 720 + 1e-6);
      assert.ok(Math.abs(contain.foregroundRect.width / contain.foregroundRect.height - natAspect) < 1e-6);
    }
    const topCrop = computeBackgroundPlacement(768, 1344, 1280, 720, 'cover', 'top');
    const bottomCrop = computeBackgroundPlacement(768, 1344, 1280, 720, 'cover', 'bottom');
    assert.strictEqual(topCrop.foregroundRect.y, 0);
    assert.ok(bottomCrop.foregroundRect.y < 0);
    console.log('[Pass 8] Canvas 1280x720 aspect preservation & cover/blur fitting verified');

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
