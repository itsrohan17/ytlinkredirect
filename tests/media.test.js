import assert from 'assert';

async function runMediaTests() {
  console.log('=== STARTING MEDIA STUDIO API VERIFICATION ===');

  // 1. Modular Media Studio Capabilities Endpoints
  const [vidCap, imgCap, audCap] = await Promise.all([
    fetch('http://localhost:3000/api/media/video').then((r) => r.json()),
    fetch('http://localhost:3000/api/media/image').then((r) => r.json()),
    fetch('http://localhost:3000/api/media/audio').then((r) => r.json()),
  ]);
  assert.strictEqual(vidCap.module, 'video-converter');
  assert.ok(vidCap.supportedOutputs.includes('mp4'));
  assert.strictEqual(imgCap.module, 'image-studio');
  assert.ok(imgCap.supportedFormats.includes('webp'));
  assert.strictEqual(audCap.module, 'audio-studio');
  assert.ok(audCap.supportedOutputs.includes('mp3'));
  console.log('[Pass 1] Video, Image & Audio capability endpoints verified');

  // 2. YouTube Thumbnail Inspect
  const ytRes = await fetch('http://localhost:3000/api/media/thumbnail/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
  });
  const ytData = await ytRes.json();
  assert.strictEqual(ytRes.status, 200);
  assert.strictEqual(ytData.platform, 'youtube');
  assert.strictEqual(ytData.videoDownloadInfo, undefined);
  assert.ok(ytData.thumbnailInfo.proxyUrl.includes('/api/media/thumbnail'));
  assert.strictEqual(ytData.permittedAssets.length, 3);
  console.log('[Pass 2] YouTube Thumbnail Studio inspection verified');

  // 3. Instagram & Facebook Thumbnail Inspect
  const igRes = await fetch('http://localhost:3000/api/media/thumbnail/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://www.instagram.com/reel/C0xample123/' }),
  });
  const igData = await igRes.json();
  assert.strictEqual(igRes.status, 200);
  assert.strictEqual(igData.platform, 'instagram');
  assert.ok(igData.thumbnailInfo.proxyUrl.includes('/api/media/image-proxy'));

  const fbRes = await fetch('http://localhost:3000/api/media/thumbnail/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://www.facebook.com/watch/?v=10153231379946729' }),
  });
  const fbData = await fbRes.json();
  assert.strictEqual(fbRes.status, 200);
  assert.strictEqual(fbData.platform, 'facebook');
  console.log('[Pass 3] Instagram & Facebook public thumbnail inspection verified');

  // 4. Unsupported URL rejected
  const badRes = await fetch('http://localhost:3000/api/media/thumbnail/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://vimeo.com/123456' }),
  });
  assert.strictEqual(badRes.status, 400);
  console.log('[Pass 4] Unsupported domain rejected (400)');

  // 5. YouTube Thumbnail Retrieval & CORS inline mode
  const thumbInline = await fetch(
    'http://localhost:3000/api/media/thumbnail?videoId=dQw4w9WgXcQ&quality=maxres&inline=1'
  );
  assert.strictEqual(thumbInline.status, 200);
  assert.strictEqual(thumbInline.headers.get('content-type'), 'image/jpeg');
  assert.strictEqual(thumbInline.headers.get('access-control-allow-origin'), '*');
  const buf = await thumbInline.arrayBuffer();
  assert.ok(buf.byteLength > 1000);
  console.log('[Pass 5] YouTube thumbnail inline CORS retrieval verified:', buf.byteLength, 'bytes');

  // 6. SSRF & Security checks on proxies (no video-proxy should exist)
  const ssrfThumb = await fetch('http://localhost:3000/api/media/thumbnail?videoId=../../etc/passwd');
  assert.strictEqual(ssrfThumb.status, 400);

  const ssrfImg = await fetch('http://localhost:3000/api/media/image-proxy?url=http://127.0.0.1:3000/health');
  assert.strictEqual(ssrfImg.status, 403);

  const removedVidProxy = await fetch('http://localhost:3000/api/media/video-proxy?url=https://example.com/a.mp4');
  assert.strictEqual(removedVidProxy.status, 404);
  console.log('[Pass 6] SSRF protections verified & social video-proxy removed (404)');

  console.log('=== ALL MEDIA STUDIO API TESTS PASSED ===');
}

runMediaTests().catch((err) => {
  console.error('Media Test Failed:', err);
  process.exit(1);
});
