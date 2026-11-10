import http from 'http';
import assert from 'assert';
import handler from '../dist-server/api/index.js';

async function testServerless() {
  console.log('=== TESTING VERCEL SERVERLESS FUNCTION HANDLER ===');

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

  const prevSecret = process.env.SESSION_SECRET;
  const prevTursoToken = process.env.TURSO_AUTH_TOKEN;

  try {
    // Ensure missing SESSION_SECRET in Vercel mode fails safely with 503 even if TURSO_AUTH_TOKEN is set
    delete process.env.SESSION_SECRET;
    process.env.TURSO_AUTH_TOKEN = 'turso-db-token-should-never-be-used-for-sessions';

    const misconfRes = await fetch('http://localhost:3001/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    });
    const misconfData = await misconfRes.json();
    assert.strictEqual(misconfRes.status, 503);
    assert.ok(String(misconfData.error || '').includes('SESSION_SECRET'));
    console.log('[Test 0] Missing SESSION_SECRET in Vercel mode fails safely with 503:', true);

    // Configure valid 32+ char SESSION_SECRET
    process.env.SESSION_SECRET = 'prod_vercel_session_secret_at_least_32_characters_long_12345';

    // 1. Health check
    const hRes = await fetch('http://localhost:3001/api/health');
    const hData = await hRes.json();
    console.log(
      '[Test 1] /api/health returns JSON & sessionConfigured:',
      hRes.status === 200 && hData.status === 'healthy' && hData.capabilities.sessionConfigured === true
    );
    assert.strictEqual(hRes.status, 200);
    assert.strictEqual(hData.capabilities.sessionConfigured, true);

    // 2. Generate Link at /api/links + verify no wildcard CORS leaked
    const linkRes = await fetch('http://localhost:3001/api/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'localhost:3001',
      },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    });
    const linkText = await linkRes.text();
    const linkData = JSON.parse(linkText);
    assert.strictEqual(linkRes.status, 201);
    assert.ok(Boolean(linkData?.link?.code));
    assert.strictEqual(linkRes.headers.get('access-control-allow-origin'), null);
    console.log('[Test 2] POST /api/links returns valid JSON with code:', true);

    // 3. Generate Link at /links (simulating Vercel prefix strip)
    const stripRes = await fetch('http://localhost:3001/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/shorts/5-x1qKq2f1Q' }),
    });
    const stripData = await stripRes.json();
    assert.strictEqual(stripRes.status, 201);
    assert.strictEqual(stripData.parsed.type, 'shorts');
    console.log('[Test 3] POST /links (stripped prefix) works:', true);

    // 4. Invalid input returns structured JSON
    const badRes = await fetch('http://localhost:3001/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    const badData = await badRes.json();
    assert.strictEqual(badRes.status, 400);
    assert.ok(Boolean(badData.error));
    console.log('[Test 4] Validation error returns JSON:', true);

    // 5. Unknown API route returns structured JSON 404
    const notFoundRes = await fetch('http://localhost:3001/api/unknown-endpoint');
    const notFoundData = await notFoundRes.json();
    assert.strictEqual(notFoundRes.status, 404);
    assert.ok(Boolean(notFoundData.error));
    console.log('[Test 5] 404 route returns JSON:', true);

    console.log('=== ALL SERVERLESS SIMULATION TESTS PASSED ===');
  } finally {
    if (prevSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSecret;
    if (prevTursoToken === undefined) delete process.env.TURSO_AUTH_TOKEN;
    else process.env.TURSO_AUTH_TOKEN = prevTursoToken;
    server.close();
  }
}

testServerless().catch((err) => {
  console.error('❌ SERVERLESS TEST FAILED:', err);
  process.exit(1);
});
