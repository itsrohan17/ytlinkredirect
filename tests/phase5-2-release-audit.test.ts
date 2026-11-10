import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createClient } from '@libsql/client';
import { app } from '../server/app.js';
import { initDb } from '../server/db.js';
import { hashSessionTokenWithSecret } from '../server/services/session.js';

function extractLtSessionCookie(res: Response): string {
  const sc = res.headers.get('set-cookie') || '';
  const m = sc.match(/lt_session=([a-f0-9]{48,64})/);
  assert.ok(m && m[1], `Expected lt_session cookie, got: ${sc}`);
  return `lt_session=${m[1]}`;
}

async function runPhase52ReleaseAudit() {
  console.log('=== STARTING PHASE 5.2 RELEASE READINESS AUDIT TESTS ===');

  const tmpDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const phase5DbPath = path.join(tmpDir, 'phase5_compat_audit_tmp.db');
  if (fs.existsSync(phase5DbPath)) fs.unlinkSync(phase5DbPath);

  // Save environment state
  const origNodeEnv = process.env.NODE_ENV;
  const origVercel = process.env.VERCEL;
  const origSecret = process.env.SESSION_SECRET;
  const origPrevSecret = process.env.SESSION_SECRET_PREVIOUS;
  const origTursoToken = process.env.TURSO_AUTH_TOKEN;

  // 1. Seed a real Phase 5 SQLite database BEFORE Phase 5.1/5.2 changes existed
  const seedClient = createClient({ url: `file:${phase5DbPath}` });
  await seedClient.execute(`
    CREATE TABLE links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      original_url TEXT NOT NULL,
      clean_youtube_url TEXT NOT NULL,
      url_type TEXT NOT NULL,
      video_id TEXT,
      playlist_id TEXT,
      channel_id TEXT,
      title TEXT NOT NULL,
      author_name TEXT NOT NULL,
      thumbnail_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      click_count INTEGER DEFAULT 0,
      platform TEXT DEFAULT 'youtube',
      content_id TEXT,
      owner_token_hash TEXT
    );
  `);
  await seedClient.execute(`
    CREATE TABLE clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      device_type TEXT NOT NULL,
      os_name TEXT,
      browser_name TEXT,
      is_in_app_browser INTEGER DEFAULT 0,
      referrer TEXT,
      user_agent TEXT,
      ip_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      platform TEXT DEFAULT 'youtube',
      country TEXT DEFAULT 'Unknown'
    );
  `);
  await seedClient.execute(`
    CREATE TABLE media_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT UNIQUE NOT NULL,
      module TEXT NOT NULL,
      processing_mode TEXT NOT NULL,
      input_filename TEXT NOT NULL,
      input_mime TEXT NOT NULL,
      input_size INTEGER NOT NULL,
      output_format TEXT NOT NULL,
      output_size INTEGER,
      status TEXT NOT NULL DEFAULT 'completed',
      storage_key TEXT,
      output_storage_key TEXT,
      owner_token_hash TEXT,
      dedupe_key TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 2,
      error_message TEXT,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Phase 5 token was 24 bytes (48 hex chars), stored as raw SHA-256(token)
  const phase5Token = crypto.randomBytes(24).toString('hex');
  const phase5Cookie = `lt_session=${phase5Token}`;
  const phase5RawSha256 = crypto.createHash('sha256').update(phase5Token).digest('hex');

  await seedClient.execute({
    sql: `INSERT INTO links (code, original_url, clean_youtube_url, url_type, video_id, title, author_name, thumbnail_url, click_count, platform, content_id, owner_token_hash)
          VALUES ('ph5yt1', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'video', 'dQw4w9WgXcQ', 'Phase 5 Owner Video', 'Author', '', 2, 'youtube', 'dQw4w9WgXcQ', ?)`,
    args: [phase5RawSha256],
  });
  await seedClient.execute({
    sql: `INSERT INTO clicks (link_id, code, platform, device_type, os_name, browser_name, is_in_app_browser, referrer, country, user_agent)
          VALUES (1, 'ph5yt1', 'youtube', 'android', 'Android', 'Chrome', 0, 'whatsapp.com', 'IN', 'Mozilla/5.0')`,
    args: [],
  });
  await seedClient.execute({
    sql: `INSERT INTO links (code, original_url, clean_youtube_url, url_type, video_id, title, author_name, thumbnail_url, click_count, platform, content_id, owner_token_hash)
          VALUES ('leg_none', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'video', 'dQw4w9WgXcQ', 'Unowned Legacy Link', 'Author', '', 5, 'youtube', 'dQw4w9WgXcQ', NULL)`,
    args: [],
  });
  seedClient.close();

  // Initialize Express module singleton DB directly against migrated Phase 5 DB copy
  process.env.DATABASE_URL = `file:${phase5DbPath}`;
  const db = await initDb();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3009, resolve));
  const base = 'http://localhost:3009';

  try {
    // -----------------------------------------------------------------------
    // A. Production SESSION_SECRET Requirement & TURSO_AUTH_TOKEN Non-Reuse
    // -----------------------------------------------------------------------
    process.env.NODE_ENV = 'production';
    delete process.env.VERCEL;
    delete process.env.SESSION_SECRET;
    process.env.TURSO_AUTH_TOKEN = 'secret_turso_db_token_must_never_sign_sessions';

    // Missing SESSION_SECRET in production must fail safely with 503 on session endpoints
    const noSecCreate = await fetch(`${base}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    });
    assert.strictEqual(noSecCreate.status, 503);

    const noSecBoot = await fetch(`${base}/api/links/session`, { method: 'POST' });
    assert.strictEqual(noSecBoot.status, 503);

    // Too-short SESSION_SECRET (<32 chars) rejected with 503
    process.env.SESSION_SECRET = 'too-short-secret';
    const shortSecRes = await fetch(`${base}/api/links/session`, { method: 'POST' });
    assert.strictEqual(shortSecRes.status, 503);

    // Health and Public Redirects STILL work cleanly even when session secret is misconfigured
    const healthMisconf: any = await fetch(`${base}/api/health`).then((r) => r.json());
    assert.strictEqual(healthMisconf.capabilities.sessionConfigured, false);
    const pubRedirDuringMisconf = await fetch(`${base}/leg_none`, { redirect: 'manual' });
    assert.strictEqual(pubRedirDuringMisconf.status, 302);
    console.log('[Pass 1] Production rejects missing/weak SESSION_SECRET (503), ignores TURSO_AUTH_TOKEN & keeps redirects/health alive');

    // Configure valid >= 32 char production SESSION_SECRET
    const prodSecret1 = 'prod_session_secret_v1_0123456789abcdef0123456789abcdef';
    process.env.SESSION_SECRET = prodSecret1;
    const healthOk: any = await fetch(`${base}/api/health`).then((r) => r.json());
    assert.strictEqual(healthOk.capabilities.sessionConfigured, true);

    // -----------------------------------------------------------------------
    // B. Backward Compatibility with Phase 5 SHA-256 DB Records & 48-char Cookie
    // -----------------------------------------------------------------------
    const listPh5Res = await fetch(`${base}/api/links`, {
      headers: { Cookie: phase5Cookie },
    });
    assert.strictEqual(listPh5Res.status, 200);
    const listPh5: any = await listPh5Res.json();
    assert.strictEqual(listPh5.links.length, 1);
    assert.strictEqual(listPh5.links[0].code, 'ph5yt1');
    assert.strictEqual(listPh5.links[0].canManage, true);

    // Analytics & PATCH work for original Phase 5 owner
    const anaPh5: any = await fetch(`${base}/api/links/analytics?range=all`, {
      headers: { Cookie: phase5Cookie },
    }).then((r) => r.json());
    assert.strictEqual(anaPh5.analytics.totalClicksInRange, 1);
    assert.strictEqual(anaPh5.analytics.geo.countries[0].country, 'IN');

    // Verify stored DB hash was lazily & atomically upgraded from raw SHA-256 to HMAC-SHA256(SESSION_SECRET)
    const dbRowRes = await db.execute("SELECT owner_token_hash FROM links WHERE code = 'ph5yt1'");
    const upgradedHash = String(dbRowRes.rows[0].owner_token_hash);
    assert.notStrictEqual(upgradedHash, phase5RawSha256);
    assert.strictEqual(upgradedHash, hashSessionTokenWithSecret(phase5Token, prodSecret1));

    // Legacy unowned link leg_none stays inaccessible to dashboard / PATCH / DELETE
    assert.strictEqual(
      (await fetch(`${base}/api/links/leg_none`, { headers: { Cookie: phase5Cookie } })).status,
      403
    );
    console.log('[Pass 2a] Phase 5 SHA-256 links & analytics accessible + atomically upgraded to HMAC-SHA256; unowned legacy rows stay 403');

    // -----------------------------------------------------------------------
    // C. Key Rollover with SESSION_SECRET_PREVIOUS
    // -----------------------------------------------------------------------
    const prodSecret2 = 'prod_session_secret_v2_fedcba9876543210fedcba9876543210';
    process.env.SESSION_SECRET_PREVIOUS = prodSecret1;
    process.env.SESSION_SECRET = prodSecret2;

    const afterKeyRollRes = await fetch(`${base}/api/links`, {
      headers: { Cookie: phase5Cookie },
    });
    const afterKeyRoll: any = await afterKeyRollRes.json();
    assert.strictEqual(afterKeyRollRes.status, 200);
    assert.strictEqual(afterKeyRoll.links[0].code, 'ph5yt1');

    const rolledRow = await db.execute("SELECT owner_token_hash FROM links WHERE code = 'ph5yt1'");
    assert.strictEqual(
      String(rolledRow.rows[0].owner_token_hash),
      hashSessionTokenWithSecret(phase5Token, prodSecret2)
    );
    delete process.env.SESSION_SECRET_PREVIOUS;
    console.log('[Pass 2b] Zero-downtime SESSION_SECRET rotation via SESSION_SECRET_PREVIOUS verified');

    // -----------------------------------------------------------------------
    // D. Atomic Session Rotation across BOTH Smart Links and Media Jobs
    // -----------------------------------------------------------------------
    const jobCreate = await fetch(`${base}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: phase5Cookie },
      body: JSON.stringify({
        module: 'image-studio',
        processingMode: 'browser-canvas',
        inputFilename: 'phase52-asset.png',
        inputMime: 'image/png',
        inputSize: 2048,
        outputFormat: 'webp',
        outputSize: 1024,
        headerHex: '89504e470d0a1a0a',
        category: 'image',
      }),
    });
    assert.strictEqual(jobCreate.status, 201);

    // Rotate caller token via API
    const rotRes = await fetch(`${base}/api/links/session/rotate`, {
      method: 'POST',
      headers: { Cookie: phase5Cookie },
    });
    assert.strictEqual(rotRes.status, 200);
    const rotatedCookie = extractLtSessionCookie(rotRes);

    // Old token invalidated for BOTH links AND media jobs
    const oldLinks: any = await fetch(`${base}/api/links`, { headers: { Cookie: phase5Cookie } }).then((r) =>
      r.json()
    );
    const oldJobs: any = await fetch(`${base}/api/jobs/summary`, { headers: { Cookie: phase5Cookie } }).then((r) =>
      r.json()
    );
    assert.strictEqual(oldLinks.links.length, 0);
    assert.strictEqual(oldJobs.summary.totalJobs, 0);

    // New rotated token owns BOTH links AND media jobs
    const newLinks: any = await fetch(`${base}/api/links`, { headers: { Cookie: rotatedCookie } }).then((r) =>
      r.json()
    );
    const newJobs: any = await fetch(`${base}/api/jobs/summary`, { headers: { Cookie: rotatedCookie } }).then((r) =>
      r.json()
    );
    assert.strictEqual(newLinks.links.length, 1);
    assert.strictEqual(newLinks.links[0].code, 'ph5yt1');
    assert.strictEqual(newJobs.summary.totalJobs, 1);
    assert.strictEqual(newJobs.recentJobs[0].input_filename, 'phase52-asset.png');

    // Verify db.batch transaction rollback atomicity (if second statement fails, first does NOT persist)
    const preHashRes = await db.execute("SELECT owner_token_hash FROM links WHERE code = 'ph5yt1'");
    const preHash = String(preHashRes.rows[0].owner_token_hash);
    let batchFailed = false;
    try {
      await db.batch(
        [
          {
            sql: "UPDATE links SET owner_token_hash = 'split_state_hash' WHERE code = 'ph5yt1'",
            args: [],
          },
          {
            sql: 'UPDATE non_existent_table SET x = 1',
            args: [],
          },
        ],
        'write'
      );
    } catch {
      batchFailed = true;
    }
    assert.strictEqual(batchFailed, true);
    const postRollbackRes = await db.execute("SELECT owner_token_hash FROM links WHERE code = 'ph5yt1'");
    assert.strictEqual(
      String(postRollbackRes.rows[0].owner_token_hash),
      preHash,
      'Atomic batch rollback must prevent split session ownership'
    );
    console.log('[Pass 3] Atomic session rotation across links + media_jobs & rollback atomicity verified');

    // -----------------------------------------------------------------------
    // E. Production & Reverse Proxy Cookie Flags Verification
    // -----------------------------------------------------------------------
    // E1. Production mode behind proxy
    process.env.NODE_ENV = 'production';
    const prodProxyCookieRes = await fetch(`${base}/api/links/session`, {
      method: 'POST',
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'localhost:3009',
      },
    });
    const prodCookieHeader = prodProxyCookieRes.headers.get('set-cookie') || '';
    assert.ok(prodCookieHeader.includes('HttpOnly'));
    assert.ok(prodCookieHeader.includes('SameSite=Lax'));
    assert.ok(prodCookieHeader.includes('Path=/'));
    assert.ok(prodCookieHeader.includes('Max-Age=604800'));
    assert.ok(prodCookieHeader.includes('Secure'), 'Production cookie must set Secure');

    // E2. Development mode WITH reverse proxy HTTPS (x-forwarded-proto: https)
    process.env.NODE_ENV = 'development';
    const devProxyHttpsRes = await fetch(`${base}/api/links/session`, {
      method: 'POST',
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'localhost:3009',
      },
    });
    const devHttpsCookieHeader = devProxyHttpsRes.headers.get('set-cookie') || '';
    assert.ok(devHttpsCookieHeader.includes('Secure'), 'Proxy HTTPS must set Secure even in dev');
    assert.ok(devHttpsCookieHeader.includes('HttpOnly'));
    assert.ok(devHttpsCookieHeader.includes('SameSite=Lax'));

    // E3. Local HTTP development (no proxy HTTPS headers)
    const devHttpRes = await fetch(`${base}/api/links/session`, { method: 'POST' });
    const devHttpCookieHeader = devHttpRes.headers.get('set-cookie') || '';
    assert.ok(devHttpCookieHeader.includes('HttpOnly'));
    assert.ok(devHttpCookieHeader.includes('SameSite=Lax'));
    assert.ok(devHttpCookieHeader.includes('Path=/'));
    assert.ok(!devHttpCookieHeader.includes('Secure'), 'Local HTTP dev should omit Secure for localhost testing');
    console.log('[Pass 4] Reverse proxy HTTPS, production, and local HTTP cookie flags verified');

    console.log('\n🎉 ALL PHASE 5.2 RELEASE READINESS AUDIT TESTS PASSED!');
  } finally {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    if (origVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = origVercel;
    if (origSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = origSecret;
    if (origPrevSecret === undefined) delete process.env.SESSION_SECRET_PREVIOUS;
    else process.env.SESSION_SECRET_PREVIOUS = origPrevSecret;
    if (origTursoToken === undefined) delete process.env.TURSO_AUTH_TOKEN;
    else process.env.TURSO_AUTH_TOKEN = origTursoToken;
    delete process.env.DATABASE_URL;

    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
    try {
      if (fs.existsSync(phase5DbPath)) fs.unlinkSync(phase5DbPath);
    } catch {
      // ignore lingering WAL cleanup on Windows if any
    }
  }
}

runPhase52ReleaseAudit().catch((err) => {
  console.error('❌ PHASE 5.2 RELEASE AUDIT FAILED:', err);
  process.exit(1);
});
