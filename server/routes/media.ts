import { Router, Request, Response } from 'express';
import { detectPlatform, fetchPlatformMetadata, parsePlatformUrl } from '../platforms/index.js';

export const mediaRouter = Router();

interface PermittedAsset {
  id: string;
  label: string;
  format: string;
  resolution?: string;
  downloadUrl: string;
  filename: string;
}

interface VideoStreamOption {
  id: string;
  format: 'MP4' | 'WebM';
  quality: '360p' | '480p' | '720p' | '1080p' | 'Original';
  fileSizeBytes: number | null;
  fileSizeLabel: string;
  downloadUrl: string;
  filename: string;
}

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

function isAllowedVideoCdn(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (host.endsWith('.cdninstagram.com')) return true;
    if (host.endsWith('.fbcdn.net')) return true;
    return false;
  } catch {
    return false;
  }
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return 'Size unknown';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function sanitizeFilenameSlug(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'media'
  );
}

function extractMetaTag(html: string, property: string): string | null {
  const regex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  const match = html.match(regex);
  if (match && match[1]) return match[1].replace(/&amp;/g, '&');

  const revRegex = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    'i'
  );
  const revMatch = html.match(revRegex);
  return revMatch && revMatch[1] ? revMatch[1].replace(/&amp;/g, '&') : null;
}

/**
 * Checks whether a public Meta page exposes an unencrypted direct MP4/WebM og:video URL.
 * Never attempts authentication bypass, private scraping, or cipher decryption.
 */
async function probePublicDirectVideoStream(
  pageUrl: string,
  slug: string
): Promise<VideoStreamOption[]> {
  const streams: VideoStreamOption[] = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(pageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return streams;
    const html = await res.text();
    const videoUrl =
      extractMetaTag(html, 'og:video:secure_url') ||
      extractMetaTag(html, 'og:video:url') ||
      extractMetaTag(html, 'og:video');

    if (!videoUrl || !isAllowedVideoCdn(videoUrl)) return streams;

    // Verify via HEAD that it is an actual direct MP4/WebM file and read file size
    const headCtrl = new AbortController();
    const headTimer = setTimeout(() => headCtrl.abort(), 2000);
    const headRes = await fetch(videoUrl, { method: 'HEAD', signal: headCtrl.signal });
    clearTimeout(headTimer);

    if (!headRes.ok) return streams;
    const contentType = (headRes.headers.get('content-type') || '').toLowerCase();
    const isMp4 = contentType.includes('video/mp4') || videoUrl.includes('.mp4');
    const isWebm = contentType.includes('video/webm') || videoUrl.includes('.webm');
    if (!isMp4 && !isWebm) return streams;

    const rawLength = headRes.headers.get('content-length');
    const fileSizeBytes = rawLength ? parseInt(rawLength, 10) : null;
    const format: 'MP4' | 'WebM' = isWebm ? 'WebM' : 'MP4';
    const ext = format.toLowerCase();

    streams.push({
      id: `public-${ext}-original`,
      format,
      quality: 'Original',
      fileSizeBytes: Number.isFinite(fileSizeBytes) ? fileSizeBytes : null,
      fileSizeLabel: formatBytes(Number.isFinite(fileSizeBytes) ? fileSizeBytes : null),
      downloadUrl: `/api/media/video-proxy?url=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(`${slug}.${ext}`)}`,
      filename: `${slug}.${ext}`,
    });
  } catch {
    // Public metadata not accessible or timed out
  }
  return streams;
}

// POST /api/media/inspect - Inspect permitted public assets, streams, embed codes, and owner download guides
mediaRouter.post('/inspect', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Please provide a valid URL.' });
    }

    const trimmed = url.trim();
    const platform = detectPlatform(trimmed);
    if (!platform) {
      return res.status(400).json({
        error: 'Unsupported URL. Media Tools only supports YouTube, Instagram, and Facebook URLs.',
      });
    }

    const parsed = parsePlatformUrl(trimmed);
    const metadata = await fetchPlatformMetadata(parsed);
    const titleSlug = sanitizeFilenameSlug(metadata.title);

    const permittedAssets: PermittedAsset[] = [];
    let availableStreams: VideoStreamOption[] = [];
    let embedCode: string | null = null;
    let officialOwnerGuide = {
      title: '',
      steps: [] as string[],
      officialUrl: '',
      officialLabel: '',
    };
    let unsupportedExplanation = '';

    if (platform === 'youtube') {
      if (parsed.videoId) {
        const vid = parsed.videoId;
        permittedAssets.push(
          {
            id: 'yt-maxres',
            label: 'HD Cover Thumbnail',
            format: 'JPG',
            resolution: '1280 × 720',
            downloadUrl: `/api/media/thumbnail?videoId=${encodeURIComponent(vid)}&quality=maxres`,
            filename: `youtube-${vid}-1280x720.jpg`,
          },
          {
            id: 'yt-sd',
            label: 'Standard Definition Thumbnail',
            format: 'JPG',
            resolution: '640 × 480',
            downloadUrl: `/api/media/thumbnail?videoId=${encodeURIComponent(vid)}&quality=sd`,
            filename: `youtube-${vid}-640x480.jpg`,
          },
          {
            id: 'yt-hq',
            label: 'High Quality Thumbnail',
            format: 'JPG',
            resolution: '480 × 360',
            downloadUrl: `/api/media/thumbnail?videoId=${encodeURIComponent(vid)}&quality=hq`,
            filename: `youtube-${vid}-480x360.jpg`,
          }
        );

        embedCode = `<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/${vid}" title="${metadata.title.replace(/"/g, '&quot;')}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
      }

      officialOwnerGuide = {
        title: 'Downloading Your Own YouTube Videos (MP4)',
        steps: [
          'Sign in to YouTube Studio with the channel that owns the video.',
          'Select Content from the left menu and hover over your video.',
          'Click Options (⋮) → Download to save the official MP4 file directly.',
        ],
        officialUrl: 'https://studio.youtube.com',
        officialLabel: 'Open YouTube Studio',
      };

      unsupportedExplanation =
        'YouTube does not expose unencrypted public MP4/WebM streams via official oEmbed APIs. Video streams use encrypted signatures and DASH/DRM protections; unauthorized stream scraping is not permitted. Creators can download their own uploads via YouTube Studio, or use Thumbnail Studio to export thumbnails in JPG, PNG, or WebP.';
    } else if (platform === 'instagram') {
      if (parsed.type === 'post' || parsed.type === 'reel') {
        embedCode = `<blockquote class="instagram-media" data-instgrm-permalink="${parsed.cleanUrl}" data-instgrm-version="14"></blockquote>\n<script async src="//www.instagram.com/embed.js"></script>`;
        availableStreams = await probePublicDirectVideoStream(parsed.cleanUrl, `instagram-${titleSlug}`);
      }

      officialOwnerGuide = {
        title: 'Downloading Your Own Instagram Content',
        steps: [
          'For Reels & Posts you own: Open the Instagram app → navigate to your post/reel → tap (•••) → Save to Camera Roll / Download.',
          'For full account archives: Open Meta Accounts Center → Your Information and Permissions → Download Your Information.',
          'For Business/Creator apps: Use the official Instagram Graph API with an authenticated owner token.',
        ],
        officialUrl: 'https://accountscenter.instagram.com/info_and_permissions/',
        officialLabel: 'Open Meta Accounts Center',
      };

      unsupportedExplanation =
        'Instagram protects video streams behind authenticated Meta Graph API tokens and signed CDN URLs. When public metadata does not expose a direct unencrypted MP4, third-party stream extraction is intentionally blocked. Use the official Instagram app or Meta Accounts Center to download content you own.';
    } else if (platform === 'facebook') {
      if (parsed.type === 'video' || parsed.type === 'reel') {
        embedCode = `<iframe src="https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(parsed.cleanUrl)}&show_text=false&width=560" width="560" height="315" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>`;
        availableStreams = await probePublicDirectVideoStream(parsed.cleanUrl, `facebook-${titleSlug}`);
      } else if (parsed.type === 'post') {
        embedCode = `<iframe src="https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(parsed.cleanUrl)}&width=500" width="500" height="450" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true"></iframe>`;
      }

      officialOwnerGuide = {
        title: 'Downloading Your Own Facebook Videos & Reels',
        steps: [
          'For Pages you manage: Open Meta Business Suite → Content → locate your video/reel → click (•••) → Download HD or SD.',
          'For personal uploads: Open the video on Facebook → click the (•••) menu → Download Video (available to the uploader).',
          'For full backups: Visit Settings & Privacy → Settings → Download Your Information.',
        ],
        officialUrl: 'https://business.facebook.com/',
        officialLabel: 'Open Meta Business Suite',
      };

      unsupportedExplanation =
        'Facebook restricts direct MP4/WebM downloads for non-owned videos, private profiles, and private groups. When a public unencrypted stream is not exposed by official metadata, bypassing authentication or DRM protections is unsupported.';
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
      videoDownloadInfo: {
        supported: availableStreams.length > 0,
        availableStreams,
        unsupportedReason: unsupportedExplanation,
      },
      thumbnailInfo: {
        proxyUrl: thumbnailProxyUrl,
        originalUrl: metadata.thumbnailUrl,
        youtubeVideoId: parsed.videoId,
      },
      permittedAssets,
      embedCode,
      officialOwnerGuide,
      unsupportedExplanation,
    });
  } catch (err: any) {
    console.error('❌ [Media Inspect Error]:', err);
    return res.status(500).json({ error: 'Failed to inspect media URL.' });
  }
});

// GET /api/media/thumbnail - Safely proxy public YouTube thumbnails from i.ytimg.com
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
    let imgRes = await fetch(targetUrl);

    if (!imgRes.ok && filenameVariant !== 'hqdefault.jpg') {
      targetUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      imgRes = await fetch(targetUrl);
    }

    if (!imgRes.ok) {
      return res.status(404).json({ error: 'Thumbnail not found for this video.' });
    }

    const arrayBuffer = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (!inline) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="youtube-thumbnail-${videoId}-${quality}.jpg"`
      );
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch (err) {
    console.error('❌ [Thumbnail Download Error]:', err);
    return res.status(500).json({ error: 'Failed to download thumbnail.' });
  }
});

// GET /api/media/image-proxy - Strictly allowlisted CORS-safe proxy for Thumbnail Studio canvas processing
mediaRouter.get('/image-proxy', async (req: Request, res: Response) => {
  try {
    const targetUrl = String(req.query.url || '');
    if (!targetUrl || !isAllowedImageCdn(targetUrl)) {
      return res.status(403).json({
        error: 'Image host is not in the allowlisted official media CDN list.',
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const imgRes = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (!imgRes.ok) {
      return res.status(404).json({ error: 'Public thumbnail image unavailable.' });
    }

    const contentType = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0];
    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ error: 'Target asset is not an image.' });
    }

    const arrayBuffer = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(buffer);
  } catch (err) {
    console.error('❌ [Image Proxy Error]:', err);
    return res.status(500).json({ error: 'Failed to load thumbnail image.' });
  }
});

// GET /api/media/video-proxy - Strictly allowlisted proxy for permitted public MP4/WebM streams
mediaRouter.get('/video-proxy', async (req: Request, res: Response) => {
  try {
    const targetUrl = String(req.query.url || '');
    const rawFilename = String(req.query.filename || 'media-video.mp4');
    const safeFilename = rawFilename.replace(/[^a-zA-Z0-9._\-]/g, '_').slice(0, 80);

    if (!targetUrl || !isAllowedVideoCdn(targetUrl)) {
      return res.status(403).json({
        error: 'Video CDN host is not permitted for direct proxying.',
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const vidRes = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (!vidRes.ok || !vidRes.body) {
      return res.status(404).json({ error: 'Permitted video stream is unavailable.' });
    }

    const contentType = (vidRes.headers.get('content-type') || 'video/mp4').split(';')[0];
    const contentLength = vidRes.headers.get('content-length');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    const arrayBuffer = await vidRes.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('❌ [Video Proxy Error]:', err);
    return res.status(500).json({ error: 'Failed to download permitted video stream.' });
  }
});
