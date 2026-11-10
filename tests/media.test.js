import assert from 'assert';

async function runMediaTests() {
  console.log('=== STARTING MEDIA TOOLS INDEPENDENT VERIFICATION ===');

  // 1. YouTube Media Inspect
  const ytRes = await fetch('http://localhost:3000/api/media/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
  });
  const ytData = await ytRes.json();
  assert.strictEqual(ytRes.status, 200);
  assert.strictEqual(ytData.platform, 'youtube');
  assert.strictEqual(ytData.videoDownloadInfo.supported, false);
  assert.strictEqual(ytData.videoDownloadInfo.availableStreams.length, 0);
  assert.ok(ytData.videoDownloadInfo.unsupportedReason.includes('YouTube Studio'));
  assert.ok(ytData.thumbnailInfo.proxyUrl.includes('/api/media/thumbnail'));
  assert.ok(ytData.embedCode.includes('youtube-nocookie.com'));
  console.log('[Pass 1] YouTube inspection & honest DRM/signature notice verified');

  // 2. Instagram Media Inspect
  const igRes = await fetch('http://localhost:3000/api/media/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://www.instagram.com/reel/C0xample123/' }),
  });
  const igData = await igRes.json();
  assert.strictEqual(igRes.status, 200);
  assert.strictEqual(igData.platform, 'instagram');
  assert.ok(igData.officialOwnerGuide.officialUrl.includes('instagram.com'));
  assert.ok(igData.thumbnailInfo.proxyUrl.includes('/api/media/image-proxy'));
  assert.ok(igData.embedCode.includes('instagram-media'));
  console.log('[Pass 2] Instagram inspection & official owner guide verified');

  // 3. Facebook Media Inspect
  const fbRes = await fetch('http://localhost:3000/api/media/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://www.facebook.com/watch/?v=10153231379946729' }),
  });
  const fbData = await fbRes.json();
  assert.strictEqual(fbRes.status, 200);
  assert.strictEqual(fbData.platform, 'facebook');
  assert.ok(fbData.officialOwnerGuide.officialUrl.includes('business.facebook.com'));
  assert.ok(fbData.embedCode.includes('facebook.com/plugins/video.php'));
  console.log('[Pass 3] Facebook inspection & official owner guide verified');

  // 4. Unsupported URL rejected
  const badRes = await fetch('http://localhost:3000/api/media/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://vimeo.com/123456' }),
  });
  assert.strictEqual(badRes.status, 400);
  console.log('[Pass 4] Unsupported domain rejected (400)');

  // 5. YouTube Thumbnail Download & CORS inline mode
  const thumbInline = await fetch(
    'http://localhost:3000/api/media/thumbnail?videoId=dQw4w9WgXcQ&quality=maxres&inline=1'
  );
  assert.strictEqual(thumbInline.status, 200);
  assert.strictEqual(thumbInline.headers.get('content-type'), 'image/jpeg');
  assert.strictEqual(thumbInline.headers.get('access-control-allow-origin'), '*');
  const buf = await thumbInline.arrayBuffer();
  assert.ok(buf.byteLength > 1000);
  console.log('[Pass 5] YouTube thumbnail inline CORS fetch verified:', buf.byteLength, 'bytes');

  // 6. SSRF & Security checks on proxies
  const ssrfThumb = await fetch('http://localhost:3000/api/media/thumbnail?videoId=../../etc/passwd');
  assert.strictEqual(ssrfThumb.status, 400);

  const ssrfImg = await fetch('http://localhost:3000/api/media/image-proxy?url=http://127.0.0.1:3000/health');
  assert.strictEqual(ssrfImg.status, 403);

  const ssrfVid = await fetch('http://localhost:3000/api/media/video-proxy?url=https://evil.com/file.mp4');
  assert.strictEqual(ssrfVid.status, 403);
  console.log('[Pass 6] SSRF protections on thumbnail, image-proxy, and video-proxy verified');

  console.log('=== ALL MEDIA TOOLS TESTS PASSED ===');
}

runMediaTests().catch((err) => {
  console.error('Media Test Failed:', err);
  process.exit(1);
});
