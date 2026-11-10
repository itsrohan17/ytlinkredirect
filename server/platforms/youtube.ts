import { ContentType, ParsedLinkInfo, PlatformMetadata } from '../types.js';

const ALLOWED_YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'gaming.youtube.com',
  'youtu.be',
]);

export function isYouTubeUrl(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  try {
    let urlString = input.trim();
    if (!/^https?:\/\//i.test(urlString)) {
      urlString = 'https://' + urlString;
    }
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_YOUTUBE_HOSTS.has(host) || host.endsWith('.youtube.com');
  } catch {
    return false;
  }
}

export function parseYouTubeUrl(input: string): ParsedLinkInfo {
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

  let type: ContentType = 'video';
  let videoId: string | undefined;
  let playlistId: string | undefined;
  let channelPath: string | undefined;
  const timestamp: string | undefined = params['t'] || params['start'] || params['time_continue'];

  if (host === 'youtu.be') {
    videoId = pathname.slice(1).split('/')[0].split('?')[0];
    playlistId = searchParams.get('list') || undefined;
    type = 'video';
  } else if (pathname.startsWith('/shorts/')) {
    videoId = pathname.replace('/shorts/', '').split('/')[0].split('?')[0];
    type = 'shorts';
  } else if (pathname.startsWith('/live/')) {
    videoId = pathname.replace('/live/', '').split('/')[0].split('?')[0];
    type = 'live';
  } else if (pathname.startsWith('/embed/')) {
    videoId = pathname.replace('/embed/', '').split('/')[0].split('?')[0];
    type = 'video';
  } else if (pathname.startsWith('/playlist')) {
    playlistId = searchParams.get('list') || undefined;
    type = 'playlist';
  } else if (
    pathname.startsWith('/@') ||
    pathname.startsWith('/channel/') ||
    pathname.startsWith('/c/') ||
    pathname.startsWith('/user/')
  ) {
    type = 'channel';
    channelPath = pathname.replace(/^\/+/, '');
  } else if (pathname.startsWith('/watch')) {
    videoId = searchParams.get('v') || undefined;
    playlistId = searchParams.get('list') || undefined;
    type = 'video';
  } else if (/^\/[a-zA-Z0-9_\-\.]+$/.test(pathname) && pathname !== '/') {
    type = 'channel';
    channelPath = pathname.replace(/^\/+/, '');
  }

  const queryParts: string[] = [];
  if (timestamp) queryParts.push(`t=${encodeURIComponent(timestamp)}`);
  if (playlistId && type !== 'playlist') queryParts.push(`list=${encodeURIComponent(playlistId)}`);
  if (params['index']) queryParts.push(`index=${encodeURIComponent(params['index'])}`);
  const querySuffix = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

  let cleanUrl = '';
  let iosDeepLinkUrl = '';
  let androidIntentUrl = '';
  let androidCustomSchemeUrl = '';
  let contentId = videoId || playlistId || channelPath;

  if (type === 'shorts' && videoId) {
    cleanUrl = `https://www.youtube.com/shorts/${videoId}`;
    iosDeepLinkUrl = `youtube://www.youtube.com/shorts/${videoId}`;
    androidIntentUrl = `intent://www.youtube.com/shorts/${videoId}#Intent;package=com.google.android.youtube;scheme=https;S.browser_fallback_url=${encodeURIComponent(cleanUrl)};end`;
    androidCustomSchemeUrl = `vnd.youtube:${videoId}`;
  } else if (type === 'playlist' && playlistId) {
    cleanUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
    iosDeepLinkUrl = `youtube://www.youtube.com/playlist?list=${playlistId}`;
    androidIntentUrl = `intent://www.youtube.com/playlist?list=${playlistId}#Intent;package=com.google.android.youtube;scheme=https;S.browser_fallback_url=${encodeURIComponent(cleanUrl)};end`;
    androidCustomSchemeUrl = `vnd.youtube.com/playlist?list=${playlistId}`;
  } else if (type === 'channel' && channelPath) {
    cleanUrl = `https://www.youtube.com/${channelPath}`;
    iosDeepLinkUrl = `youtube://www.youtube.com/${channelPath}`;
    androidIntentUrl = `intent://www.youtube.com/${channelPath}#Intent;package=com.google.android.youtube;scheme=https;S.browser_fallback_url=${encodeURIComponent(cleanUrl)};end`;
    androidCustomSchemeUrl = `vnd.youtube.com/${channelPath}`;
  } else if (type === 'live' && videoId) {
    cleanUrl = `https://www.youtube.com/live/${videoId}`;
    iosDeepLinkUrl = `youtube://www.youtube.com/watch?v=${videoId}`;
    androidIntentUrl = `intent://www.youtube.com/watch?v=${videoId}#Intent;package=com.google.android.youtube;scheme=https;S.browser_fallback_url=${encodeURIComponent(cleanUrl)};end`;
    androidCustomSchemeUrl = `vnd.youtube:${videoId}`;
  } else if (videoId) {
    cleanUrl = `https://www.youtube.com/watch?v=${videoId}${querySuffix}`;
    iosDeepLinkUrl = `youtube://www.youtube.com/watch?v=${videoId}${querySuffix.replace('?', '&')}`;
    androidIntentUrl = `intent://www.youtube.com/watch?v=${videoId}${querySuffix.replace('?', '&')}#Intent;package=com.google.android.youtube;scheme=https;S.browser_fallback_url=${encodeURIComponent(cleanUrl)};end`;
    androidCustomSchemeUrl = `vnd.youtube:${videoId}`;
  } else {
    cleanUrl = url.href;
    contentId = pathname.replace(/^\/+/, '') || 'home';
    iosDeepLinkUrl = url.href.replace(/^https?:\/\//i, 'youtube://');
    androidIntentUrl = `intent://${url.host}${url.pathname}${url.search}#Intent;package=com.google.android.youtube;scheme=https;S.browser_fallback_url=${encodeURIComponent(cleanUrl)};end`;
    androidCustomSchemeUrl = cleanUrl;
  }

  return {
    platform: 'youtube',
    type,
    contentId,
    videoId,
    playlistId,
    channelPath,
    timestamp,
    params,
    cleanUrl,
    androidIntentUrl,
    androidCustomSchemeUrl,
    iosDeepLinkUrl,
    iosPreferUniversalLink: false,
    webFallbackUrl: cleanUrl,
  };
}

export async function fetchYouTubeMetadata(parsed: ParsedLinkInfo): Promise<PlatformMetadata> {
  const defaultThumbnail = parsed.videoId
    ? `https://i.ytimg.com/vi/${parsed.videoId}/maxresdefault.jpg`
    : 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=1200&auto=format&fit=crop&q=80';

  let title = 'YouTube Video';
  let authorName = 'YouTube Creator';
  let authorUrl = 'https://www.youtube.com';
  let thumbnailUrl = defaultThumbnail;

  if (parsed.type === 'shorts') title = 'YouTube Shorts';
  else if (parsed.type === 'playlist') title = 'YouTube Playlist';
  else if (parsed.type === 'channel') {
    title = parsed.channelPath ? `YouTube Channel (${parsed.channelPath})` : 'YouTube Channel';
  } else if (parsed.type === 'live') title = 'YouTube Live Stream';

  try {
    const oembedEndpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.cleanUrl)}&format=json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(oembedEndpoint, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkTwin/2.0)' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as any;
      if (data.title) title = data.title;
      if (data.author_name) authorName = data.author_name;
      if (data.author_url) authorUrl = data.author_url;
      if (data.thumbnail_url) {
        thumbnailUrl = parsed.videoId
          ? `https://i.ytimg.com/vi/${parsed.videoId}/maxresdefault.jpg`
          : data.thumbnail_url;
      }
    }
  } catch {
    // Graceful fallback
  }

  return {
    platform: 'youtube',
    title,
    authorName,
    authorUrl,
    thumbnailUrl,
    type: parsed.type,
  };
}
