import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { createLink, getLinkByCode, getLinkStats, getRecentLinks, isCodeAvailable } from '../db.js';
import { fetchYouTubeMetadata, isYouTubeUrl, parseYouTubeUrl } from '../youtube.js';

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
]);

// Helper to sanitize slug
function isValidCustomSlug(slug: string): boolean {
  if (slug.length < 3 || slug.length > 32) return false;
  if (RESERVED_WORDS.has(slug.toLowerCase())) return false;
  return /^[a-zA-Z0-9_\-]+$/.test(slug);
}

// Generate unique short code
function generateUniqueCode(length = 6): string {
  for (let i = 0; i < 10; i++) {
    const code = nanoid(length);
    if (isCodeAvailable(code) && !RESERVED_WORDS.has(code.toLowerCase())) {
      return code;
    }
  }
  return nanoid(8);
}

// POST /api/links - Create a new smart redirect link
linksRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { url, customSlug } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Please provide a valid YouTube URL.' });
    }

    const trimmedUrl = url.trim();

    if (!isYouTubeUrl(trimmedUrl)) {
      return res.status(400).json({
        error: 'Invalid YouTube link. Only valid YouTube videos, Shorts, Playlists, or Channels are supported.',
      });
    }

    let code = '';
    if (customSlug && typeof customSlug === 'string') {
      const slug = customSlug.trim();
      if (!isValidCustomSlug(slug)) {
        return res.status(400).json({
          error: 'Custom slug must be 3-32 characters long and contain only letters, numbers, hyphens, and underscores.',
        });
      }
      if (!isCodeAvailable(slug)) {
        return res.status(409).json({ error: `Custom slug "${slug}" is already taken. Please choose another.` });
      }
      code = slug;
    } else {
      code = generateUniqueCode(6);
    }

    // Parse URL structure
    const parsed = parseYouTubeUrl(trimmedUrl);

    // Fetch rich metadata
    const metadata = await fetchYouTubeMetadata(trimmedUrl, parsed);

    // Save to Database
    const linkRecord = createLink({
      code,
      originalUrl: trimmedUrl,
      cleanUrl: parsed.cleanUrl,
      urlType: parsed.type,
      videoId: parsed.videoId,
      playlistId: parsed.playlistId,
      channelId: parsed.channelPath,
      title: metadata.title,
      authorName: metadata.authorName,
      thumbnailUrl: metadata.thumbnailUrl,
    });

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const shortUrl = `${protocol}://${host}/${code}`;

    return res.status(201).json({
      success: true,
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
    if (!url || !isYouTubeUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const parsed = parseYouTubeUrl(url);
    const metadata = await fetchYouTubeMetadata(url, parsed);

    return res.json({
      success: true,
      parsed,
      metadata,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch preview' });
  }
});

// GET /api/links/recent - Recent links for user showcase
linksRouter.get('/recent', (_req: Request, res: Response) => {
  try {
    const links = getRecentLinks(12);
    return res.json({ success: true, links });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch recent links' });
  }
});

// GET /api/links/:code - Single link details
linksRouter.get('/:code', (req: Request, res: Response) => {
  try {
    const code = String(req.params.code || '');
    const link = getLinkByCode(code);
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    return res.json({
      success: true,
      link,
      shortUrl: `${protocol}://${host}/${code}`,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/links/:code/stats - Detailed analytics
linksRouter.get('/:code/stats', (req: Request, res: Response) => {
  try {
    const code = String(req.params.code || '');
    const stats = getLinkStats(code);
    if (!stats) {
      return res.status(404).json({ error: 'Link not found' });
    }
    return res.json({ success: true, stats });
  } catch (err) {
    return res.status(500).json({ error: 'Server error fetching stats' });
  }
});
