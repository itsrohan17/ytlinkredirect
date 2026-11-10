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

// POST /api/media/inspect - Inspect permitted public assets, embed codes, and official owner download guidance
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

    const permittedAssets: PermittedAsset[] = [];
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
            filename: `youtube-thumbnail-${vid}-hd.jpg`,
          },
          {
            id: 'yt-sd',
            label: 'Standard Definition Thumbnail',
            format: 'JPG',
            resolution: '640 × 480',
            downloadUrl: `/api/media/thumbnail?videoId=${encodeURIComponent(vid)}&quality=sd`,
            filename: `youtube-thumbnail-${vid}-sd.jpg`,
          },
          {
            id: 'yt-hq',
            label: 'High Quality Thumbnail',
            format: 'JPG',
            resolution: '480 × 360',
            downloadUrl: `/api/media/thumbnail?videoId=${encodeURIComponent(vid)}&quality=hq`,
            filename: `youtube-thumbnail-${vid}-hq.jpg`,
          }
        );

        embedCode = `<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/${vid}" title="${metadata.title.replace(/"/g, '&quot;')}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
      }

      officialOwnerGuide = {
        title: 'Downloading Your Own YouTube Videos',
        steps: [
          'Sign in to YouTube Studio with the channel that owns the video.',
          'Go to Content in the left sidebar and hover over your video.',
          'Click the Options (⋮) menu and choose Download to save the MP4 file.',
        ],
        officialUrl: 'https://studio.youtube.com',
        officialLabel: 'Open YouTube Studio',
      };

      unsupportedExplanation =
        'Direct video/audio stream extraction is intentionally not provided. YouTube video streams use encrypted signatures and DASH protections; downloading third-party videos without authorization violates platform Terms of Service.';
    } else if (platform === 'instagram') {
      if (parsed.type === 'post' || parsed.type === 'reel') {
        embedCode = `<blockquote class="instagram-media" data-instgrm-permalink="${parsed.cleanUrl}" data-instgrm-version="14"></blockquote>\n<script async src="//www.instagram.com/embed.js"></script>`;
      }

      officialOwnerGuide = {
        title: 'Downloading Your Own Instagram Content',
        steps: [
          'For Reels & Posts you created: Open the Instagram app → navigate to your post/reel → tap (•••) → Save to Camera Roll / Download.',
          'For full account archives: Open Meta Accounts Center → Your Information and Permissions → Download Your Information.',
          'For Business/Creator integrations: Use the official Instagram Graph API with an authenticated account token.',
        ],
        officialUrl: 'https://accountscenter.instagram.com/info_and_permissions/',
        officialLabel: 'Open Meta Accounts Center',
      };

      unsupportedExplanation =
        'Instagram media files require authenticated Meta Graph API access and signed CDN URLs. Private accounts, Stories, and unauthenticated scraping of third-party Reels/photos are blocked by Meta and unsupported here.';
    } else if (platform === 'facebook') {
      if (parsed.type === 'video' || parsed.type === 'reel') {
        embedCode = `<iframe src="https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(parsed.cleanUrl)}&show_text=false&width=560" width="560" height="315" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>`;
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
        'Facebook restricts direct media stream downloads for non-owned videos, private profiles, and private groups. Bypassing authentication or DRM protections is not permitted or supported.';
    }

    return res.json({
      success: true,
      platform,
      contentType: parsed.type,
      cleanUrl: parsed.cleanUrl,
      metadata,
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

// GET /api/media/thumbnail - Safely proxy public YouTube thumbnails from i.ytimg.com with download header
mediaRouter.get('/thumbnail', async (req: Request, res: Response) => {
  try {
    const videoId = String(req.query.videoId || '');
    const quality = String(req.query.quality || 'maxres');

    // Strict validation to prevent SSRF or path traversal
    if (!/^[a-zA-Z0-9_\-]{6,20}$/.test(videoId)) {
      return res.status(400).json({ error: 'Invalid YouTube video ID.' });
    }

    let filenameVariant = 'maxresdefault.jpg';
    if (quality === 'sd') filenameVariant = 'sddefault.jpg';
    else if (quality === 'hq') filenameVariant = 'hqdefault.jpg';

    let targetUrl = `https://i.ytimg.com/vi/${videoId}/${filenameVariant}`;
    let imgRes = await fetch(targetUrl);

    // Fallback to hqdefault if maxresdefault doesn't exist for this video
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
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="youtube-thumbnail-${videoId}-${quality}.jpg"`
    );
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch (err) {
    console.error('❌ [Thumbnail Download Error]:', err);
    return res.status(500).json({ error: 'Failed to download thumbnail.' });
  }
});
