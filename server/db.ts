import { createClient, Client } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import {
  ClickRecord,
  ContentType,
  LinkRecord,
  LinkStats,
  MediaJobRecord,
  MediaJobStatus,
  MediaModule,
  Platform,
  PlatformAnalyticsSummary,
  ProcessingMode,
  StorageUsageSummary,
} from './types.js';

let client: Client | null = null;

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
    activeClient = createClient({ url: ':memory:' });
  } else if (url && !url.startsWith('file:')) {
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
    activeClient = createClient({ url });
  } else {
    const isVercel = Boolean(process.env.VERCEL);
    if (isVercel) {
      console.warn('⚠️ [Database] TURSO_DATABASE_URL not set in Vercel environment. Using in-memory fallback.');
      activeClient = createClient({ url: ':memory:' });
    } else {
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

  // Non-destructive, idempotent migrations for multi-platform & advanced analytics
  await ensureColumn(activeClient, 'links', 'platform', "TEXT DEFAULT 'youtube'");
  await ensureColumn(activeClient, 'links', 'content_id', 'TEXT');
  await ensureColumn(activeClient, 'clicks', 'platform', "TEXT DEFAULT 'youtube'");
  await ensureColumn(activeClient, 'clicks', 'country', "TEXT DEFAULT 'Unknown'");

  await activeClient.execute(`CREATE INDEX IF NOT EXISTS idx_links_platform ON links(platform);`);
  await activeClient.execute(`CREATE INDEX IF NOT EXISTS idx_clicks_platform ON clicks(platform);`);

  // Media Studio job metadata table (stores metadata & object storage references only, never binaries)
  await activeClient.execute(`
    CREATE TABLE IF NOT EXISTS media_jobs (
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

  await ensureColumn(activeClient, 'media_jobs', 'owner_token_hash', 'TEXT');
  await ensureColumn(activeClient, 'media_jobs', 'dedupe_key', 'TEXT');
  await ensureColumn(activeClient, 'media_jobs', 'retry_count', 'INTEGER DEFAULT 0');
  await ensureColumn(activeClient, 'media_jobs', 'max_retries', 'INTEGER DEFAULT 2');

  await activeClient.execute(`CREATE INDEX IF NOT EXISTS idx_media_jobs_job_id ON media_jobs(job_id);`);
  await activeClient.execute(`CREATE INDEX IF NOT EXISTS idx_media_jobs_status ON media_jobs(status);`);
  await activeClient.execute(`CREATE INDEX IF NOT EXISTS idx_media_jobs_expires ON media_jobs(expires_at);`);
  await activeClient.execute(`CREATE INDEX IF NOT EXISTS idx_media_jobs_dedupe ON media_jobs(dedupe_key);`);

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

function mapLinkRow(row: any): LinkRecord {
  const cleanUrl = String(row.clean_youtube_url || '');
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
  },
  dbOverride?: Client
): Promise<LinkRecord> {
  const db = dbOverride || (await getDb());

  await db.execute({
    sql: `INSERT INTO links (
      code, platform, original_url, clean_youtube_url, url_type,
      content_id, video_id, playlist_id, channel_id,
      title, author_name, thumbnail_url, created_at, click_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0)`,
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
    ],
  });

  const link = await getLinkByCode(data.code, db);
  if (!link) throw new Error('Failed to retrieve newly created link');
  return link;
}

export async function getLinkByCode(code: string, dbOverride?: Client): Promise<LinkRecord | null> {
  const db = dbOverride || (await getDb());
  const res = await db.execute({
    sql: 'SELECT * FROM links WHERE code = ? LIMIT 1',
    args: [code],
  });

  if (res.rows.length === 0) return null;
  return mapLinkRow(res.rows[0]);
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

  // Top browsers
  const browserRes = await db.execute({
    sql: 'SELECT browser_name, COUNT(*) as count FROM clicks WHERE link_id = ? GROUP BY browser_name ORDER BY count DESC LIMIT 10',
    args: [link.id],
  });
  const browsers: Record<string, number> = {};
  for (const r of browserRes.rows) {
    browsers[String(r.browser_name || 'Unknown')] = Number(r.count || 0);
  }

  // Top countries
  const countryRes = await db.execute({
    sql: 'SELECT country, COUNT(*) as count FROM clicks WHERE link_id = ? GROUP BY country ORDER BY count DESC LIMIT 10',
    args: [link.id],
  });
  const countries: Record<string, number> = {};
  for (const r of countryRes.rows) {
    countries[String(r.country || 'Unknown')] = Number(r.count || 0);
  }

  // Recent clicks
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

export async function getPlatformAnalyticsSummary(dbOverride?: Client): Promise<PlatformAnalyticsSummary> {
  const db = dbOverride || (await getDb());

  const byPlatform = {
    youtube: { links: 0, clicks: 0 },
    instagram: { links: 0, clicks: 0 },
    facebook: { links: 0, clicks: 0 },
  };

  const linksAgg = await db.execute(
    `SELECT COALESCE(platform, 'youtube') as platform, COUNT(*) as link_count, COALESCE(SUM(click_count), 0) as total_clicks FROM links GROUP BY COALESCE(platform, 'youtube')`
  );
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

  const devRes = await db.execute('SELECT device_type, COUNT(*) as count FROM clicks GROUP BY device_type');
  const devices = { android: 0, ios: 0, desktop: 0, other: 0 };
  for (const r of devRes.rows) {
    const dev = String(r.device_type || 'other').toLowerCase();
    const count = Number(r.count || 0);
    if (dev === 'android') devices.android = count;
    else if (dev === 'ios') devices.ios = count;
    else if (dev === 'desktop') devices.desktop = count;
    else devices.other += count;
  }

  const countryRes = await db.execute(
    "SELECT COALESCE(country, 'Unknown') as country, COUNT(*) as count FROM clicks GROUP BY country ORDER BY count DESC LIMIT 10"
  );
  const topCountries: Record<string, number> = {};
  for (const r of countryRes.rows) {
    topCountries[String(r.country || 'Unknown')] = Number(r.count || 0);
  }

  const browserRes = await db.execute(
    "SELECT COALESCE(browser_name, 'Unknown') as browser_name, COUNT(*) as count FROM clicks GROUP BY browser_name ORDER BY count DESC LIMIT 10"
  );
  const topBrowsers: Record<string, number> = {};
  for (const r of browserRes.rows) {
    topBrowsers[String(r.browser_name || 'Unknown')] = Number(r.count || 0);
  }

  const refRes = await db.execute(
    "SELECT COALESCE(referrer, 'Direct') as referrer, COUNT(*) as count FROM clicks GROUP BY referrer ORDER BY count DESC LIMIT 10"
  );
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

export async function getRecentLinks(limit = 10, dbOverride?: Client): Promise<LinkRecord[]> {
  const db = dbOverride || (await getDb());
  const res = await db.execute({
    sql: 'SELECT * FROM links ORDER BY id DESC LIMIT ?',
    args: [limit],
  });

  return res.rows.map(mapLinkRow);
}

function mapMediaJobRow(row: any): MediaJobRecord {
  return {
    id: Number(row.id),
    job_id: String(row.job_id),
    module: String(row.module) as MediaModule,
    processing_mode: String(row.processing_mode) as ProcessingMode,
    input_filename: String(row.input_filename),
    input_mime: String(row.input_mime),
    input_size: Number(row.input_size || 0),
    output_format: String(row.output_format),
    output_size: row.output_size !== null && row.output_size !== undefined ? Number(row.output_size) : null,
    status: String(row.status) as MediaJobStatus,
    storage_key: row.storage_key ? String(row.storage_key) : null,
    output_storage_key: row.output_storage_key ? String(row.output_storage_key) : null,
    owner_token_hash: row.owner_token_hash ? String(row.owner_token_hash) : null,
    dedupe_key: row.dedupe_key ? String(row.dedupe_key) : null,
    retry_count: Number(row.retry_count || 0),
    max_retries: Number(row.max_retries ?? 2),
    error_message: row.error_message ? String(row.error_message) : null,
    expires_at: row.expires_at ? String(row.expires_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function createMediaJob(
  data: {
    jobId: string;
    module: MediaModule;
    processingMode: ProcessingMode;
    inputFilename: string;
    inputMime: string;
    inputSize: number;
    outputFormat: string;
    outputSize?: number | null;
    status?: MediaJobStatus;
    storageKey?: string | null;
    outputStorageKey?: string | null;
    ownerTokenHash?: string | null;
    dedupeKey?: string | null;
    maxRetries?: number;
    errorMessage?: string | null;
    expiresAt?: string | null;
  },
  dbOverride?: Client
): Promise<MediaJobRecord> {
  const db = dbOverride || (await getDb());
  await db.execute({
    sql: `INSERT INTO media_jobs (
      job_id, module, processing_mode, input_filename, input_mime, input_size,
      output_format, output_size, status, storage_key, output_storage_key,
      owner_token_hash, dedupe_key, retry_count, max_retries,
      error_message, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, datetime('now'), datetime('now'))`,
    args: [
      data.jobId,
      data.module,
      data.processingMode,
      data.inputFilename,
      data.inputMime,
      data.inputSize,
      data.outputFormat,
      data.outputSize ?? null,
      data.status || 'completed',
      data.storageKey ?? null,
      data.outputStorageKey ?? null,
      data.ownerTokenHash ?? null,
      data.dedupeKey ?? null,
      data.maxRetries ?? 2,
      data.errorMessage ?? null,
      data.expiresAt ?? null,
    ],
  });

  const job = await getMediaJobById(data.jobId, db);
  if (!job) throw new Error('Failed to create media job record');
  return job;
}

export async function findActiveJobByDedupeKey(
  dedupeKey: string,
  dbOverride?: Client
): Promise<MediaJobRecord | null> {
  const db = dbOverride || (await getDb());
  const res = await db.execute({
    sql: "SELECT * FROM media_jobs WHERE dedupe_key = ? AND status IN ('queued', 'processing') ORDER BY id DESC LIMIT 1",
    args: [dedupeKey],
  });
  if (res.rows.length === 0) return null;
  return mapMediaJobRow(res.rows[0]);
}

export async function claimNextQueuedJob(dbOverride?: Client): Promise<MediaJobRecord | null> {
  const db = dbOverride || (await getDb());
  const queued = await getQueuedMediaJobs(1, db);
  if (queued.length === 0) return null;

  const candidate = queued[0];
  const updateRes = await db.execute({
    sql: "UPDATE media_jobs SET status = 'processing', updated_at = datetime('now') WHERE job_id = ? AND status = 'queued'",
    args: [candidate.job_id],
  });

  if ((updateRes.rowsAffected || 0) === 0) {
    return null; // Claimed concurrently by another worker
  }

  return await getMediaJobById(candidate.job_id, db);
}

export async function failOrRetryMediaJob(
  jobId: string,
  errorMessage: string,
  dbOverride?: Client
): Promise<MediaJobRecord | null> {
  const db = dbOverride || (await getDb());
  const existing = await getMediaJobById(jobId, db);
  if (!existing) return null;

  const nextRetries = existing.retry_count + 1;
  const shouldRetry = nextRetries <= existing.max_retries;
  const nextStatus: MediaJobStatus = shouldRetry ? 'queued' : 'failed';

  await db.execute({
    sql: `UPDATE media_jobs
      SET status = ?, retry_count = ?, error_message = ?, updated_at = datetime('now')
      WHERE job_id = ?`,
    args: [nextStatus, nextRetries, errorMessage, jobId],
  });

  return await getMediaJobById(jobId, db);
}

export async function markMediaJobExpired(
  jobId: string,
  dbOverride?: Client
): Promise<void> {
  const db = dbOverride || (await getDb());
  await db.execute({
    sql: "UPDATE media_jobs SET status = 'expired', storage_key = NULL, output_storage_key = NULL, updated_at = datetime('now') WHERE job_id = ?",
    args: [jobId],
  });
}

export async function updateMediaJob(
  jobId: string,
  updates: {
    status?: MediaJobStatus;
    outputSize?: number | null;
    outputStorageKey?: string | null;
    errorMessage?: string | null;
  },
  dbOverride?: Client
): Promise<MediaJobRecord | null> {
  const db = dbOverride || (await getDb());
  const existing = await getMediaJobById(jobId, db);
  if (!existing) return null;

  await db.execute({
    sql: `UPDATE media_jobs
      SET status = ?, output_size = ?, output_storage_key = ?, error_message = ?, updated_at = datetime('now')
      WHERE job_id = ?`,
    args: [
      updates.status ?? existing.status,
      updates.outputSize !== undefined ? updates.outputSize : existing.output_size,
      updates.outputStorageKey !== undefined ? updates.outputStorageKey : existing.output_storage_key,
      updates.errorMessage !== undefined ? updates.errorMessage : existing.error_message,
      jobId,
    ],
  });

  return await getMediaJobById(jobId, db);
}

export async function getMediaJobById(jobId: string, dbOverride?: Client): Promise<MediaJobRecord | null> {
  const db = dbOverride || (await getDb());
  const res = await db.execute({
    sql: 'SELECT * FROM media_jobs WHERE job_id = ? LIMIT 1',
    args: [jobId],
  });
  if (res.rows.length === 0) return null;
  return mapMediaJobRow(res.rows[0]);
}

export async function getRecentMediaJobs(limit = 15, dbOverride?: Client): Promise<MediaJobRecord[]> {
  const db = dbOverride || (await getDb());
  const res = await db.execute({
    sql: 'SELECT * FROM media_jobs ORDER BY id DESC LIMIT ?',
    args: [limit],
  });
  return res.rows.map(mapMediaJobRow);
}

export async function getQueuedMediaJobs(limit = 5, dbOverride?: Client): Promise<MediaJobRecord[]> {
  const db = dbOverride || (await getDb());
  const res = await db.execute({
    sql: "SELECT * FROM media_jobs WHERE status = 'queued' ORDER BY id ASC LIMIT ?",
    args: [limit],
  });
  return res.rows.map(mapMediaJobRow);
}

export async function getExpiredMediaJobs(dbOverride?: Client): Promise<MediaJobRecord[]> {
  const db = dbOverride || (await getDb());
  const res = await db.execute(
    "SELECT * FROM media_jobs WHERE expires_at IS NOT NULL AND expires_at < datetime('now') AND status != 'expired'"
  );
  return res.rows.map(mapMediaJobRow);
}

export async function getStorageUsageSummary(
  objectStorageConfigured: boolean,
  dbOverride?: Client
): Promise<StorageUsageSummary> {
  const db = dbOverride || (await getDb());
  const res = await db.execute(`
    SELECT
      COUNT(*) as total_jobs,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
      SUM(CASE WHEN status = 'queued' OR status = 'processing' THEN 1 ELSE 0 END) as queued_jobs,
      COALESCE(SUM(input_size), 0) as total_input_bytes,
      COALESCE(SUM(output_size), 0) as total_output_bytes,
      COALESCE(SUM(CASE WHEN status IN ('queued', 'processing', 'completed') AND (storage_key IS NOT NULL OR output_storage_key IS NOT NULL) THEN COALESCE(input_size, 0) + COALESCE(output_size, 0) ELSE 0 END), 0) as active_storage_bytes
    FROM media_jobs
  `);

  const row = (res.rows[0] as any) || {};
  return {
    totalJobs: Number(row.total_jobs || 0),
    completedJobs: Number(row.completed_jobs || 0),
    queuedJobs: Number(row.queued_jobs || 0),
    totalInputBytes: Number(row.total_input_bytes || 0),
    totalOutputBytes: Number(row.total_output_bytes || 0),
    activeStorageBytes: Number(row.active_storage_bytes || 0),
    objectStorageConfigured,
  };
}
