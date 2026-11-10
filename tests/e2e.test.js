import assert from 'assert';

async function runTests() {
  console.log('=== STARTING COMPREHENSIVE MULTI-PLATFORM E2E SUITE ===');

  try {
    // Test 1: Frontend SPA
    const homeRes = await fetch('http://localhost:3000');
    const homeHtml = await homeRes.text();
    assert.strictEqual(homeRes.status, 200);
    assert.ok(homeHtml.includes('LinkTwin'));
    console.log('[Pass 1] Frontend SPA served');

    // Test 2: YouTube Video + Backward Compatibility
    const ytRes = await fetch('http://localhost:3000/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    });
    const ytData = await ytRes.json();
    assert.strictEqual(ytRes.status, 201);
    assert.strictEqual(ytData.link.platform, 'youtube');
    assert.strictEqual(ytData.link.url_type, 'video');
    console.log('[Pass 2] YouTube Video created:', ytData.link.code);

    // Test 3: YouTube Shorts
    const shortsRes = await fetch('http://localhost:3000/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/shorts/5-x1qKq2f1Q' }),
    });
    const shortsData = await shortsRes.json();
    assert.strictEqual(shortsRes.status, 201);
    assert.strictEqual(shortsData.link.platform, 'youtube');
    assert.strictEqual(shortsData.link.url_type, 'shorts');
    assert.ok(shortsData.parsed.androidIntentUrl.includes('shorts'));
    console.log('[Pass 3] YouTube Shorts created:', shortsData.link.code);

    // Test 4: Instagram Reel + Android Intent + iOS Universal Link
    const igRes = await fetch('http://localhost:3000/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.instagram.com/reel/C0xample123/' }),
    });
    const igData = await igRes.json();
    assert.strictEqual(igRes.status, 201);
    assert.strictEqual(igData.link.platform, 'instagram');
    assert.strictEqual(igData.link.url_type, 'reel');
    assert.ok(igData.parsed.androidIntentUrl.includes('com.instagram.android'));
    assert.strictEqual(igData.parsed.iosPreferUniversalLink, true);
    console.log('[Pass 4] Instagram Reel created:', igData.link.code);

    // Test 5: Facebook Reel / Watch Video
    const fbRes = await fetch('http://localhost:3000/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.facebook.com/watch/?v=10153231379946729' }),
    });
    const fbData = await fbRes.json();
    assert.strictEqual(fbRes.status, 201);
    assert.strictEqual(fbData.link.platform, 'facebook');
    assert.strictEqual(fbData.link.url_type, 'video');
    assert.ok(fbData.parsed.androidIntentUrl.includes('com.facebook.katana'));
    console.log('[Pass 5] Facebook Video created:', fbData.link.code);

    // Test 6: Reject unsupported domain
    const badRes = await fetch('http://localhost:3000/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://malicious-phishing-site.com/login' }),
    });
    assert.strictEqual(badRes.status, 400);
    console.log('[Pass 6] Unsupported URL blocked (400)');

    // Test 7: WhatsApp OpenGraph on Instagram & Facebook links
    const igWa = await fetch('http://localhost:3000/' + igData.link.code, {
      headers: { 'User-Agent': 'WhatsApp/2.21.4.18 A' },
    });
    const igWaHtml = await igWa.text();
    assert.ok(igWaHtml.includes('property="og:title"') && igWaHtml.includes('com.instagram.android'));

    const fbWa = await fetch('http://localhost:3000/' + fbData.link.code, {
      headers: { 'User-Agent': 'TelegramBot (like TwitterBot)' },
    });
    const fbWaHtml = await fbWa.text();
    assert.ok(fbWaHtml.includes('property="og:title"') && fbWaHtml.includes('com.facebook.katana'));
    console.log('[Pass 7] WhatsApp & Telegram OpenGraph previews verified for IG & FB');

    // Test 8: Mobile Android & iOS Redirections + Country header tracking
    const androidIg = await fetch('http://localhost:3000/' + igData.link.code, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/122.0.0.0 Mobile Safari/537.36',
        'x-vercel-ip-country': 'IN',
        'referer': 'https://www.whatsapp.com/',
      },
      redirect: 'manual',
    });
    const androidIgHtml = await androidIg.text();
    assert.ok(androidIgHtml.includes('intent://') && androidIgHtml.includes('Open in Instagram App'));

    const iosFb = await fetch('http://localhost:3000/' + fbData.link.code, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
        'x-vercel-ip-country': 'US',
      },
      redirect: 'manual',
    });
    const iosFbHtml = await iosFb.text();
    assert.ok(iosFbHtml.includes('fb://facewebmodal/f') && iosFbHtml.includes('Open in Facebook App'));
    console.log('[Pass 8] Android & iOS mobile redirect pages verified');

    // Test 9: Desktop 302 instant redirect
    const desktopFb = await fetch('http://localhost:3000/' + fbData.link.code, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0' },
      redirect: 'manual',
    });
    assert.strictEqual(desktopFb.status, 302);
    assert.ok((desktopFb.headers.get('location') || '').includes('facebook.com'));
    console.log('[Pass 9] Desktop 302 redirect verified');

    await new Promise((r) => setTimeout(r, 250));

    // Test 10: Advanced Analytics (Devices, Browsers, Countries, Referrers) & Global Summary
    const statsRes = await fetch('http://localhost:3000/api/links/' + igData.link.code + '/stats');
    const statsData = await statsRes.json();
    assert.ok(statsData.stats.totalClicks >= 1);
    assert.strictEqual(statsData.stats.countries['IN'], 1);
    assert.ok(Object.keys(statsData.stats.browsers).length >= 1);

    const summaryRes = await fetch('http://localhost:3000/api/links/summary');
    const summaryData = await summaryRes.json();
    assert.ok(summaryData.summary.byPlatform.youtube.links >= 1);
    assert.ok(summaryData.summary.byPlatform.instagram.links >= 1);
    assert.ok(summaryData.summary.byPlatform.facebook.links >= 1);
    console.log('[Pass 10] Advanced analytics & platform summary verified');

    // Test 11: Thumbnail Studio API (YouTube & IG public preview thumbnails)
    const mediaYt = await fetch('http://localhost:3000/api/media/thumbnail/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    });
    const mediaYtData = await mediaYt.json();
    assert.strictEqual(mediaYt.status, 200);
    assert.strictEqual(mediaYtData.permittedAssets.length, 3);
    assert.ok(mediaYtData.thumbnailInfo.proxyUrl.includes('/api/media/thumbnail'));

    const thumbRes = await fetch('http://localhost:3000/api/media/thumbnail?videoId=dQw4w9WgXcQ&quality=hq');
    assert.strictEqual(thumbRes.status, 200);
    assert.strictEqual(thumbRes.headers.get('content-type'), 'image/jpeg');

    const mediaIg = await fetch('http://localhost:3000/api/media/thumbnail/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.instagram.com/reel/C0xample123/' }),
    });
    const mediaIgData = await mediaIg.json();
    assert.strictEqual(mediaIg.status, 200);
    assert.strictEqual(mediaIgData.platform, 'instagram');
    assert.ok(mediaIgData.publicAccessNote.length > 20);
    console.log('[Pass 11] Thumbnail Studio API & safe thumbnail download verified');

    console.log('=== ALL 11 MULTI-PLATFORM E2E TESTS PASSED ===');
  } catch (err) {
    console.error('E2E Test Failed:', err);
    process.exit(1);
  }
}

runTests();
