import assert from 'assert';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { app } from '../server/app.js';
import { initDb } from '../server/db.js';
import {
  applyUnsharpMaskToRgba,
  computeUpscaleDimensions,
  MAX_UPSCALE_DIMENSION,
} from '../client/src/utils/imageUpscaler.js';

async function runThumbnailAndUpscalerTests() {
  console.log('=== STARTING LINKTWIN THUMBNAIL DOWNLOADER + UPSCALER TESTS ===');

  await initDb(':memory:');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3010, resolve));
  const base = 'http://localhost:3010';

  try {
    // 1. Removed AI / SaaS Media Studio / Utilities / Jobs routes cleanly return 404 JSON
    for (const removed of [
      { method: 'GET', url: '/api/ai/config' },
      { method: 'POST', url: '/api/ai/thumbnail' },
      { method: 'POST', url: '/api/utilities/qr' },
      { method: 'GET', url: '/api/jobs/summary' },
    ]) {
      const res = await fetch(`${base}${removed.url}`, { method: removed.method });
      assert.strictEqual(res.status, 404, `Expected ${removed.url} to return 404`);
      const body: any = await res.json();
      assert.ok(typeof body.error === 'string');
    }
    console.log('[Pass 1] Removed AI / Media Studio / Utilities / Jobs routes verified absent (404)');

    // 2. YouTube Thumbnail Downloader (Watch, youtu.be, Shorts, best source quality, validation)
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

    const missingImgRes = await fetch(`${base}/api/thumbnails/image?videoId=___________&quality=best`);
    assert.strictEqual(missingImgRes.status, 404);

    // Best source quality endpoint picks highest available source bytes with JPEG dimensions intact
    const bestImgRes = await fetch(`${base}/api/thumbnails/image?videoId=dQw4w9WgXcQ&quality=best`);
    assert.strictEqual(bestImgRes.status, 200);
    assert.strictEqual(bestImgRes.headers.get('content-type'), 'image/jpeg');
    const srcW = Number(bestImgRes.headers.get('x-thumbnail-width'));
    const srcH = Number(bestImgRes.headers.get('x-thumbnail-height'));
    assert.ok(srcW >= 1280 && srcH >= 720, `Expected HD dimensions from best source, got ${srcW}x${srcH}`);
    const imgBuf = await bestImgRes.arrayBuffer();
    assert.ok(imgBuf.byteLength > 10000);
    console.log(`[Pass 2] YouTube Watch/Shorts/youtu.be & best source download verified (${srcW}x${srcH})`);

    // 3. Image Upscaler Dimensions & Pixel Sharpening Kernel
    const hdFrom720 = computeUpscaleDimensions(1280, 720, '1080p');
    assert.strictEqual(hdFrom720.width, 1920);
    assert.strictEqual(hdFrom720.height, 1080);
    assert.strictEqual(hdFrom720.wasCapped, false);

    const uhdFrom720 = computeUpscaleDimensions(1280, 720, '4k');
    assert.strictEqual(uhdFrom720.width, 3840);
    assert.strictEqual(uhdFrom720.height, 2160);

    const sdToFullHdWidth = computeUpscaleDimensions(480, 360, '1080p');
    assert.strictEqual(sdToFullHdWidth.width, 1920);
    assert.strictEqual(sdToFullHdWidth.height, 1440);

    const noShrink = computeUpscaleDimensions(2560, 1440, '1080p');
    assert.strictEqual(noShrink.width, 2560);
    assert.strictEqual(noShrink.height, 1440);

    const capped4x = computeUpscaleDimensions(1920, 1080, '4x');
    assert.strictEqual(capped4x.width, MAX_UPSCALE_DIMENSION);
    assert.strictEqual(capped4x.wasCapped, true);
    assert.ok(Math.abs(capped4x.width / capped4x.height - 16 / 9) < 0.01);

    // Unsharp mask increases edge delta while preserving alpha channel
    const rgba = new Uint8ClampedArray(3 * 3 * 4);
    for (let i = 0; i < 9; i++) {
      const val = i === 4 ? 200 : 100;
      rgba[i * 4 + 0] = val;
      rgba[i * 4 + 1] = val;
      rgba[i * 4 + 2] = val;
      rgba[i * 4 + 3] = 255;
    }
    applyUnsharpMaskToRgba(rgba, 3, 3, 60);
    assert.ok(rgba[4 * 4] > 200, 'Center edge pixel should sharpen upward');
    assert.strictEqual(rgba[4 * 4 + 3], 255, 'Alpha channel must stay untouched');
    console.log('[Pass 3] Image Upscaler dimension math, 4096px safety cap & RGBA sharpening verified');

    // 4. Security: CSRF/CORS Enforcement, lt_session Isolation & Smart Link 302 Redirect
    const csrfBlocked = await fetch(`${base}/api/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil.example',
      },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
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
    assert.ok(createdCode);
    const sessionCookie = createLinkRes.headers.get('set-cookie')?.split(';')[0] || '';
    assert.ok(sessionCookie.startsWith('lt_session='));

    const unauthRecentRes = await fetch(`${base}/api/links/recent`);
    assert.strictEqual(unauthRecentRes.status, 401);

    const secondSessionInit = await fetch(`${base}/api/links/session`, { method: 'POST' });
    const secondCookie = secondSessionInit.headers.get('set-cookie')?.split(';')[0] || '';
    const crossReadCodeRes = await fetch(`${base}/api/links/${createdCode}`, {
      headers: { Cookie: secondCookie },
    });
    assert.strictEqual(crossReadCodeRes.status, 403);

    const redirectRes = await fetch(`${base}/${createdCode}`, { redirect: 'manual' });
    assert.strictEqual(redirectRes.status, 302);
    assert.ok((redirectRes.headers.get('location') || '').includes('youtube.com/watch?v=dQw4w9WgXcQ'));
    console.log('[Pass 4] CSRF/CORS rejection, lt_session isolation & Smart Link 302 redirect verified');

    // 5. Verify ZERO secrets anywhere inside built dist-client assets
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
    console.log('[Pass 5] Zero secrets or legacy NVIDIA keys in dist-client bundles');

    console.log('\n🎉 ALL LINKTWIN THUMBNAIL + UPSCALER TESTS PASSED!');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runThumbnailAndUpscalerTests().catch((err) => {
  console.error('❌ THUMBNAIL / UPSCALER TEST FAILED:', err);
  process.exit(1);
});
