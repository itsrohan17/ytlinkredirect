import assert from 'assert';
import http from 'http';
import { app } from '../server/app.js';
import { initDb } from '../server/db.js';

function extractLtSessionCookie(res: Response): string {
  const sc = res.headers.get('set-cookie') || '';
  const m = sc.match(/lt_session=([a-f0-9]{48,64})/);
  assert.ok(m && m[1], `Expected valid 256-bit hex lt_session cookie, got: ${sc}`);
  return `lt_session=${m[1]}`;
}

async function runPhase51SecurityAuditTests() {
  console.log('=== STARTING PHASE 5.1 PRIVACY & SECURITY AUDIT TESTS ===');

  const db = await initDb(':memory:');

  // Seed legacy unowned link + legacy click
  await db.execute({
    sql: `INSERT INTO links (
      code, platform, original_url, clean_youtube_url, url_type, content_id, title, author_name, thumbnail_url, created_at, click_count
    ) VALUES ('legacy_pub', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'video', 'dQw4w9WgXcQ', 'Legacy YT Video', 'Legacy', '', datetime('now', '-20 days'), 1)`,
    args: [],
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3008, resolve));
  const base = 'http://localhost:3008';

  try {
    // 1. Session A creates YT link; validate HttpOnly, SameSite=Lax, Path=/, Max-Age=604800, 64-hex token
    const resA = await fetch(`${base}/api/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-proto': 'https',
      },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    });
    assert.strictEqual(resA.status, 201);
    const setCookieA = resA.headers.get('set-cookie') || '';
    assert.ok(setCookieA.includes('HttpOnly'), 'Cookie must be HttpOnly');
    assert.ok(setCookieA.includes('SameSite=Lax'), 'Cookie must be SameSite=Lax');
    assert.ok(setCookieA.includes('Path=/'), 'Cookie must set Path=/');
    assert.ok(setCookieA.includes('Max-Age=604800'), 'Cookie must have 7-day Max-Age');
    assert.ok(setCookieA.includes('Secure'), 'HTTPS forwarded request must set Secure cookie');

    const cookieA = extractLtSessionCookie(resA);
    const bodyA: any = await resA.json();
    const codeA = bodyA.link.code;
    assert.strictEqual(bodyA.link.owner_token_hash, undefined, 'Never leak owner_token_hash in JSON');

    // Create a media job under Session A to verify jobs isolation too
    const jobResA = await fetch(`${base}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        module: 'image-studio',
        processingMode: 'browser-canvas',
        inputFilename: 'secret-client-contract.png',
        inputMime: 'image/png',
        inputSize: 4096,
        outputFormat: 'webp',
        outputSize: 2048,
        headerHex: '89504e470d0a1a0a',
        category: 'image',
      }),
    });
    assert.strictEqual(jobResA.status, 201);
    console.log('[Pass 1 & 9] Session A created with 256-bit HttpOnly/SameSite/Secure cookie & media job');

    // 2. Independent Session B creates Instagram link
    const resB = await fetch(`${base}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.instagram.com/reel/C0xample123/' }),
    });
    assert.strictEqual(resB.status, 201);
    const cookieB = extractLtSessionCookie(resB);
    assert.notStrictEqual(cookieA, cookieB, 'Session A and B tokens must be distinct');
    const bodyB: any = await resB.json();
    const codeB = bodyB.link.code;
    console.log('[Pass 2] Independent Session B created distinct workspace token');

    // 3. Unauthenticated & malformed cookie checks across ALL private endpoints
    const privateEndpoints = [
      '/api/links',
      '/api/links/recent',
      '/api/links/summary',
      '/api/links/analytics',
      `/api/links/${codeA}`,
      `/api/links/${codeA}/stats`,
      '/api/jobs/summary',
    ];
    for (const ep of privateEndpoints) {
      const rNoCookie = await fetch(`${base}${ep}`);
      assert.strictEqual(rNoCookie.status, 401, `Expected 401 unauthenticated for ${ep}`);

      const rBadCookie = await fetch(`${base}${ep}`, {
        headers: { Cookie: 'lt_session=short_malformed_token' },
      });
      assert.strictEqual(rBadCookie.status, 401, `Expected 401 malformed cookie for ${ep}`);
    }
    console.log('[Pass 5] All private dashboard & analytics endpoints block unauthenticated/malformed requests (401)');

    // 4. Cross-Session Read Isolation (Session A vs Session B)
    const listA: any = await fetch(`${base}/api/links`, { headers: { Cookie: cookieA } }).then((r) => r.json());
    assert.strictEqual(listA.links.length, 1);
    assert.strictEqual(listA.links[0].code, codeA);

    const listB: any = await fetch(`${base}/api/links`, { headers: { Cookie: cookieB } }).then((r) => r.json());
    assert.strictEqual(listB.links.length, 1);
    assert.strictEqual(listB.links[0].code, codeB);

    // Direct access cross-session -> 403
    assert.strictEqual((await fetch(`${base}/api/links/${codeB}`, { headers: { Cookie: cookieA } })).status, 403);
    assert.strictEqual((await fetch(`${base}/api/links/${codeB}/stats`, { headers: { Cookie: cookieA } })).status, 403);
    assert.strictEqual((await fetch(`${base}/api/links/${codeA}`, { headers: { Cookie: cookieB } })).status, 403);
    assert.strictEqual((await fetch(`${base}/api/links/${codeA}/stats`, { headers: { Cookie: cookieB } })).status, 403);

    // Job summary isolation (Session B cannot see Session A's secret-client-contract.png)
    const jobSumB: any = await fetch(`${base}/api/jobs/summary`, { headers: { Cookie: cookieB } }).then((r) => r.json());
    assert.strictEqual(jobSumB.summary.totalJobs, 0);
    assert.strictEqual(jobSumB.recentJobs.length, 0);

    // Cross-session PATCH & DELETE -> 403
    assert.strictEqual(
      (
        await fetch(`${base}/api/links/${codeA}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: cookieB },
          body: JSON.stringify({ title: 'Cross-Session Tamper' }),
        })
      ).status,
      403
    );
    assert.strictEqual(
      (await fetch(`${base}/api/links/${codeB}`, { method: 'DELETE', headers: { Cookie: cookieA } })).status,
      403
    );
    console.log('[Pass 3 & 4] Strict bidirectional data & write isolation verified between Session A and B');

    // 5. Public Redirects still work WITHOUT any cookie (Session A, B & Legacy) + Analytics Isolation
    const redirA = await fetch(`${base}/${codeA}`, {
      headers: { 'x-vercel-ip-country': 'DE' },
      redirect: 'manual',
    });
    assert.strictEqual(redirA.status, 302);

    const redirLegacy = await fetch(`${base}/legacy_pub`, { redirect: 'manual' });
    assert.strictEqual(redirLegacy.status, 302);

    await new Promise((r) => setTimeout(r, 150));

    const anaA: any = await fetch(`${base}/api/links/analytics?range=30d`, {
      headers: { Cookie: cookieA },
    }).then((r) => r.json());
    assert.strictEqual(anaA.analytics.totalClicksInRange, 1);
    assert.strictEqual(anaA.analytics.geo.countries[0].country, 'DE');

    const anaB: any = await fetch(`${base}/api/links/analytics?range=30d`, {
      headers: { Cookie: cookieB },
    }).then((r) => r.json());
    assert.strictEqual(anaB.analytics.totalClicksInRange, 0, 'Session B must see 0 clicks from Session A redirect');
    assert.strictEqual(anaB.analytics.topLinks.length, 1);
    assert.strictEqual(anaB.analytics.topLinks[0].code, codeB);
    assert.ok(!JSON.stringify(anaA).includes('ip_hash'));
    console.log('[Pass 6 & 7] Public redirects work anonymously; analytics strictly isolated per session');

    // 6. Legacy links remain inaccessible/read-only from all dashboards
    for (const c of [cookieA, cookieB]) {
      assert.strictEqual((await fetch(`${base}/api/links/legacy_pub`, { headers: { Cookie: c } })).status, 403);
      assert.strictEqual((await fetch(`${base}/api/links/legacy_pub/stats`, { headers: { Cookie: c } })).status, 403);
      assert.strictEqual(
        (
          await fetch(`${base}/api/links/legacy_pub`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Cookie: c },
            body: JSON.stringify({ title: 'Claim Legacy' }),
          })
        ).status,
        403
      );
      assert.strictEqual(
        (await fetch(`${base}/api/links/legacy_pub`, { method: 'DELETE', headers: { Cookie: c } })).status,
        403
      );
    }
    console.log('[Pass 8] Legacy unowned links remain protected & read-only across all sessions');

    // 7. Session Rotation Security Check
    const rotRes = await fetch(`${base}/api/links/session/rotate`, {
      method: 'POST',
      headers: { Cookie: cookieA },
    });
    assert.strictEqual(rotRes.status, 200);
    const rotatedCookieA = extractLtSessionCookie(rotRes);
    assert.notStrictEqual(rotatedCookieA, cookieA);

    // Old cookieA must see 0 links after rotation; rotatedCookieA sees codeA
    const afterRotOld: any = await fetch(`${base}/api/links`, { headers: { Cookie: cookieA } }).then((r) => r.json());
    assert.strictEqual(afterRotOld.links.length, 0, 'Old session token invalidated after rotation');

    const afterRotNew: any = await fetch(`${base}/api/links`, { headers: { Cookie: rotatedCookieA } }).then((r) => r.json());
    assert.strictEqual(afterRotNew.links.length, 1);
    assert.strictEqual(afterRotNew.links[0].code, codeA);
    console.log('[Pass 9b] Session token rotation migrated ownership & invalidated prior token');

    // 8. CSRF & CORS Cross-Origin Protections on Mutations
    const csrfOrigin = await fetch(`${base}/api/links/${codeA}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: rotatedCookieA,
        Origin: 'https://evil-attacker.example',
      },
      body: JSON.stringify({ title: 'CSRF Overwrite' }),
    });
    assert.strictEqual(csrfOrigin.status, 403);

    const csrfFetchSite = await fetch(`${base}/api/links/${codeA}`, {
      method: 'DELETE',
      headers: {
        Cookie: rotatedCookieA,
        'Sec-Fetch-Site': 'cross-site',
      },
    });
    assert.strictEqual(csrfFetchSite.status, 403);

    const corsProbe = await fetch(`${base}/api/links`, {
      headers: {
        Origin: 'https://evil-attacker.example',
        Cookie: rotatedCookieA,
      },
    });
    assert.strictEqual(corsProbe.headers.get('access-control-allow-origin'), null, 'No wildcard/evil CORS grant');
    console.log('[Pass 10] CSRF same-origin enforcement & CORS rejection verified');

    console.log('\n🎉 ALL PHASE 5.1 PRIVACY & SECURITY AUDIT TESTS PASSED!');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runPhase51SecurityAuditTests().catch((err) => {
  console.error('❌ PHASE 5.1 SECURITY TEST FAILED:', err);
  process.exit(1);
});
