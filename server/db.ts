import { createClient, Client } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { ClickRecord, LinkRecord, LinkStats, YouTubeUrlType } from './types.js';

let client: Client | null = null;

export async function initDb(): Promise<Client> {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url) {
    const masked = url.replace(/:\/\/.*@/, '://***@');
    console.log(`📡 [Database] Connecting to remote Turso database at: ${masked}`);
    try {
      client = createClient({ url, authToken });
      await client.execute('SELECT 1;');
      console.log('✅ [Database] Remote database connection verified.');
    } catch (err: any) {
      console.error('❌ [Database] Connection error with remote database:', err.message);
      client = null;
      throw new Error(`Failed to connect to remote database: ${err.message}. Please verify TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.`);
    }
  } else {
    const isVercel = Boolean(process.env.VERCEL);
    if (isVercel) {
      console.warn('⚠️ [Database] TURSO_DATABASE_URL not set in Vercel environment. Using in-memory fallback.');
      client = createClient({ url: ':memory:' });
    } else {
      const dbDir = path.resolve(process.cwd(), 'data');
      if (!fs.existsSync(dbDir)) {
        try {
          fs.mkdirSync(dbDir, { recursive: true });
        } catch {}
      }
      const dbPath = path.join(dbDir, 'app.db');
      console.log(`📁 [Database] Using local SQLite file at: ${dbPath}`);
      client = createClient({ url: `file:${dbPath}` });
    }
  }

  // Schema creation
  await client.execute(`
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

  await client.execute(`CREATE INDEX IF NOT EXISTS idx_links_code ON links(code);`);

  await client.execute(`
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

  await client.execute(`CREATE INDEX IF NOT EXISTS idx_clicks_code ON clicks(code);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_clicks_link_id ON clicks(link_id);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_clicks_created ON clicks(created_at);`);

  return client;
}

async function getDb(): Promise<Client> {
  if (!client) {
    return await initDb();
  }
  return client;
}

export async function isCodeAvailable(code: string): Promise<boolean> {
  const db = await getDb();
  const res = await db.execute({
    sql: 'SELECT id FROM links WHERE code = ? LIMIT 1',
    args: [code],
  });
  return res.rows.length === 0;
}

export async function createLink(data: {
  code: string;
  originalUrl: string;
  cleanUrl: string;
  urlType: YouTubeUrlType;
  videoId?: string;
  playlistId?: string;
  channelId?: string;
  title: string;
  authorName: string;
  thumbnailUrl: string;
}): Promise<LinkRecord> {
  const db = await getDb();

  await db.execute({
    sql: `INSERT INTO links (
      code, original_url, clean_youtube_url, url_type,
      video_id, playlist_id, channel_id,
      title, author_name, thumbnail_url, created_at, click_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0)`,
    args: [
      data.code,
      data.originalUrl,
      data.cleanUrl,
      data.urlType,
      data.videoId || null,
      data.playlistId || null,
      data.channelId || null,
      data.title,
      data.authorName,
      data.thumbnailUrl,
    ],
  });

  const link = await getLinkByCode(data.code);
  if (!link) throw new Error('Failed to retrieve newly created link');
  return link;
}

export async function getLinkByCode(code: string): Promise<LinkRecord | null> {
  const db = await getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM links WHERE code = ? LIMIT 1',
    args: [code],
  });

  if (res.rows.length === 0) return null;
  const row = res.rows[0] as any;

  return {
    id: Number(row.id),
    code: String(row.code),
    original_url: String(row.original_url),
    clean_youtube_url: String(row.clean_youtube_url),
    url_type: row.url_type as YouTubeUrlType,
    video_id: row.video_id ? String(row.video_id) : null,
    playlist_id: row.playlist_id ? String(row.playlist_id) : null,
    channel_id: row.channel_id ? String(row.channel_id) : null,
    title: String(row.title),
    author_name: String(row.author_name),
    thumbnail_url: String(row.thumbnail_url),
    created_at: String(row.created_at),
    click_count: Number(row.click_count || 0),
  };
}

export async function recordClick(click: ClickRecord): Promise<void> {
  const db = await getDb();
  try {
    await db.execute({
      sql: `INSERT INTO clicks (
        link_id, code, device_type, os_name, browser_name, is_in_app_browser, referrer, user_agent, ip_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [
        click.link_id,
        click.code,
        click.device_type,
        click.os_name || 'Unknown',
        click.browser_name || 'Unknown',
        click.is_in_app_browser ? 1 : 0,
        click.referrer || 'Direct / None',
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

export async function getLinkStats(code: string): Promise<LinkStats | null> {
  const db = await getDb();
  const link = await getLinkByCode(code);
  if (!link) return null;

  // Device counts
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

  // In-app count
  const inAppRes = await db.execute({
    sql: 'SELECT COUNT(*) as cnt FROM clicks WHERE link_id = ? AND is_in_app_browser = 1',
    args: [link.id],
  });
  const inAppCount = inAppRes.rows.length > 0 ? Number(inAppRes.rows[0].cnt || 0) : 0;

  // Top referrers
  const refRes = await db.execute({
    sql: 'SELECT referrer, COUNT(*) as count FROM clicks WHERE link_id = ? GROUP BY referrer ORDER BY count DESC LIMIT 10',
    args: [link.id],
  });
  const referrers: Record<string, number> = {};
  for (const r of refRes.rows) {
    referrers[String(r.referrer || 'Direct')] = Number(r.count || 0);
  }

  // Recent clicks
  const recentRes = await db.execute({
    sql: 'SELECT device_type, os_name, browser_name, is_in_app_browser, referrer, created_at FROM clicks WHERE link_id = ? ORDER BY id DESC LIMIT 15',
    args: [link.id],
  });
  const recentClicks = recentRes.rows.map((r: any) => ({
    device_type: String(r.device_type || 'other'),
    os_name: String(r.os_name || 'Unknown'),
    browser_name: String(r.browser_name || 'Unknown'),
    is_in_app_browser: Number(r.is_in_app_browser || 0),
    referrer: String(r.referrer || 'Direct'),
    created_at: String(r.created_at || ''),
  }));

  return {
    link,
    totalClicks: link.click_count,
    devices,
    inAppCount,
    referrers,
    recentClicks,
  };
}

export async function getRecentLinks(limit = 10): Promise<LinkRecord[]> {
  const db = await getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM links ORDER BY id DESC LIMIT ?',
    args: [limit],
  });

  return res.rows.map((row: any) => ({
    id: Number(row.id),
    code: String(row.code),
    original_url: String(row.original_url),
    clean_youtube_url: String(row.clean_youtube_url),
    url_type: row.url_type as YouTubeUrlType,
    video_id: row.video_id ? String(row.video_id) : null,
    playlist_id: row.playlist_id ? String(row.playlist_id) : null,
    channel_id: row.channel_id ? String(row.channel_id) : null,
    title: String(row.title),
    author_name: String(row.author_name),
    thumbnail_url: String(row.thumbnail_url),
    created_at: String(row.created_at),
    click_count: Number(row.click_count || 0),
  }));
}
