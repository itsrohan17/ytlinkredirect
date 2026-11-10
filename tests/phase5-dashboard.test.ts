import assert from 'assert';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { app } from '../server/app.js';
import { initDb, recordClick } from '../server/db.js';
import {
  DEFAULT_PREFERENCES,
  loadUserPreferences,
  PREFERENCES_STORAGE_KEY,
  resetUserPreferences,
  saveUserPreferences,
} from '../client/src/utils/preferences.js';

async function runPhase5Tests() {
  console.log('=== STARTING PHASE 5 DASHBOARD & PRODUCT EXPERIENCE TESTS ===');

  // Initialize isolated in-memory database
  const db = await initDb(':memory:');

  // Seed 1 legacy link (no owner_token_hash) + an old historical click (45 days ago) to test range filters & ownership isolation
  await db.execute({
    sql: `INSERT INTO links (
      code, platform, original_url, clean_youtube_url, url_type, content_id, title, author_name, thumbnail_url, created_at, click_count
    ) VALUES ('legacy1', 'instagram', 'https://www.instagram.com/reel/Leg123/', 'https://www.instagram.com/reel/Leg123/', 'reel', 'Leg123', 'Legacy IG Reel', '@creator', '', datetime('now', '-50 days'), 1)`,
    args: [],
  });
  const legRes = await db.execute("SELECT id FROM links WHERE code = 'legacy1'");
  const legacyId = Number(legRes.rows[0].id);
  await db.execute({
    sql: `INSERT INTO clicks (link_id, code, platform, device_type, os_name, browser_name, is_in_app_browser, referrer, country, user_agent, created_at)
          VALUES (?, 'legacy1', 'instagram', 'ios', 'iOS', 'Instagram', 1, 'instagram.com', 'Unknown', 'Mozilla/5.0', datetime('now', '-45 days'))`,
    args: [legacyId],
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3007, resolve));
  const base = 'http://localhost:3007';

  try {
    // 1. Create two Smart Links in session A and capture HttpOnly lt_session cookie
    const createYt = await fetch(`${base}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    });
    assert.strictEqual(createYt.status, 201);
    const setCookieHeader = createYt.headers.get('set-cookie') || '';
    const sessionMatch = setCookieHeader.match(/lt_session=([^;]+)/);
    assert.ok(sessionMatch && sessionMatch[1], 'Expected lt_session HttpOnly cookie on link creation');
    const sessionCookie = `lt_session=${sessionMatch[1]}`;
    const ytData: any = await createYt.json();
    const ytCode = ytData.link.code;

    const createFb = await fetch(`${base}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ url: 'https://www.facebook.com/watch/?v=10153231379946729' }),
    });
    assert.strictEqual(createFb.status, 201);
    const fbData: any = await createFb.json();
    const fbCode = fbData.link.code;

    // Seed verified country click (recent) AND an older 45-day-old Unknown click on YT link to verify range filters
    await recordClick(
      {
        link_id: ytData.link.id,
        code: ytCode,
        platform: 'youtube',
        device_type: 'android',
        os_name: 'Android',
        browser_name: 'Chrome',
        is_in_app_browser: 0,
        referrer: 'youtube.com',
        country: 'US',
        user_agent: 'Android Chrome',
      },
      db
    );
    await db.execute({
      sql: `INSERT INTO clicks (link_id, code, platform, device_type, os_name, browser_name, is_in_app_browser, referrer, country, user_agent, created_at)
            VALUES (?, ?, 'youtube', 'ios', 'iOS', 'Safari', 0, 'Direct', 'Unknown', 'Mozilla/5.0', datetime('now', '-45 days'))`,
      args: [ytData.link.id, ytCode],
    });
    await db.execute({
      sql: 'UPDATE links SET click_count = click_count + 1 WHERE id = ?',
      args: [ytData.link.id],
    });
    console.log('[Pass 1] Seeded database metrics & session cookie isolation verified');

    // 2. Owner-scoped Summary matches Session A DB records (2 links created in session A, 2 clicks; legacy IG link excluded!)
    const sumRes = await fetch(`${base}/api/links/summary`, {
      headers: { Cookie: sessionCookie },
    });
    const sumJson: any = await sumRes.json();
    assert.strictEqual(sumRes.status, 200);
    assert.strictEqual(sumJson.summary.totalLinks, 2);
    assert.strictEqual(sumJson.summary.totalClicks, 2);
    assert.strictEqual(sumJson.summary.byPlatform.youtube.links, 1);
    assert.strictEqual(sumJson.summary.byPlatform.instagram.links, 0);
    assert.strictEqual(sumJson.summary.byPlatform.facebook.links, 1);
    console.log('[Pass 2] Dashboard overview summary strictly scoped to owner DB records');

    // 3. Paginated Listing, Search, Filter, Sort & Strict Legacy Exclusion
    const listAll = await fetch(`${base}/api/links?page=1&limit=1`, {
      headers: { Cookie: sessionCookie },
    });
    const listJson: any = await listAll.json();
    assert.strictEqual(listAll.status, 200);
    assert.strictEqual(listJson.links.length, 1);
    assert.strictEqual(listJson.pagination.total, 2);
    assert.strictEqual(listJson.pagination.totalPages, 2);
    assert.strictEqual(listJson.links[0].canManage, true);

    const searchFb = await fetch(`${base}/api/links?platform=facebook&q=${fbCode}`, {
      headers: { Cookie: sessionCookie },
    });
    const fbListJson: any = await searchFb.json();
    assert.strictEqual(fbListJson.links.length, 1);
    assert.strictEqual(fbListJson.links[0].code, fbCode);

    const legacyCheck = await fetch(`${base}/api/links?platform=instagram`, {
      headers: { Cookie: sessionCookie },
    });
    const legacyJson: any = await legacyCheck.json();
    assert.strictEqual(legacyJson.links.length, 0, 'Unowned legacy link must NOT appear in session dashboard');
    console.log('[Pass 3] Owner-scoped paginated listing, search, filter & legacy exclusion verified');

    // 4. Edit & Delete Authorization + Short Code Redirect Preservation
    // 4a. Unauthenticated PATCH returns 401; legacy DELETE returns 403
    const unauthPatch = await fetch(`${base}/api/links/${ytCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hijacked Title' }),
    });
    assert.strictEqual(unauthPatch.status, 401);

    const legacyDelete = await fetch(`${base}/api/links/legacy1`, {
      method: 'DELETE',
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(legacyDelete.status, 403);

    // 4b. Invalid platform destination URL rejected with 400
    const badEdit = await fetch(`${base}/api/links/${ytCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ originalUrl: 'https://evil-phishing.example.com/' }),
    });
    assert.strictEqual(badEdit.status, 400);

    // 4c. Authorized owner edit preserves short code and click count
    const okEdit = await fetch(`${base}/api/links/${ytCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ title: 'Updated Creator Video Title' }),
    });
    assert.strictEqual(okEdit.status, 200);
    const editedJson: any = await okEdit.json();
    assert.strictEqual(editedJson.link.code, ytCode);
    assert.strictEqual(editedJson.link.title, 'Updated Creator Video Title');

    // Existing redirect URL still resolves publicly without session cookie
    const redirectRes = await fetch(`${base}/${ytCode}`, { redirect: 'manual' });
    assert.strictEqual(redirectRes.status, 302);

    // 4d. Authorized owner delete removes link cleanly
    const delFb = await fetch(`${base}/api/links/${fbCode}`, {
      method: 'DELETE',
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(delFb.status, 200);
    const getDeleted = await fetch(`${base}/api/links/${fbCode}`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(getDeleted.status, 404);
    console.log('[Pass 4] Edit/Delete authorization, redirect preservation & 401/403 guards verified');

    // 5. Aggregated Analytics Date-Range Filters & Honest Geo Telemetry
    const ana7dRes = await fetch(`${base}/api/links/analytics?range=7d`, {
      headers: { Cookie: sessionCookie },
    });
    const ana7d: any = await ana7dRes.json();
    assert.strictEqual(ana7dRes.status, 200);
    assert.strictEqual(ana7d.analytics.totalClicksInRange, 2); // 1 seeded US + 1 redirect check
    assert.strictEqual(ana7d.analytics.geo.hasReliableGeoData, true);
    assert.strictEqual(ana7d.analytics.geo.knownGeoClicks, 1);
    assert.strictEqual(ana7d.analytics.geo.unknownGeoClicks, 1);

    const anaAllRes = await fetch(`${base}/api/links/analytics?range=all`, {
      headers: { Cookie: sessionCookie },
    });
    const anaAll: any = await anaAllRes.json();
    assert.strictEqual(anaAll.analytics.totalClicksInRange, 3); // Includes 45-day-old click on YT link, excludes legacy1
    assert.strictEqual(anaAll.analytics.geo.unknownGeoClicks, 2);
    console.log('[Pass 5] SQL analytics aggregation, date-range filters & honest geo attribution verified');

    // 6. Server Capabilities Health Telemetry (Zero Secrets)
    delete process.env.S3_BUCKET;
    process.env.TURSO_AUTH_TOKEN = 'super-secret-turso-token-xyz';
    process.env.S3_SECRET_ACCESS_KEY = 'super-secret-s3-key-abc';

    const healthRes = await fetch(`${base}/api/health`);
    const healthText = await healthRes.text();
    const healthJson = JSON.parse(healthText);
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthJson.capabilities.objectStorageConfigured, false);
    assert.ok(typeof healthJson.capabilities.limits.browserWasmMaxMb === 'number');
    assert.ok(!healthText.includes('super-secret-turso-token-xyz'));
    assert.ok(!healthText.includes('super-secret-s3-key-abc'));

    // Also verify built frontend bundle contains zero secret strings
    const distClientDir = path.resolve(process.cwd(), 'dist-client/assets');
    if (fs.existsSync(distClientDir)) {
      const jsFiles = fs.readdirSync(distClientDir).filter((f) => f.endsWith('.js'));
      for (const f of jsFiles) {
        const content = fs.readFileSync(path.join(distClientDir, f), 'utf8');
        assert.ok(!content.includes('TURSO_AUTH_TOKEN'));
        assert.ok(!content.includes('S3_SECRET_ACCESS_KEY'));
      }
    }
    console.log('[Pass 6] Server health capabilities & zero-secret frontend bundle check verified');

    // 7. Theme & User Preferences Persistence Helper Test
    const mockStore = new Map<string, string>();
    const classSet = new Set<string>();
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => mockStore.get(k) ?? null,
        setItem: (k: string, v: string) => mockStore.set(k, v),
      },
    };
    (globalThis as any).document = {
      documentElement: {
        classList: {
          add: (c: string) => classSet.add(c),
          remove: (c: string) => classSet.delete(c),
        },
      },
    };

    const initialPrefs = loadUserPreferences();
    assert.deepStrictEqual(initialPrefs, DEFAULT_PREFERENCES);
    saveUserPreferences({
      ...initialPrefs,
      theme: 'light',
      defaultView: 'analytics',
      defaultQrSize: 768,
      defaultQrEc: 'H',
      compactTables: true,
    });
    assert.ok(classSet.has('light') && !classSet.has('dark'));
    const reloadedPrefs = loadUserPreferences();
    assert.strictEqual(reloadedPrefs.theme, 'light');
    assert.strictEqual(reloadedPrefs.defaultView, 'analytics');
    assert.strictEqual(reloadedPrefs.defaultQrSize, 768);
    assert.ok(mockStore.has(PREFERENCES_STORAGE_KEY));

    const resetPrefs = resetUserPreferences();
    assert.strictEqual(resetPrefs.theme, 'dark');
    assert.ok(classSet.has('dark') && !classSet.has('light'));
    console.log('[Pass 7] Theme switching & user preferences persistence verified');

    console.log('\n🎉 ALL PHASE 5 DASHBOARD TESTS PASSED!');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runPhase5Tests().catch((err) => {
  console.error('❌ PHASE 5 TEST FAILED:', err);
  process.exit(1);
});
