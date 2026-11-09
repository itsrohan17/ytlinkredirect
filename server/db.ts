import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { ClickRecord, LinkRecord, LinkStats, YouTubeUrlType } from './types.js';

let db: Database | null = null;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'app.db');

let isSaving = false;
let needsSave = false;

async function persistToDisk() {
  if (!db) return;
  if (isSaving) {
    needsSave = true;
    return;
  }
  isSaving = true;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = db.export();
    await fs.promises.writeFile(DB_FILE, Buffer.from(data));
  } catch (err) {
    console.error('Error saving SQLite to disk:', err);
  } finally {
    isSaving = false;
    if (needsSave) {
      needsSave = false;
      persistToDisk();
    }
  }
}

export async function initDb(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    try {
      const buffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(buffer);
    } catch (e) {
      console.warn('Failed to load existing DB file, creating new in-memory SQLite DB:', e);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  // Schema creation
  db.run(`
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

    CREATE INDEX IF NOT EXISTS idx_links_code ON links(code);

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

    CREATE INDEX IF NOT EXISTS idx_clicks_code ON clicks(code);
    CREATE INDEX IF NOT EXISTS idx_clicks_link_id ON clicks(link_id);
    CREATE INDEX IF NOT EXISTS idx_clicks_created ON clicks(created_at);
  `);

  await persistToDisk();
  return db;
}

export function isCodeAvailable(code: string): boolean {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare('SELECT id FROM links WHERE code = ? LIMIT 1');
  stmt.bind([code]);
  const hasRow = stmt.step();
  stmt.free();
  return !hasRow;
}

export function createLink(data: {
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
}): LinkRecord {
  if (!db) throw new Error('Database not initialized');

  db.run(
    `INSERT INTO links (
      code, original_url, clean_youtube_url, url_type,
      video_id, playlist_id, channel_id,
      title, author_name, thumbnail_url, created_at, click_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0)`,
    [
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
    ]
  );

  persistToDisk();
  const link = getLinkByCode(data.code);
  if (!link) throw new Error('Failed to retrieve newly created link');
  return link;
}

export function getLinkByCode(code: string): LinkRecord | null {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(`SELECT * FROM links WHERE code = ? LIMIT 1`);
  stmt.bind([code]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as any;
  stmt.free();

  return {
    id: row.id,
    code: row.code,
    original_url: row.original_url,
    clean_youtube_url: row.clean_youtube_url,
    url_type: row.url_type,
    video_id: row.video_id,
    playlist_id: row.playlist_id,
    channel_id: row.channel_id,
    title: row.title,
    author_name: row.author_name,
    thumbnail_url: row.thumbnail_url,
    created_at: row.created_at,
    click_count: row.click_count,
  };
}

export function recordClick(click: ClickRecord): void {
  if (!db) return;
  try {
    db.run(
      `INSERT INTO clicks (
        link_id, code, device_type, os_name, browser_name, is_in_app_browser, referrer, user_agent, ip_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        click.link_id,
        click.code,
        click.device_type,
        click.os_name || 'Unknown',
        click.browser_name || 'Unknown',
        click.is_in_app_browser ? 1 : 0,
        click.referrer || 'Direct / None',
        click.user_agent || '',
        click.ip_hash || '',
      ]
    );

    db.run(`UPDATE links SET click_count = click_count + 1 WHERE id = ?`, [click.link_id]);
    persistToDisk();
  } catch (err) {
    console.error('Error recording click in SQLite:', err);
  }
}

export function getLinkStats(code: string): LinkStats | null {
  if (!db) throw new Error('Database not initialized');
  const link = getLinkByCode(code);
  if (!link) return null;

  // Device counts
  const deviceStmt = db.prepare(`
    SELECT device_type, COUNT(*) as count 
    FROM clicks 
    WHERE link_id = ? 
    GROUP BY device_type
  `);
  deviceStmt.bind([link.id]);
  const devices = { android: 0, ios: 0, desktop: 0, other: 0 };
  while (deviceStmt.step()) {
    const row = deviceStmt.getAsObject() as { device_type: string; count: number };
    const dev = (row.device_type || 'other').toLowerCase();
    if (dev === 'android') devices.android = row.count;
    else if (dev === 'ios') devices.ios = row.count;
    else if (dev === 'desktop') devices.desktop = row.count;
    else devices.other += row.count;
  }
  deviceStmt.free();

  // In-app browser count
  const inAppStmt = db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE link_id = ? AND is_in_app_browser = 1`);
  inAppStmt.bind([link.id]);
  let inAppCount = 0;
  if (inAppStmt.step()) {
    inAppCount = (inAppStmt.getAsObject() as any).cnt || 0;
  }
  inAppStmt.free();

  // Referrers
  const refStmt = db.prepare(`
    SELECT referrer, COUNT(*) as count 
    FROM clicks 
    WHERE link_id = ? 
    GROUP BY referrer 
    ORDER BY count DESC 
    LIMIT 10
  `);
  refStmt.bind([link.id]);
  const referrers: Record<string, number> = {};
  while (refStmt.step()) {
    const row = refStmt.getAsObject() as { referrer: string; count: number };
    referrers[row.referrer || 'Direct'] = row.count;
  }
  refStmt.free();

  // Recent clicks
  const recentStmt = db.prepare(`
    SELECT device_type, os_name, browser_name, is_in_app_browser, referrer, created_at 
    FROM clicks 
    WHERE link_id = ? 
    ORDER BY id DESC 
    LIMIT 15
  `);
  recentStmt.bind([link.id]);
  const recentClicks: any[] = [];
  while (recentStmt.step()) {
    recentClicks.push(recentStmt.getAsObject());
  }
  recentStmt.free();

  return {
    link,
    totalClicks: link.click_count,
    devices,
    inAppCount,
    referrers,
    recentClicks,
  };
}

export function getRecentLinks(limit = 10): LinkRecord[] {
  if (!db) return [];
  const stmt = db.prepare(`SELECT * FROM links ORDER BY id DESC LIMIT ?`);
  stmt.bind([limit]);
  const list: LinkRecord[] = [];
  while (stmt.step()) {
    list.push(stmt.getAsObject() as any);
  }
  stmt.free();
  return list;
}
