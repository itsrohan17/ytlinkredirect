import { Router, Request, Response } from 'express';
import { fetchYouTubeMetadata, isYouTubeUrl, parseYouTubeUrl } from '../platforms/youtube.js';
import { safeFetchExternalUrl } from '../services/fileSecurity.js';

export const thumbnailsRouter = Router();

interface ResolutionSpec {
  quality: 'maxres' | 'sd' | 'hq' | 'mq' | 'default';
  label: string;
  filenameSuffix: string;
  resolution: string;
  width: number;
  height: number;
}

const YOUTUBE_RESOLUTIONS: ResolutionSpec[] = [
  { quality: 'maxres', label: 'Maximum Resolution (HD)', filenameSuffix: 'maxresdefault.jpg', resolution: '1280 × 720', width: 1280, height: 720 },
  { quality: 'sd', label: 'Standard Definition', filenameSuffix: 'sddefault.jpg', resolution: '640 × 480', width: 640, height: 480 },
  { quality: 'hq', label: 'High Quality', filenameSuffix: 'hqdefault.jpg', resolution: '480 × 360', width: 480, height: 360 },
  { quality: 'mq', label: 'Medium Quality', filenameSuffix: 'mqdefault.jpg', resolution: '320 × 180', width: 320, height: 180 },
  { quality: 'default', label: 'Standard Thumbnail', filenameSuffix: 'default.jpg', resolution: '120 × 90', width: 120, height: 90 },
];

const QUALITY_TO_SPEC = new Map<string, ResolutionSpec>(
  YOUTUBE_RESOLUTIONS.map((s) => [s.quality, s])
);

function extractJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 < buf.length) {
    if (buf[offset] !== 0xff) break;
    const marker = buf[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2;
      continue;
    }
    const segLen = buf.readUInt16BE(offset + 2);
    if (segLen < 2 || offset + 2 + segLen > buf.length) break;
    // SOF0..SOF3 cover baseline, extended sequential, progressive, lossless JPEGs
    if ((marker >= 0xc0 && marker <= 0xc3) && segLen >= 7 && offset + 9 <= buf.length) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      if (width > 0 && height > 0) return { width, height };
    }
    offset += 2 + segLen;
  }
  return null;
}

// POST /api/thumbnails/inspect - Extract YouTube videoId & probe real available thumbnail resolutions
thumbnailsRouter.post('/inspect', async (req: Request, res: Response) => {
  try {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!rawUrl || !isYouTubeUrl(rawUrl)) {
      return res.status(400).json({
        error: 'Please enter a valid public YouTube video or YouTube Shorts URL.',
      });
    }

    const parsed = parseYouTubeUrl(rawUrl);
    if (!parsed.videoId) {
      return res.status(400).json({
        error: 'Could not extract a YouTube video ID from this URL. Playlists and channel homepages are not single-video thumbnails.',
      });
    }

    const videoId = parsed.videoId;
    const metadata = await fetchYouTubeMetadata(parsed);

    // Concurrently probe official i.ytimg.com endpoints via SSRF-safe HEAD requests
    const probed = await Promise.all(
      YOUTUBE_RESOLUTIONS.map(async (spec) => {
        const ytUrl = `https://i.ytimg.com/vi/${videoId}/${spec.filenameSuffix}`;
        let available = false;
        let sizeBytes: number | null = null;
        try {
          const probeRes = await safeFetchExternalUrl(ytUrl, {
            method: 'HEAD',
            timeoutMs: 3500,
            maxBytes: 1024 * 1024,
            maxRedirects: 1,
          });
          if (probeRes.status >= 200 && probeRes.status < 300) {
            available = true;
            const len = Number(probeRes.headers.get('content-length') || 0);
            if (Number.isFinite(len) && len > 0) sizeBytes = len;
          }
        } catch {
          available = false;
        }

        return {
          quality: spec.quality,
          label: spec.label,
          resolution: spec.resolution,
          width: spec.width,
          height: spec.height,
          available,
          sizeBytes,
          previewUrl: `/api/thumbnails/image?videoId=${encodeURIComponent(videoId)}&quality=${spec.quality}&inline=1`,
          downloadUrl: `/api/thumbnails/image?videoId=${encodeURIComponent(videoId)}&quality=${spec.quality}`,
          filename: `youtube-${videoId}-${spec.width}x${spec.height}.jpg`,
        };
      })
    );

    const availableVariants = probed.filter((v) => v.available);
    const highestAvailable = availableVariants[0] || null;

    return res.json({
      success: true,
      videoId,
      contentType: parsed.type,
      cleanUrl: parsed.cleanUrl,
      metadata: {
        title: metadata.title,
        authorName: metadata.authorName,
      },
      highestAvailable,
      resolutions: probed,
    });
  } catch (err) {
    console.error('❌ [YouTube Thumbnail Inspect Error]:', err);
    return res.status(500).json({ error: 'Failed to inspect YouTube thumbnail resolutions.' });
  }
});

// GET /api/thumbnails/image (and legacy /api/media/thumbnail alias)
thumbnailsRouter.get(['/image', '/thumbnail'], async (req: Request, res: Response) => {
  try {
    const videoId = String(req.query.videoId || '');
    const quality = String(req.query.quality || 'best').toLowerCase();
    const inline = req.query.inline === '1';
    const allowFallback = req.query.fallback === '1';

    if (!/^[a-zA-Z0-9_\-]{6,20}$/.test(videoId)) {
      return res.status(400).json({ error: 'Invalid YouTube video ID.' });
    }

    let chosenSpec = QUALITY_TO_SPEC.get(quality) || YOUTUBE_RESOLUTIONS[0];
    let imgRes: Awaited<ReturnType<typeof safeFetchExternalUrl>> | null = null;

    if (quality === 'best') {
      for (const candidate of YOUTUBE_RESOLUTIONS) {
        const candidateUrl = `https://i.ytimg.com/vi/${videoId}/${candidate.filenameSuffix}`;
        try {
          const probe = await safeFetchExternalUrl(candidateUrl, {
            timeoutMs: 4000,
            maxBytes: 10 * 1024 * 1024,
            maxRedirects: 1,
          });
          if (probe.status >= 200 && probe.status < 300) {
            chosenSpec = candidate;
            imgRes = probe;
            break;
          }
        } catch {
          // Try next lower resolution tier
        }
      }
    } else {
      const targetUrl = `https://i.ytimg.com/vi/${videoId}/${chosenSpec.filenameSuffix}`;
      imgRes = await safeFetchExternalUrl(targetUrl, {
        timeoutMs: 4000,
        maxBytes: 10 * 1024 * 1024,
        maxRedirects: 1,
      });

      if (imgRes.status >= 400 && allowFallback && chosenSpec.filenameSuffix !== 'hqdefault.jpg') {
        const fallbackSpec = QUALITY_TO_SPEC.get('hq')!;
        const fallbackUrl = `https://i.ytimg.com/vi/${videoId}/${fallbackSpec.filenameSuffix}`;
        const fallbackRes = await safeFetchExternalUrl(fallbackUrl, {
          timeoutMs: 4000,
          maxBytes: 10 * 1024 * 1024,
          maxRedirects: 1,
        });
        if (fallbackRes.status >= 200 && fallbackRes.status < 300) {
          chosenSpec = fallbackSpec;
          imgRes = fallbackRes;
        }
      }
    }

    if (!imgRes || imgRes.status >= 400) {
      return res.status(404).json({
        error: `Thumbnail resolution (${chosenSpec.resolution}) is not available for this video.`,
      });
    }

    const parsedDims = extractJpegDimensions(imgRes.bodyBuffer);
    const outW = parsedDims?.width || chosenSpec.width;
    const outH = parsedDims?.height || chosenSpec.height;

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Thumbnail-Quality', chosenSpec.quality);
    res.setHeader('X-Thumbnail-Width', String(outW));
    res.setHeader('X-Thumbnail-Height', String(outH));
    if (!inline) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="youtube-${videoId}-${outW}x${outH}.jpg"`
      );
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(imgRes.bodyBuffer);
  } catch (err) {
    console.error('❌ [YouTube Thumbnail Image Error]:', err);
    return res.status(500).json({ error: 'Failed to retrieve YouTube thumbnail.' });
  }
});
