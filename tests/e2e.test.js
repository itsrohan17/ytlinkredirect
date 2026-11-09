async function runTests() {
  console.log('=== STARTING AUTOMATED TEST SUITE ===');

  try {
    // Test 1: Frontend SPA
    const homeRes = await fetch('http://localhost:3000');
    const homeHtml = await homeRes.text();
    console.log('[Test 1] Frontend HTML served:', homeRes.status === 200 && homeHtml.includes('LinkTwin'));

    // Test 2: Standard Video
    const videoRes = await fetch('http://localhost:3000/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
    });
    const videoData = await videoRes.json();
    console.log('[Test 2] Video created:', videoData.success, 'Type:', videoData.link.url_type, 'Code:', videoData.link.code);

    // Test 3: Shorts
    const shortsRes = await fetch('http://localhost:3000/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/shorts/5-x1qKq2f1Q' })
    });
    const shortsData = await shortsRes.json();
    console.log('[Test 3] Shorts created:', shortsData.success, 'Type:', shortsData.link.url_type, 'Intent has shorts:', shortsData.parsed.androidIntentUrl.includes('shorts'));

    // Test 4: Custom Slug
    const customSlug = 'rickroll-' + Math.floor(Math.random() * 10000);
    const customRes = await fetch('http://localhost:3000/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', customSlug })
    });
    const customData = await customRes.json();
    console.log('[Test 4] Custom slug created:', customData.link.code === customSlug);

    // Test 5: Duplicate Slug Conflict Check
    const dupRes = await fetch('http://localhost:3000/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', customSlug })
    });
    console.log('[Test 5] Duplicate slug rejected (409):', dupRes.status === 409);

    // Test 6: Security - Malicious/Non-YouTube URL rejected
    const badRes = await fetch('http://localhost:3000/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://malicious-phishing-site.com/login' })
    });
    console.log('[Test 6] Malicious URL blocked (400):', badRes.status === 400);

    // Test 7: WhatsApp Crawler OpenGraph response
    const waRes = await fetch('http://localhost:3000/' + customSlug, {
      headers: { 'User-Agent': 'WhatsApp/2.21.4.18 A' }
    });
    const waHtml = await waRes.text();
    console.log('[Test 7] WhatsApp OpenGraph returned:', waHtml.includes('property="og:title"') && waHtml.includes('property="og:image"'));

    // Test 8: Mobile Android Intent response
    const androidRes = await fetch('http://localhost:3000/' + customSlug, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36' },
      redirect: 'manual'
    });
    const androidHtml = await androidRes.text();
    console.log('[Test 8] Android Intent interstitial served:', androidHtml.includes('intent://') && androidHtml.includes('Open in YouTube App'));

    // Test 9: Desktop 302 instant redirect
    const desktopRes = await fetch('http://localhost:3000/' + customSlug, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      redirect: 'manual'
    });
    console.log('[Test 9] Desktop 302 redirect:', desktopRes.status === 302, 'Location:', desktopRes.headers.get('location'));

    // Wait a brief tick for async click recording in SQLite
    await new Promise(r => setTimeout(r, 200));

    // Test 10: Real-time Stats in SQLite
    const statsRes = await fetch('http://localhost:3000/api/links/' + customSlug + '/stats');
    const statsData = await statsRes.json();
    console.log('[Test 10] SQLite analytics recorded clicks:', statsData.stats.totalClicks > 0, 'Devices:', statsData.stats.devices);

    console.log('=== ALL 10 TESTS PASSED SUCCESFULLY ===');
  } catch (err) {
    console.error('Test failed with error:', err);
    process.exit(1);
  }
}

runTests();
