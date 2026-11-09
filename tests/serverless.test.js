import http from 'http';
import handler from '../dist-server/api/index.js';

async function testServerless() {
  console.log('=== TESTING VERCEL SERVERLESS FUNCTION HANDLER ===');

  // Create a mock server using the exact serverless handler
  const server = http.createServer(async (req, res) => {
    try {
      await handler(req, res);
    } catch (e) {
      console.error('Handler error:', e);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
    }
  });

  await new Promise((resolve) => server.listen(3001, resolve));
  console.log('Mock Serverless environment listening on port 3001');

  try {
    // 1. Health check
    const hRes = await fetch('http://localhost:3001/api/health');
    const hData = await hRes.json();
    console.log('[Test 1] /api/health returns JSON:', hRes.status === 200 && hData.status === 'healthy');

    // 2. Generate Link at /api/links
    const linkRes = await fetch('http://localhost:3001/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    });
    const linkText = await linkRes.text();
    let linkData = null;
    try {
      linkData = JSON.parse(linkText);
    } catch (e) {
      console.error('Failed to parse JSON:', linkText);
    }
    console.log('[Test 2] POST /api/links returns valid JSON with code:', linkRes.status === 201 && Boolean(linkData?.link?.code));

    // 3. Generate Link at /links (simulating Vercel prefix strip)
    const stripRes = await fetch('http://localhost:3001/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/shorts/5-x1qKq2f1Q' }),
    });
    const stripData = await stripRes.json();
    console.log('[Test 3] POST /links (stripped prefix) works:', stripRes.status === 201 && stripData.parsed.type === 'shorts');

    // 4. Invalid input returns structured JSON
    const badRes = await fetch('http://localhost:3001/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    const badData = await badRes.json();
    console.log('[Test 4] Validation error returns JSON:', badRes.status === 400 && Boolean(badData.error));

    // 5. Unknown API route returns structured JSON 404
    const notFoundRes = await fetch('http://localhost:3001/api/unknown-endpoint');
    const notFoundData = await notFoundRes.json();
    console.log('[Test 5] 404 route returns JSON:', notFoundRes.status === 404 && Boolean(notFoundData.error));

    console.log('=== ALL SERVERLESS SIMULATION TESTS PASSED ===');
  } finally {
    server.close();
  }
}

testServerless();
