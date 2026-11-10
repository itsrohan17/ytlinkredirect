import { createClient, Client } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import {
  ClickRecord,
  ContentType,
  LinkRecord,
  LinkStats,
  Platform,
  PlatformAnalyticsSummary,
} from './types.js';

let client: Client | null = null;
let databaseMode: 'turso' | 'local-sqlite' | 'memory' = 'local-sqlite';

export function getDatabaseMode(): 'turso' | 'local-sqlite' | 'memory' {
  return databaseMode;
}

async function ensureColumn(
  db: Client,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  const info = await db.execute(`PRAGMA table_info(${table});`);
  const exists = info.rows.some((r: any) => String(r.name).toLowerCase() === column.toLowerCase());
  if (!exists) {
    console.log(`🔄 [Migration] Adding column "${column}" to table "${table}"`);
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

export async function initDb(customDbPath?: string): Promise<Client> {
  if (client && !customDbPath) return client;

  const url = customDbPath
    ? customDbPath === ':memory:'
      ? ':memory:'
      : `file:${customDbPath}`
    : process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  const authToken = customDbPath ? undefined : process.env.TURSO_AUTH_TOKEN;

  let activeClient: Client;

  if (url === ':memory:') {
    databaseMode = 'memory';
    activeClient = createClient({ url: ':memory:' });
  } else if (url && !url.startsWith('file:')) {
    databaseMode = 'turso';
    const masked = url.replace(/:\/\/.*@/, '://***@');
    console.log(`📡 [Database] Connecting to remote Turso database at: ${masked}`);
    try {
      activeClient = createClient({ url, authToken });
      await activeClient.execute('SELECT 1;');
      console.log('✅ [Database] Remote database connection verified.');
    } catch (err: any) {
      console.error('❌ [Database] Connection error with remote database:', err.message);
      throw new Error(
        `Failed to connect to remote database: ${err.message}. Please verify TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.`
      );
    }
  } else if (url && url.startsWith('file:')) {
    databaseMode = 'local-sqlite';
    activeClient = createClient({ url });
  } else {
    const isVercel = Boolean(process.env.VERCEL);
    if (isVercel) {
      databaseMode = 'memory';
      console.warn('⚠️ [Database] TURSO_DATABASE_URL not set in Vercel environment. Using in-memory fallback.');
      activeClient = createClient({ url: ':memory:' });
    } else {
      databaseMode = 'local-sqlite';
      const dbDir = path.resolve(process.cwd(), 'data');
      if (!fs.existsSync(dbDir)) {
        try {
          fs.mkdirSync(dbDir, { recursive: true });
        } catch {}
      }
      const dbPath = path.join(dbDir, 'app.db');
      console.log(`📁 [Database] Using local SQLite file at: ${dbPath}`);
      activeClient = createClient({ url: `file:${dbPath}` });
    }
  }

  // Base schema creation (never drops or recreates existing tables)
  await activeClient.execute(`
    CREATE TABLE IF NOT EXISTS links (
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
      click_count INTEGER DEFAULT 0
    );
  `);

  await activeClient.execute(`CREATE INDEX IF NOT EXISTS idx_links_code ON links(code);`);

  await activeClient.execute(`
    CREATE TABLE IF NOT EXISTS clicks (
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
      FOREIGN KEY(link_id) REFERENCES links(id) ON DELETE CASCADE
    );
  `);

  await activeClient.execute(`CREATE INDEX IF NOT EXISTS idx_clicks_code ON clicks(code);`);
  await activeClient.execute(`CREATE INDEX IF NOT EXISTS idx_clicks_link_id ON clicks(link_id);`);
  await activeClient.execute(`CREATE INDEX IF NOT EXISTS idx_clicks_created ON clicks(created_at);`);

  // Non-destructive, idempotent column migrations (preserves all existing records & tables)
  await ensureColumn(activeClient, 'links', 'platform', "TEXT DEFAULT 'youtube'");
  await ensureColumn(activeClient, 'links', 'content_id', 'TEXT');
  await ensureColumn(activeClient, 'links', 'owner_token_hash', 'TEXT');
  await ensureColumn(activeClient, 'clicks', 'platform', "TEXT DEFAULT 'youtube'");
  await ensureColumn(activeClient, 'clicks', 'country', "TEXT DEFAULT 'Unknown'");

  await activeClient.execute(`CREATE INDEX IF NOT EXISTS idx_links_platform ON links(platform);`);
  await activeClient.execute(`CREATE INDEX IF NOT EXISTS idx_links_owner ON links(owner_token_hash);`);
  await activeClient.execute(`CREATE INDEX IF NOT EXISTS idx_clicks_platform ON clicks(platform);`);

  if (!customDbPath || customDbPath === ':memory:') {
    client = activeClient;
  }
  return activeClient;
}

async function getDb(): Promise<Client> {
  if (!client) {
    return await initDb();
  }
  return client;
}

function mapLinkRow(row: any, callerOwnerHash?: string | null): LinkRecord {
  const cleanUrl = String(row.clean_youtube_url || '');
  const rowOwnerHash = row.owner_token_hash ? String(row.owner_token_hash) : null;
  return {
    id: Number(row.id),
    code: String(row.code),
    platform: (row.platform as Platform) || 'youtube',
    original_url: String(row.original_url),
    clean_url: cleanUrl,
    clean_youtube_url: cleanUrl,
    url_type: row.url_type as ContentType,
    content_id: row.content_id
      ? String(row.content_id)
      : row.video_id
      ? String(row.video_id)
      : row.playlist_id
      ? String(row.playlist_id)
      : row.channel_id
      ? String(row.channel_id)
      : null,
    video_id: row.video_id ? String(row.video_id) : null,
    playlist_id: row.playlist_id ? String(row.playlist_id) : null,
    channel_id: row.channel_id ? String(row.channel_id) : null,
    title: String(row.title),
    author_name: String(row.author_name),
    thumbnail_url: String(row.thumbnail_url),
    created_at: String(row.created_at),
    click_count: Number(row.click_count || 0),
    ...(callerOwnerHash !== undefined
      ? { canManage: Boolean(rowOwnerHash && callerOwnerHash && rowOwnerHash === callerOwnerHash) }
      : {}),
  };
}

export async function isCodeAvailable(code: string, dbOverride?: Client): Promise<boolean> {
  const db = dbOverride || (await getDb());
  const res = await db.execute({
    sql: 'SELECT id FROM links WHERE code = ? LIMIT 1',
    args: [code],
  });
  return res.rows.length === 0;
}

export async function createLink(
  data: {
    code: string;
    platform: Platform;
    originalUrl: string;
    cleanUrl: string;
    urlType: ContentType;
    contentId?: string;
    videoId?: string;
    playlistId?: string;
    channelId?: string;
    title: string;
    authorName: string;
    thumbnailUrl: string;
    ownerTokenHash?: string | null;
  },
  dbOverride?: Client
): Promise<LinkRecord> {
  const db = dbOverride || (await getDb());

  await db.execute({
    sql: `INSERT INTO links (
      code, platform, original_url, clean_youtube_url, url_type,
      content_id, video_id, playlist_id, channel_id,
      title, author_name, thumbnail_url, owner_token_hash, created_at, click_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0)`,
    args: [
      data.code,
      data.platform,
      data.originalUrl,
      data.cleanUrl,
      data.urlType,
      data.contentId || data.videoId || data.playlistId || data.channelId || null,
      data.videoId || null,
      data.playlistId || null,
      data.channelId || null,
      data.title,
      data.authorName,
      data.thumbnailUrl,
      data.ownerTokenHash ?? null,
    ],
  });

  const link = await getLinkByCode(data.code, db);
  if (!link) throw new Error('Failed to retrieve newly created link');
  return link;
}

export async function getLinkByCode(
  code: string,
  dbOverride?: Client,
  callerOwnerHash?: string | null
): Promise<LinkRecord | null> {
  const db = dbOverride || (await getDb());
  const res = await db.execute({
    sql: 'SELECT * FROM links WHERE code = ? LIMIT 1',
    args: [code],
  });

  if (res.rows.length === 0) return null;
  return mapLinkRow(res.rows[0], callerOwnerHash);
}

export async function getLinkOwnerHashByCode(
  code: string,
  dbOverride?: Client
): Promise<{ id: number; ownerTokenHash: string | null } | null> {
  const db = dbOverride || (await getDb());
  const res = await db.execute({
    sql: 'SELECT id, owner_token_hash FROM links WHERE code = ? LIMIT 1',
    args: [code],
  });
  if (res.rows.length === 0) return null;
  const r = res.rows[0] as any;
  return {
    id: Number(r.id),
    ownerTokenHash: r.owner_token_hash ? String(r.owner_token_hash) : null,
  };
}

export async function recordClick(click: ClickRecord, dbOverride?: Client): Promise<void> {
  const db = dbOverride || (await getDb());
  try {
    await db.execute({
      sql: `INSERT INTO clicks (
        link_id, code, platform, device_type, os_name, browser_name, is_in_app_browser, referrer, country, user_agent, ip_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [
        click.link_id,
        click.code,
        click.platform || 'youtube',
        click.device_type,
        click.os_name || 'Unknown',
        click.browser_name || 'Unknown',
        click.is_in_app_browser ? 1 : 0,
        click.referrer || 'Direct',
        click.country || 'Unknown',
        click.user_agent || '',
        click.ip_hash || '',
      ],
    });

    await db.execute({
      sql: 'UPDATE links SET click_count = click_count + 1 WHERE id = ?',
      args: [click.link_id],
    });
  } catch (err) {
    console.error('Error recording click in DB:', err);
  }
}

export async function getLinkStats(code: string, dbOverride?: Client): Promise<LinkStats | null> {
  const db = dbOverride || (await getDb());
  const link = await getLinkByCode(code, db);
  if (!link) return null;

  const devRes = await db.execute({
    sql: 'SELECT device_type, COUNT(*) as count FROM clicks WHERE link_id = ? GROUP BY device_type',
    args: [link.id],
  });
  const devices = { android: 0, ios: 0, desktop: 0, other: 0 };
  for (const r of devRes.rows) {
    const dev = String(r.device_type || 'other').toLowerCase();
    const count = Number(r.count || 0);
    if (dev === 'android') devices.android = count;
    else if (dev === 'ios') devices.ios = count;
    else if (dev === 'desktop') devices.desktop = count;
    else devices.other += count;
  }

  const inAppRes = await db.execute({
    sql: 'SELECT COUNT(*) as cnt FROM clicks WHERE link_id = ? AND is_in_app_browser = 1',
    args: [link.id],
  });
  const inAppCount = inAppRes.rows.length > 0 ? Number(inAppRes.rows[0].cnt || 0) : 0;

  const refRes = await db.execute({
    sql: 'SELECT referrer, COUNT(*) as count FROM clicks WHERE link_id = ? GROUP BY referrer ORDER BY count DESC LIMIT 10',
    args: [link.id],
  });
  const referrers: Record<string, number> = {};
  for (const r of refRes.rows) {
    referrers[String(r.referrer || 'Direct')] = Number(r.count || 0);
  }

  const browserRes = await db.execute({
    sql: 'SELECT browser_name, COUNT(*) as count FROM clicks WHERE link_id = ? GROUP BY browser_name ORDER BY count DESC LIMIT 10',
    args: [link.id],
  });
  const browsers: Record<string, number> = {};
  for (const r of browserRes.rows) {
    browsers[String(r.browser_name || 'Unknown')] = Number(r.count || 0);
  }

  const countryRes = await db.execute({
    sql: 'SELECT country, COUNT(*) as count FROM clicks WHERE link_id = ? GROUP BY country ORDER BY count DESC LIMIT 10',
    args: [link.id],
  });
  const countries: Record<string, number> = {};
  for (const r of countryRes.rows) {
    countries[String(r.country || 'Unknown')] = Number(r.count || 0);
  }

  const recentRes = await db.execute({
    sql: 'SELECT platform, device_type, os_name, browser_name, is_in_app_browser, referrer, country, created_at FROM clicks WHERE link_id = ? ORDER BY id DESC LIMIT 15',
    args: [link.id],
  });
  const recentClicks = recentRes.rows.map((r: any) => ({
    platform: String(r.platform || link.platform || 'youtube'),
    device_type: String(r.device_type || 'other'),
    os_name: String(r.os_name || 'Unknown'),
    browser_name: String(r.browser_name || 'Unknown'),
    is_in_app_browser: Number(r.is_in_app_browser || 0),
    referrer: String(r.referrer || 'Direct'),
    country: String(r.country || 'Unknown'),
    created_at: String(r.created_at || ''),
  }));

  return {
    link,
    totalClicks: link.click_count,
    devices,
    inAppCount,
    referrers,
    browsers,
    countries,
    recentClicks,
  };
}

export async function getPlatformAnalyticsSummary(
  ownerTokenHash: string,
  dbOverride?: Client
): Promise<PlatformAnalyticsSummary> {
  const db = dbOverride || (await getDb());

  const byPlatform = {
    youtube: { links: 0, clicks: 0 },
    instagram: { links: 0, clicks: 0 },
    facebook: { links: 0, clicks: 0 },
  };

  const linksAgg = await db.execute({
    sql: `SELECT COALESCE(platform, 'youtube') as platform, COUNT(*) as link_count, COALESCE(SUM(click_count), 0) as total_clicks
          FROM links
          WHERE owner_token_hash = ?
          GROUP BY COALESCE(platform, 'youtube')`,
    args: [ownerTokenHash],
  });
  let totalLinks = 0;
  let totalClicks = 0;

  for (const r of linksAgg.rows) {
    const plat = String(r.platform || 'youtube').toLowerCase() as Platform;
    const lc = Number(r.link_count || 0);
    const cc = Number(r.total_clicks || 0);
    totalLinks += lc;
    totalClicks += cc;
    if (plat === 'youtube' || plat === 'instagram' || plat === 'facebook') {
      byPlatform[plat] = { links: lc, clicks: cc };
    }
  }

  const devRes = await db.execute({
    sql: `SELECT c.device_type, COUNT(*) as count
          FROM clicks c
          INNER JOIN links l ON l.id = c.link_id
          WHERE l.owner_token_hash = ?
          GROUP BY c.device_type`,
    args: [ownerTokenHash],
  });
  const devices = { android: 0, ios: 0, desktop: 0, other: 0 };
  for (const r of devRes.rows) {
    const dev = String(r.device_type || 'other').toLowerCase();
    const count = Number(r.count || 0);
    if (dev === 'android') devices.android = count;
    else if (dev === 'ios') devices.ios = count;
    else if (dev === 'desktop') devices.desktop = count;
    else devices.other += count;
  }

  const countryRes = await db.execute({
    sql: `SELECT COALESCE(c.country, 'Unknown') as country, COUNT(*) as count
          FROM clicks c
          INNER JOIN links l ON l.id = c.link_id
          WHERE l.owner_token_hash = ?
          GROUP BY c.country
          ORDER BY count DESC LIMIT 10`,
    args: [ownerTokenHash],
  });
  const topCountries: Record<string, number> = {};
  for (const r of countryRes.rows) {
    topCountries[String(r.country || 'Unknown')] = Number(r.count || 0);
  }

  const browserRes = await db.execute({
    sql: `SELECT COALESCE(c.browser_name, 'Unknown') as browser_name, COUNT(*) as count
          FROM clicks c
          INNER JOIN links l ON l.id = c.link_id
          WHERE l.owner_token_hash = ?
          GROUP BY c.browser_name
          ORDER BY count DESC LIMIT 10`,
    args: [ownerTokenHash],
  });
  const topBrowsers: Record<string, number> = {};
  for (const r of browserRes.rows) {
    topBrowsers[String(r.browser_name || 'Unknown')] = Number(r.count || 0);
  }

  const refRes = await db.execute({
    sql: `SELECT COALESCE(c.referrer, 'Direct') as referrer, COUNT(*) as count
          FROM clicks c
          INNER JOIN links l ON l.id = c.link_id
          WHERE l.owner_token_hash = ?
          GROUP BY c.referrer
          ORDER BY count DESC LIMIT 10`,
    args: [ownerTokenHash],
  });
  const topReferrers: Record<string, number> = {};
  for (const r of refRes.rows) {
    topReferrers[String(r.referrer || 'Direct')] = Number(r.count || 0);
  }

  return {
    totalLinks,
    totalClicks,
    byPlatform,
    devices,
    topCountries,
    topBrowsers,
    topReferrers,
  };
}

export async function getRecentLinks(
  limit = 10,
  dbOverride?: Client,
  callerOwnerHash?: string | null
): Promise<LinkRecord[]> {
  const db = dbOverride || (await getDb());
  const res = callerOwnerHash
    ? await db.execute({
        sql: 'SELECT * FROM links WHERE owner_token_hash = ? ORDER BY id DESC LIMIT ?',
        args: [callerOwnerHash, limit],
      })
    : await db.execute({
        sql: 'SELECT * FROM links ORDER BY id DESC LIMIT ?',
        args: [limit],
      });

  return res.rows.map((r) => mapLinkRow(r, callerOwnerHash));
}

export async function upgradeCompatibleSessionHashes(
  primaryHash: string,
  compatHashes: string[],
  dbOverride?: Client
): Promise<void> {
  if (!compatHashes || compatHashes.length === 0) return;
  const db = dbOverride || (await getDb());
  const placeholders = compatHashes.map(() => '?').join(', ');
  await db.execute({
    sql: `UPDATE links SET owner_token_hash = ? WHERE owner_token_hash IN (${placeholders})`,
    args: [primaryHash, ...compatHashes],
  });
}

export async function rotateOwnerSessionHash(
  oldOwnerHashes: string | string[],
  newOwnerHash: string,
  dbOverride?: Client
): Promise<void> {
  const candidates = (Array.isArray(oldOwnerHashes) ? oldOwnerHashes : [oldOwnerHashes]).filter(Boolean);
  if (candidates.length === 0) return;
  const db = dbOverride || (await getDb());
  const placeholders = candidates.map(() => '?').join(', ');
  await db.execute({
    sql: `UPDATE links SET owner_token_hash = ? WHERE owner_token_hash IN (${placeholders})`,
    args: [newOwnerHash, ...candidates],
  });
}
