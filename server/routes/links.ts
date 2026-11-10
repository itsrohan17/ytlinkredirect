import { NextFunction, Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import {
  createLink,
  deleteLinkByCode,
  getGlobalAnalyticsDashboard,
  getLinkByCode,
  getLinkOwnerHashByCode,
  getLinkStats,
  getPlatformAnalyticsSummary,
  getRecentLinks,
  isCodeAvailable,
  listLinksPaginated,
  rotateOwnerSessionHash,
  updateLinkByCode,
} from '../db.js';
import { detectPlatform, fetchPlatformMetadata, parsePlatformUrl } from '../platforms/index.js';
import {
  extractSessionToken,
  generateSessionToken,
  getCallerSessionHash,
  hashSessionToken,
  safeEqualHash,
  setSessionCookie,
} from '../services/session.js';

export const linksRouter = Router();

const RESERVED_WORDS = new Set([
  'api',
  'admin',
  'assets',
  'static',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'health',
  'status',
  'preview',
  'stats',
  'summary',
  'recent',
  'analytics',
  'session',
  'links',
  'media',
  'jobs',
  'utilities',
]);

function isValidCustomSlug(slug: string): boolean {
  if (slug.length < 3 || slug.length > 32) return false;
  if (RESERVED_WORDS.has(slug.toLowerCase())) return false;
  return /^[a-zA-Z0-9_\-]+$/.test(slug);
}

async function generateUniqueCode(length = 6): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = nanoid(length);
    if ((await isCodeAvailable(code)) && !RESERVED_WORDS.has(code.toLowerCase())) {
      return code;
    }
  }
  return nanoid(8);
}

function getBaseUrl(req: Request): string {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/+$/, '');
  }
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || (process.env.VERCEL ? 'https' : req.protocol || 'http');
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
  return `${protocol}://${host}`;
}

// POST /api/links - Create a new smart redirect link (YouTube, Instagram, Facebook only)
linksRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { url, customSlug } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Please provide a valid URL.' });
    }

    const trimmedUrl = url.trim();
    const platform = detectPlatform(trimmedUrl);

    if (!platform) {
      return res.status(400).json({
        error: 'Unsupported URL. Only valid YouTube, Instagram, and Facebook links are supported.',
      });
    }

    let code = '';
    if (customSlug && typeof customSlug === 'string') {
      const slug = customSlug.trim();
      if (!isValidCustomSlug(slug)) {
        return res.status(400).json({
          error:
            'Custom slug must be 3-32 characters long and contain only letters, numbers, hyphens, and underscores.',
        });
      }
      const available = await isCodeAvailable(slug);
      if (!available) {
        return res
          .status(409)
          .json({ error: `Custom slug "${slug}" is already taken. Please choose another.` });
      }
      code = slug;
    } else {
      code = await generateUniqueCode(6);
    }

    const parsed = parsePlatformUrl(trimmedUrl);
    const metadata = await fetchPlatformMetadata(parsed);

    let sessionToken = extractSessionToken(req);
    if (!sessionToken) {
      sessionToken = generateSessionToken();
      setSessionCookie(req, res, sessionToken);
    }
    const ownerTokenHash = hashSessionToken(sessionToken);

    const linkRecord = await createLink({
      code,
      platform: parsed.platform,
      originalUrl: trimmedUrl,
      cleanUrl: parsed.cleanUrl,
      urlType: parsed.type,
      contentId: parsed.contentId,
      videoId: parsed.videoId,
      playlistId: parsed.playlistId,
      channelId: parsed.channelPath,
      title: metadata.title,
      authorName: metadata.authorName,
      thumbnailUrl: metadata.thumbnailUrl,
      ownerTokenHash,
    });

    const shortUrl = `${getBaseUrl(req)}/${code}`;

    return res.status(201).json({
      success: true,
      platform: parsed.platform,
      link: { ...linkRecord, canManage: true },
      shortUrl,
      parsed,
    });
  } catch (err: any) {
    console.error('Error generating smart link:', err);
    return res.status(500).json({ error: 'Server error generating link. Please try again.' });
  }
});

// GET /api/preview - Real-time metadata preview for pasted URL
linksRouter.get('/preview', async (req: Request, res: Response) => {
  try {
    const url = req.query.url as string;
    const platform = detectPlatform(url);
    if (!url || !platform) {
      return res.status(400).json({
        error: 'Unsupported URL. Only YouTube, Instagram, and Facebook links are supported.',
      });
    }

    const parsed = parsePlatformUrl(url);
    const metadata = await fetchPlatformMetadata(parsed);

    return res.json({
      success: true,
      platform,
      parsed,
      metadata,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch preview' });
  }
});

// POST /api/links/session - Bootstrap an anonymous isolated HttpOnly workspace session
linksRouter.post('/session', (req: Request, res: Response) => {
  let token = extractSessionToken(req);
  if (!token) {
    token = generateSessionToken();
    setSessionCookie(req, res, token);
  }
  return res.json({ success: true, initialized: true });
});

// POST /api/links/session/rotate - Rotate workspace session key and invalidate old cookie
linksRouter.post('/session/rotate', async (req: Request, res: Response) => {
  try {
    const oldHash = getCallerSessionHash(req);
    const newToken = generateSessionToken();
    const newHash = hashSessionToken(newToken);
    if (oldHash) {
      await rotateOwnerSessionHash(oldHash, newHash);
    }
    setSessionCookie(req, res, newToken);
    return res.json({ success: true, rotated: true });
  } catch (err) {
    console.error('❌ [Session Rotate Error]:', err);
    return res.status(500).json({ error: 'Failed to rotate session key.' });
  }
});

// GET /api/links - Paginated Smart Links listing strictly scoped to caller session
linksRouter.get('/', async (req: Request, res: Response) => {
  try {
    const callerHash = getCallerSessionHash(req);
    if (!callerHash) {
      return res.status(401).json({
        error: 'Authentication session required to access dashboard links.',
      });
    }
    const result = await listLinksPaginated({
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 12),
      search: String(req.query.q || ''),
      platform: String(req.query.platform || 'all'),
      sort: String(req.query.sort || 'newest'),
      callerOwnerHash: callerHash,
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('❌ [List Links Error]:', err);
    return res.status(500).json({ error: 'Failed to load links.' });
  }
});

// GET /api/links/analytics - Owner-scoped aggregated analytics dashboard
linksRouter.get('/analytics', async (req: Request, res: Response) => {
  try {
    const callerHash = getCallerSessionHash(req);
    if (!callerHash) {
      return res.status(401).json({
        error: 'Authentication session required to access analytics.',
      });
    }
    const analytics = await getGlobalAnalyticsDashboard({
      ownerTokenHash: callerHash,
      range: String(req.query.range || '30d'),
      platform: String(req.query.platform || 'all'),
      activityPage: Number(req.query.activityPage || 1),
      activityLimit: Number(req.query.activityLimit || 12),
    });
    return res.json({ success: true, analytics });
  } catch (err) {
    console.error('❌ [Global Analytics Error]:', err);
    return res.status(500).json({ error: 'Failed to load analytics.' });
  }
});

// GET /api/links/summary - Owner-scoped multi-platform analytics summary
linksRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    const callerHash = getCallerSessionHash(req);
    if (!callerHash) {
      return res.status(401).json({
        error: 'Authentication session required to access dashboard summary.',
      });
    }
    const summary = await getPlatformAnalyticsSummary(callerHash);
    return res.json({ success: true, summary });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch platform analytics summary' });
  }
});

// GET /api/links/recent - Owner-scoped recent links
linksRouter.get('/recent', async (req: Request, res: Response) => {
  try {
    const callerHash = getCallerSessionHash(req);
    if (!callerHash) {
      return res.status(401).json({
        error: 'Authentication session required to access recent links.',
      });
    }
    const links = await getRecentLinks(12, undefined, callerHash);
    return res.json({ success: true, links });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch recent links' });
  }
});

// GET /api/links/:code - Single link details (owner-only; skips /api catch-all so unknown /api/* returns 404 JSON)
linksRouter.get('/:code', async (req: Request, res: Response, next: NextFunction) => {
  if (req.baseUrl !== '/api/links' && req.baseUrl !== '/links') {
    return next();
  }
  try {
    const code = String(req.params.code || '');
    const callerHash = getCallerSessionHash(req);
    if (!callerHash) {
      return res.status(401).json({ error: 'Authentication session required.' });
    }
    const ownerInfo = await getLinkOwnerHashByCode(code);
    if (!ownerInfo) {
      return res.status(404).json({ error: 'Link not found' });
    }
    if (!safeEqualHash(ownerInfo.ownerTokenHash, callerHash)) {
      return res.status(403).json({
        error: 'Unauthorized: you do not have access to this link record.',
      });
    }
    const link = await getLinkByCode(code, undefined, callerHash);
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }
    const shortUrl = `${getBaseUrl(req)}/${code}`;
    return res.json({
      success: true,
      link,
      shortUrl,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/links/:code - Edit title or destination URL (session-owner authorized, preserves short code)
linksRouter.patch('/:code', async (req: Request, res: Response) => {
  try {
    const code = String(req.params.code || '');
    const callerHash = getCallerSessionHash(req);
    if (!callerHash) {
      return res.status(401).json({ error: 'Authentication session required to edit links.' });
    }
    const ownerInfo = await getLinkOwnerHashByCode(code);
    if (!ownerInfo) {
      return res.status(404).json({ error: 'Link not found.' });
    }
    if (!safeEqualHash(ownerInfo.ownerTokenHash, callerHash)) {
      return res.status(403).json({
        error: 'Unauthorized: only links created in your current workspace session can be edited.',
      });
    }

    const { title, originalUrl } = req.body || {};
    const updates: Parameters<typeof updateLinkByCode>[1] = {};

    if (typeof title === 'string') {
      const cleanTitle = title.trim().slice(0, 200);
      if (!cleanTitle) {
        return res.status(400).json({ error: 'Link title cannot be empty.' });
      }
      updates.title = cleanTitle;
    }

    if (typeof originalUrl === 'string' && originalUrl.trim()) {
      const trimmed = originalUrl.trim();
      const platform = detectPlatform(trimmed);
      if (!platform) {
        return res.status(400).json({
          error: 'Destination URL must be a valid YouTube, Instagram, or Facebook URL.',
        });
      }
      const parsed = parsePlatformUrl(trimmed);
      updates.originalUrl = trimmed;
      updates.cleanUrl = parsed.cleanUrl;
      updates.platform = parsed.platform;
      updates.urlType = parsed.type;
      updates.contentId = parsed.contentId ?? null;
      updates.videoId = parsed.videoId ?? null;
      updates.playlistId = parsed.playlistId ?? null;
      updates.channelId = parsed.channelPath ?? null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Provide a valid title or destination URL to update.' });
    }

    const updated = await updateLinkByCode(code, updates, undefined, callerHash);
    return res.json({ success: true, link: updated });
  } catch (err) {
    console.error('❌ [Update Link Error]:', err);
    return res.status(500).json({ error: 'Failed to update link.' });
  }
});

// DELETE /api/links/:code - Delete link (session-owner authorized)
linksRouter.delete('/:code', async (req: Request, res: Response) => {
  try {
    const code = String(req.params.code || '');
    const callerHash = getCallerSessionHash(req);
    if (!callerHash) {
      return res.status(401).json({ error: 'Authentication session required to delete links.' });
    }
    const ownerInfo = await getLinkOwnerHashByCode(code);
    if (!ownerInfo) {
      return res.status(404).json({ error: 'Link not found.' });
    }
    if (!safeEqualHash(ownerInfo.ownerTokenHash, callerHash)) {
      return res.status(403).json({
        error: 'Unauthorized: only links created in your current workspace session can be deleted.',
      });
    }

    const deleted = await deleteLinkByCode(code);
    if (!deleted) {
      return res.status(404).json({ error: 'Link not found.' });
    }
    return res.json({ success: true, deletedCode: code });
  } catch (err) {
    console.error('❌ [Delete Link Error]:', err);
    return res.status(500).json({ error: 'Failed to delete link.' });
  }
});

// GET /api/links/:code/stats - Detailed analytics (owner-only)
linksRouter.get('/:code/stats', async (req: Request, res: Response) => {
  try {
    const code = String(req.params.code || '');
    const callerHash = getCallerSessionHash(req);
    if (!callerHash) {
      return res.status(401).json({ error: 'Authentication session required to view link stats.' });
    }
    const ownerInfo = await getLinkOwnerHashByCode(code);
    if (!ownerInfo) {
      return res.status(404).json({ error: 'Link not found' });
    }
    if (!safeEqualHash(ownerInfo.ownerTokenHash, callerHash)) {
      return res.status(403).json({
        error: 'Unauthorized: you do not have access to this link analytics.',
      });
    }
    const stats = await getLinkStats(code);
    if (!stats) {
      return res.status(404).json({ error: 'Link not found' });
    }
    return res.json({ success: true, stats });
  } catch (err) {
    return res.status(500).json({ error: 'Server error fetching stats' });
  }
});
