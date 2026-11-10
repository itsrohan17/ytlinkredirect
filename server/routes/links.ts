import { NextFunction, Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import {
  createLink,
  getLinkByCode,
  getLinkOwnerHashByCode,
  getLinkStats,
  getPlatformAnalyticsSummary,
  getRecentLinks,
  isCodeAvailable,
  rotateOwnerSessionHash,
  upgradeCompatibleSessionHashes,
} from '../db.js';
import { detectPlatform, fetchPlatformMetadata, parsePlatformUrl } from '../platforms/index.js';
import {
  extractSessionToken,
  generateSessionToken,
  getSessionLookupHashes,
  handleSessionRouteError,
  hashSessionToken,
  requireSessionSigningSecret,
  safeEqualHash,
  setSessionCookie,
} from '../services/session.js';

export const linksRouter = Router();

async function resolveAuthorizedOwnerHash(req: Request): Promise<string | null> {
  const lookup = getSessionLookupHashes(req);
  if (!lookup) return null;
  await upgradeCompatibleSessionHashes(lookup.primaryHash, lookup.compatHashes);
  return lookup.primaryHash;
}

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
  'session',
  'links',
  'thumbnails',
  'thumbnail',
  'media',
  'ai',
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

    let ownerTokenHash: string;
    const existingLookup = getSessionLookupHashes(req);
    if (existingLookup) {
      await upgradeCompatibleSessionHashes(existingLookup.primaryHash, existingLookup.compatHashes);
      ownerTokenHash = existingLookup.primaryHash;
    } else {
      const sessionToken = generateSessionToken();
      ownerTokenHash = hashSessionToken(sessionToken);
      setSessionCookie(req, res, sessionToken);
    }

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
    return handleSessionRouteError(
      res,
      err,
      'Create Smart Link Error',
      'Server error generating link. Please try again.'
    );
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
  } catch {
    return res.status(500).json({ error: 'Failed to fetch preview' });
  }
});

// POST /api/links/session - Bootstrap an isolated HttpOnly workspace session
linksRouter.post('/session', (req: Request, res: Response) => {
  try {
    requireSessionSigningSecret();
    let token = extractSessionToken(req);
    if (!token) {
      token = generateSessionToken();
      setSessionCookie(req, res, token);
    }
    return res.json({ success: true, initialized: true });
  } catch (err) {
    return handleSessionRouteError(res, err, 'Session Bootstrap Error', 'Failed to initialize session.');
  }
});

// POST /api/links/session/rotate - Rotate workspace session key
linksRouter.post('/session/rotate', async (req: Request, res: Response) => {
  try {
    const oldLookup = getSessionLookupHashes(req);
    const newToken = generateSessionToken();
    const newHash = hashSessionToken(newToken);
    if (oldLookup) {
      await rotateOwnerSessionHash([oldLookup.primaryHash, ...oldLookup.compatHashes], newHash);
    }
    setSessionCookie(req, res, newToken);
    return res.json({ success: true, rotated: true });
  } catch (err) {
    return handleSessionRouteError(res, err, 'Session Rotate Error', 'Failed to rotate session key.');
  }
});

// GET /api/links/summary - Owner-scoped analytics summary
linksRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    const callerHash = await resolveAuthorizedOwnerHash(req);
    if (!callerHash) {
      return res.status(401).json({
        error: 'Authentication session required.',
      });
    }
    const summary = await getPlatformAnalyticsSummary(callerHash);
    return res.json({ success: true, summary });
  } catch (err) {
    return handleSessionRouteError(res, err, 'Analytics Summary Error', 'Failed to fetch summary');
  }
});

// GET /api/links/recent - Owner-scoped recent links
linksRouter.get('/recent', async (req: Request, res: Response) => {
  try {
    const callerHash = await resolveAuthorizedOwnerHash(req);
    if (!callerHash) {
      return res.status(401).json({
        error: 'Authentication session required.',
      });
    }
    const links = await getRecentLinks(12, undefined, callerHash);
    return res.json({ success: true, links });
  } catch (err) {
    return handleSessionRouteError(res, err, 'Recent Links Error', 'Failed to fetch recent links');
  }
});

// GET /api/links/:code - Single link details (owner-only)
linksRouter.get('/:code', async (req: Request, res: Response, next: NextFunction) => {
  if (req.baseUrl !== '/api/links' && req.baseUrl !== '/links') {
    return next();
  }
  try {
    const code = String(req.params.code || '');
    const callerHash = await resolveAuthorizedOwnerHash(req);
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
    return handleSessionRouteError(res, err, 'Get Link Error', 'Server error');
  }
});

// GET /api/links/:code/stats - Detailed per-link analytics (owner-only)
linksRouter.get('/:code/stats', async (req: Request, res: Response) => {
  try {
    const code = String(req.params.code || '');
    const callerHash = await resolveAuthorizedOwnerHash(req);
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
    return handleSessionRouteError(res, err, 'Link Stats Error', 'Server error fetching stats');
  }
});
