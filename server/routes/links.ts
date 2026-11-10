import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import {
  createLink,
  getLinkByCode,
  getLinkStats,
  getPlatformAnalyticsSummary,
  getRecentLinks,
  isCodeAvailable,
} from '../db.js';
import { detectPlatform, fetchPlatformMetadata, parsePlatformUrl } from '../platforms/index.js';

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
  'links',
  'media',
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
    });

    const shortUrl = `${getBaseUrl(req)}/${code}`;

    return res.status(201).json({
      success: true,
      platform: parsed.platform,
      link: linkRecord,
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

// GET /api/links/summary - Global multi-platform analytics summary
linksRouter.get('/summary', async (_req: Request, res: Response) => {
  try {
    const summary = await getPlatformAnalyticsSummary();
    return res.json({ success: true, summary });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch platform analytics summary' });
  }
});

// GET /api/links/recent - Recent links for user showcase
linksRouter.get('/recent', async (_req: Request, res: Response) => {
  try {
    const links = await getRecentLinks(12);
    return res.json({ success: true, links });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch recent links' });
  }
});

// GET /api/links/:code - Single link details
linksRouter.get('/:code', async (req: Request, res: Response) => {
  try {
    const code = String(req.params.code || '');
    const link = await getLinkByCode(code);
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

// GET /api/links/:code/stats - Detailed analytics
linksRouter.get('/:code/stats', async (req: Request, res: Response) => {
  try {
    const code = String(req.params.code || '');
    const stats = await getLinkStats(code);
    if (!stats) {
      return res.status(404).json({ error: 'Link not found' });
    }
    return res.json({ success: true, stats });
  } catch (err) {
    return res.status(500).json({ error: 'Server error fetching stats' });
  }
});
