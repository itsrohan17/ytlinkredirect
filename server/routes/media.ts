import { Router, Request, Response } from 'express';
import { detectPlatform, fetchPlatformMetadata, parsePlatformUrl } from '../platforms/index.js';
import { safeFetchExternalUrl } from '../services/fileSecurity.js';
import {
  isObjectStorageConfigured,
  MAX_BROWSER_MB,
  MAX_WORKER_MB,
} from '../services/storage.js';

export const mediaRouter = Router();

const ALLOWED_IMAGE_EXACT_HOSTS = new Set([
  'i.ytimg.com',
  'i1.ytimg.com',
  'i2.ytimg.com',
  'i3.ytimg.com',
  'i4.ytimg.com',
  'yt3.ggpht.com',
  'images.unsplash.com',
]);

function isAllowedImageCdn(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (ALLOWED_IMAGE_EXACT_HOSTS.has(host)) return true;
    if (host.endsWith('.cdninstagram.com')) return true;
    if (host.endsWith('.fbcdn.net')) return true;
    if (host.endsWith('.fbsbx.com')) return true;
    return false;
  } catch {
    return false;
  }
}

// GET /api/media/video - Video Converter capabilities & worker/storage status
mediaRouter.get('/video', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    module: 'video-converter',
    supportedInputs: ['mp4', 'webm', 'mov', 'mkv', 'avi', 'gif'],
    supportedOutputs: ['mp4', 'webm', 'gif'],
    resolutions: ['original', '360p', '480p', '720p', '1080p', '1440p'],
    maxBrowserMb: MAX_BROWSER_MB,
    maxWorkerMb: MAX_WORKER_MB,
    objectStorageConfigured: isObjectStorageConfigured(),
  });
});

// GET /api/media/image - Image Studio capabilities
mediaRouter.get('/image', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    module: 'image-studio',
    supportedFormats: ['jpg', 'png', 'webp', 'avif', 'gif'],
    processingMode: 'browser-canvas',
  });
});

// GET /api/media/audio - Audio Studio capabilities & worker/storage status
mediaRouter.get('/audio', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    module: 'audio-studio',
    supportedInputs: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'webm'],
    supportedOutputs: ['mp3', 'wav', 'aac', 'flac', 'ogg'],
    maxBrowserMb: MAX_BROWSER_MB,
    maxWorkerMb: MAX_WORKER_MB,
    objectStorageConfigured: isObjectStorageConfigured(),
  });
});

// Shared handler for public thumbnail & preview metadata extraction (YouTube, Instagram, Facebook ONLY)
async function handleThumbnailInspect(req: Request, res: Response) {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Please provide a valid URL.' });
    }

    const trimmed = url.trim();
    const platform = detectPlatform(trimmed);
    if (!platform) {
      return res.status(400).json({
        error: 'Unsupported URL. Thumbnail Studio supports public YouTube, Instagram, and Facebook URLs.',
      });
    }

    const parsed = parsePlatformUrl(trimmed);
    const metadata = await fetchPlatformMetadata(parsed);

    const thumbnailAssets: Array<{
      id: string;
      label: string;
      format: string;
      resolution: string;
      downloadUrl: string;
      filename: string;
    }> = [];

    if (platform === 'youtube' && parsed.videoId) {
      const vid = parsed.videoId;
      thumbnailAssets.push(
        {
          id: 'yt-maxres',
          label: 'Maximum Resolution',
          format: 'JPG',
          resolution: '1280 × 720',
          downloadUrl: `/api/media/thumbnail?videoId=${encodeURIComponent(vid)}&quality=maxres`,
          filename: `youtube-${vid}-1280x720.jpg`,
        },
        {
          id: 'yt-sd',
          label: 'Standard Definition',
          format: 'JPG',
          resolution: '640 × 480',
          downloadUrl: `/api/media/thumbnail?videoId=${encodeURIComponent(vid)}&quality=sd`,
          filename: `youtube-${vid}-640x480.jpg`,
        },
        {
          id: 'yt-hq',
          label: 'High Quality',
          format: 'JPG',
          resolution: '480 × 360',
          downloadUrl: `/api/media/thumbnail?videoId=${encodeURIComponent(vid)}&quality=hq`,
          filename: `youtube-${vid}-480x360.jpg`,
        }
      );
    } else {
      thumbnailAssets.push({
        id: `${platform}-preview`,
        label: 'Public Preview Image',
        format: 'JPG',
        resolution: 'Original Available',
        downloadUrl: `/api/media/image-proxy?url=${encodeURIComponent(metadata.thumbnailUrl)}`,
        filename: `${platform}-${parsed.contentId || 'preview'}.jpg`,
      });
    }

    const thumbnailProxyUrl =
      platform === 'youtube' && parsed.videoId
        ? `/api/media/thumbnail?videoId=${encodeURIComponent(parsed.videoId)}&quality=maxres&inline=1`
        : `/api/media/image-proxy?url=${encodeURIComponent(metadata.thumbnailUrl)}`;

    return res.json({
      success: true,
      platform,
      contentType: parsed.type,
      cleanUrl: parsed.cleanUrl,
      contentId: parsed.contentId || parsed.videoId,
      metadata,
      thumbnailInfo: {
        proxyUrl: thumbnailProxyUrl,
        originalUrl: metadata.thumbnailUrl,
        youtubeVideoId: parsed.videoId,
      },
      permittedAssets: thumbnailAssets,
      publicAccessNote:
        platform === 'youtube'
          ? 'Thumbnails are retrieved from official public YouTube metadata and i.ytimg.com.'
          : 'Only publicly accessible OpenGraph preview images are shown. Private or restricted content is never scraped or bypassed.',
    });
  } catch (err: any) {
    console.error('❌ [Thumbnail Inspect Error]:', err);
    return res.status(500).json({ error: 'Failed to extract public thumbnail metadata.' });
  }
}

mediaRouter.post('/thumbnail/inspect', handleThumbnailInspect);
mediaRouter.post('/inspect', handleThumbnailInspect);

// GET /api/media/thumbnail - Preserve existing YouTube thumbnail retrieval from i.ytimg.com
mediaRouter.get('/thumbnail', async (req: Request, res: Response) => {
  try {
    const videoId = String(req.query.videoId || '');
    const quality = String(req.query.quality || 'maxres');
    const inline = req.query.inline === '1';

    if (!/^[a-zA-Z0-9_\-]{6,20}$/.test(videoId)) {
      return res.status(400).json({ error: 'Invalid YouTube video ID.' });
    }

    let filenameVariant = 'maxresdefault.jpg';
    if (quality === 'sd') filenameVariant = 'sddefault.jpg';
    else if (quality === 'hq') filenameVariant = 'hqdefault.jpg';

    let targetUrl = `https://i.ytimg.com/vi/${videoId}/${filenameVariant}`;
    let imgRes = await safeFetchExternalUrl(targetUrl, {
      timeoutMs: 4000,
      maxBytes: 5 * 1024 * 1024,
      maxRedirects: 1,
    });

    if (imgRes.status >= 400 && filenameVariant !== 'hqdefault.jpg') {
      targetUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      imgRes = await safeFetchExternalUrl(targetUrl, {
        timeoutMs: 4000,
        maxBytes: 5 * 1024 * 1024,
        maxRedirects: 1,
      });
    }

    if (imgRes.status >= 400) {
      return res.status(404).json({ error: 'Thumbnail not found for this video.' });
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (!inline) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="youtube-thumbnail-${videoId}-${quality}.jpg"`
      );
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(imgRes.bodyBuffer);
  } catch (err) {
    console.error('❌ [Thumbnail Download Error]:', err);
    return res.status(500).json({ error: 'Failed to download thumbnail.' });
  }
});

// GET /api/media/image-proxy - SSRF-hardened + allowlisted CORS-safe proxy for Thumbnail Studio canvas
mediaRouter.get('/image-proxy', async (req: Request, res: Response) => {
  try {
    const targetUrl = String(req.query.url || '');
    if (!targetUrl || !isAllowedImageCdn(targetUrl)) {
      return res.status(403).json({
        error: 'Image host is not in the allowlisted official media CDN list.',
      });
    }

    const imgRes = await safeFetchExternalUrl(targetUrl, {
      timeoutMs: 5000,
      maxBytes: 6 * 1024 * 1024,
      maxRedirects: 2,
    });

    if (imgRes.status >= 400) {
      return res.status(404).json({ error: 'Public thumbnail image unavailable.' });
    }

    const contentType = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0];
    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ error: 'Target asset is not an image.' });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(imgRes.bodyBuffer);
  } catch (err) {
    console.error('❌ [Image Proxy Error]:', err);
    return res.status(500).json({ error: 'Failed to load thumbnail image.' });
  }
});
