import { ParsedYouTubeInfo, YouTubeMetadata, YouTubeUrlType } from './types.js';

const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'gaming.youtube.com',
  'youtu.be',
]);

/**
 * Validates whether the input string is a legitimate YouTube URL.
 */
export function isYouTubeUrl(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim();
  
  try {
    let urlString = trimmed;
    if (!/^https?:\/\//i.test(urlString)) {
      urlString = 'https://' + urlString;
    }
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase();
    
    // Check if host matches any allowed YouTube host (or subdomain of youtube.com)
    if (ALLOWED_HOSTS.has(host)) return true;
    if (host.endsWith('.youtube.com')) return true;
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Parses any YouTube URL and extracts type, IDs, parameters, and deep linking targets.
 */
export function parseYouTubeUrl(input: string): ParsedYouTubeInfo {
  let urlString = input.trim();
  if (!/^https?:\/\//i.test(urlString)) {
    urlString = 'https://' + urlString;
  }

  const url = new URL(urlString);
  const host = url.hostname.toLowerCase();
  const pathname = url.pathname;
  const searchParams = url.searchParams;

  const params: Record<string, string> = {};
  searchParams.forEach((val, key) => {
    params[key] = val;
  });

  let type: YouTubeUrlType = 'video';
  let videoId: string | undefined;
  let playlistId: string | undefined;
  let channelPath: string | undefined;
  let timestamp: string | undefined = params['t'] || params['start'] || params['time_continue'];

  // 1. youtu.be/VIDEO_ID
  if (host === 'youtu.be') {
    videoId = pathname.slice(1).split('/')[0].split('?')[0];
    type = 'video';
  }
  // 2. youtube.com/shorts/VIDEO_ID
  else if (pathname.startsWith('/shorts/')) {
    videoId = pathname.replace('/shorts/', '').split('/')[0].split('?')[0];
    type = 'shorts';
  }
  // 3. youtube.com/live/VIDEO_ID
  else if (pathname.startsWith('/live/')) {
    videoId = pathname.replace('/live/', '').split('/')[0].split('?')[0];
    type = 'live';
  }
  // 4. youtube.com/embed/VIDEO_ID
  else if (pathname.startsWith('/embed/')) {
    videoId = pathname.replace('/embed/', '').split('/')[0].split('?')[0];
    type = 'video';
  }
  // 5. youtube.com/playlist?list=PLAYLIST_ID
  else if (pathname.startsWith('/playlist')) {
    playlistId = searchParams.get('list') || undefined;
    type = 'playlist';
  }
  // 6. Channel formats: /@handle, /channel/UC..., /c/name, /user/name
  else if (pathname.startsWith('/@') || pathname.startsWith('/channel/') || pathname.startsWith('/c/') || pathname.startsWith('/user/')) {
    type = 'channel';
    channelPath = pathname.replace(/^\/+/, '');
  }
  // 7. Standard /watch?v=VIDEO_ID
  else if (pathname.startsWith('/watch')) {
    videoId = searchParams.get('v') || undefined;
    playlistId = searchParams.get('list') || undefined;
    type = 'video';
  }
  // 8. Root handle e.g. /mkbhd (rare)
  else if (/^\/[a-zA-Z0-9_\-\.]+$/.test(pathname) && pathname !== '/') {
    type = 'channel';
    channelPath = pathname.replace(/^\/+/, '');
  }

  // Clean, canonical Web URL reconstruction
  let cleanUrl = '';
  let iosSchemeUrl = '';
  let androidIntentUrl = '';
  let androidCustomSchemeUrl = '';

  const queryParts: string[] = [];
  if (timestamp) queryParts.push(`t=${encodeURIComponent(timestamp)}`);
  if (playlistId && type !== 'playlist') queryParts.push(`list=${encodeURIComponent(playlistId)}`);
  if (params['index']) queryParts.push(`index=${encodeURIComponent(params['index'])}`);

  const querySuffix = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

  if (type === 'shorts' && videoId) {
    cleanUrl = `https://www.youtube.com/shorts/${videoId}`;
    iosSchemeUrl = `youtube://www.youtube.com/shorts/${videoId}`;
    androidIntentUrl = `intent://www.youtube.com/shorts/${videoId}#Intent;package=com.google.android.youtube;scheme=https;S.browser_fallback_url=${encodeURIComponent(cleanUrl)};end`;
    androidCustomSchemeUrl = `vnd.youtube:${videoId}`;
  } else if (type === 'playlist' && playlistId) {
    cleanUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
    iosSchemeUrl = `youtube://www.youtube.com/playlist?list=${playlistId}`;
    androidIntentUrl = `intent://www.youtube.com/playlist?list=${playlistId}#Intent;package=com.google.android.youtube;scheme=https;S.browser_fallback_url=${encodeURIComponent(cleanUrl)};end`;
    androidCustomSchemeUrl = `vnd.youtube.com/playlist?list=${playlistId}`;
  } else if (type === 'channel' && channelPath) {
    cleanUrl = `https://www.youtube.com/${channelPath}`;
    iosSchemeUrl = `youtube://www.youtube.com/${channelPath}`;
    androidIntentUrl = `intent://www.youtube.com/${channelPath}#Intent;package=com.google.android.youtube;scheme=https;S.browser_fallback_url=${encodeURIComponent(cleanUrl)};end`;
    androidCustomSchemeUrl = `vnd.youtube.com/${channelPath}`;
  } else if (type === 'live' && videoId) {
    cleanUrl = `https://www.youtube.com/live/${videoId}`;
    iosSchemeUrl = `youtube://www.youtube.com/watch?v=${videoId}`;
    androidIntentUrl = `intent://www.youtube.com/watch?v=${videoId}#Intent;package=com.google.android.youtube;scheme=https;S.browser_fallback_url=${encodeURIComponent(cleanUrl)};end`;
    androidCustomSchemeUrl = `vnd.youtube:${videoId}`;
  } else if (videoId) {
    // Normal video
    cleanUrl = `https://www.youtube.com/watch?v=${videoId}${querySuffix}`;
    iosSchemeUrl = `youtube://www.youtube.com/watch?v=${videoId}${querySuffix.replace('?', '&')}`;
    androidIntentUrl = `intent://www.youtube.com/watch?v=${videoId}${querySuffix.replace('?', '&')}#Intent;package=com.google.android.youtube;scheme=https;S.browser_fallback_url=${encodeURIComponent(cleanUrl)};end`;
    androidCustomSchemeUrl = `vnd.youtube:${videoId}`;
  } else {
    // Fallback if parsing didn't isolate ID
    cleanUrl = url.href;
    iosSchemeUrl = url.href.replace(/^https?:\/\//i, 'youtube://');
    androidIntentUrl = `intent://${url.host}${url.pathname}${url.search}#Intent;package=com.google.android.youtube;scheme=https;S.browser_fallback_url=${encodeURIComponent(cleanUrl)};end`;
    androidCustomSchemeUrl = cleanUrl;
  }

  return {
    type,
    videoId,
    playlistId,
    channelPath,
    timestamp,
    params,
    cleanUrl,
    androidIntentUrl,
    androidCustomSchemeUrl,
    iosSchemeUrl,
    webFallbackUrl: cleanUrl,
  };
}

/**
 * Fetches real metadata from YouTube's public oEmbed API without requiring any API key.
 * If unavailable, falls back gracefully to generated defaults.
 */
export async function fetchYouTubeMetadata(url: string, parsed: ParsedYouTubeInfo): Promise<YouTubeMetadata> {
  const defaultThumbnail = parsed.videoId
    ? `https://i.ytimg.com/vi/${parsed.videoId}/maxresdefault.jpg`
    : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80';

  let title = 'YouTube Video';
  let authorName = 'YouTube Creator';
  let authorUrl = 'https://www.youtube.com';
  let thumbnailUrl = defaultThumbnail;

  if (parsed.type === 'shorts') {
    title = 'YouTube Shorts';
  } else if (parsed.type === 'playlist') {
    title = 'YouTube Playlist';
  } else if (parsed.type === 'channel') {
    title = parsed.channelPath ? `YouTube Channel (${parsed.channelPath})` : 'YouTube Channel';
  }

  try {
    const oembedEndpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.cleanUrl)}&format=json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(oembedEndpoint, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; YouTubePaster/1.0)',
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json() as any;
      if (data.title) title = data.title;
      if (data.author_name) authorName = data.author_name;
      if (data.author_url) authorUrl = data.author_url;
      if (data.thumbnail_url) {
        // Prefer maxres if video
        if (parsed.videoId) {
          thumbnailUrl = `https://i.ytimg.com/vi/${parsed.videoId}/maxresdefault.jpg`;
        } else {
          thumbnailUrl = data.thumbnail_url;
        }
      }
    }
  } catch (err) {
    // If oEmbed times out or fails (e.g. channel URL), fallback is already initialized
  }

  return {
    title,
    authorName,
    authorUrl,
    thumbnailUrl,
    type: parsed.type,
  };
}
