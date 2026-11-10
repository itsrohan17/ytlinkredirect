import { ContentType, ParsedLinkInfo, PlatformMetadata } from '../types.js';

const ALLOWED_FACEBOOK_HOSTS = new Set([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'mbasic.facebook.com',
  'web.facebook.com',
  'fb.watch',
  'fb.com',
  'www.fb.com',
]);

const FACEBOOK_RESERVED_ROUTES = new Set([
  'watch',
  'reel',
  'reels',
  'share',
  'groups',
  'events',
  'marketplace',
  'gaming',
  'login',
  'policies',
  'help',
  'settings',
  'privacy',
  'profile.php',
  'permalink.php',
  'photo',
  'photo.php',
  'video.php',
  'story.php',
  'pages',
  'hashtag',
  'live',
  'stories',
  'saved',
  'friends',
  'bookmarks',
  'notifications',
  'messages',
]);

export function isFacebookUrl(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  try {
    let urlString = input.trim();
    if (!/^https?:\/\//i.test(urlString)) {
      urlString = 'https://' + urlString;
    }
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_FACEBOOK_HOSTS.has(host);
  } catch {
    return false;
  }
}

export function parseFacebookUrl(input: string): ParsedLinkInfo {
  let urlString = input.trim();
  if (!/^https?:\/\//i.test(urlString)) {
    urlString = 'https://' + urlString;
  }

  const url = new URL(urlString);
  const host = url.hostname.toLowerCase();
  const pathname = url.pathname;
  const segments = pathname.split('/').filter(Boolean);

  const params: Record<string, string> = {};
  url.searchParams.forEach((val, key) => {
    params[key] = val;
  });

  // Preserve essential query parameters
  const keptQuery = new URLSearchParams();
  for (const key of ['v', 'id', 'story_fbid', 'fbid', 'set', 't']) {
    if (params[key]) keptQuery.set(key, params[key]);
  }
  const queryString = keptQuery.toString();
  const querySuffix = queryString ? `?${queryString}` : '';

  let type: ContentType = 'post';
  let contentId: string | undefined;
  let videoId: string | undefined;
  let channelPath: string | undefined;

  if (host === 'fb.watch') {
    type = 'video';
    contentId = segments[0] || 'watch';
    videoId = contentId;
  } else if (segments[0] === 'reel' || segments[0] === 'reels') {
    type = 'reel';
    contentId = segments[1];
    videoId = contentId;
  } else if (segments[0] === 'share' && segments[1] === 'r' && segments[2]) {
    type = 'reel';
    contentId = segments[2];
  } else if (segments[0] === 'share' && segments[1] === 'v' && segments[2]) {
    type = 'video';
    contentId = segments[2];
  } else if (segments[0] === 'share' && segments[1] === 'p' && segments[2]) {
    type = 'post';
    contentId = segments[2];
  } else if (
    segments[0] === 'watch' ||
    segments[0] === 'video.php' ||
    segments.includes('videos')
  ) {
    type = 'video';
    const vidIdx = segments.indexOf('videos');
    videoId = params['v'] || (vidIdx !== -1 ? segments[vidIdx + 1] : undefined);
    contentId = videoId || segments.join('/');
  } else if (
    segments[0] === 'permalink.php' ||
    segments[0] === 'story.php' ||
    segments[0] === 'photo' ||
    segments[0] === 'photo.php' ||
    segments.includes('posts')
  ) {
    type = 'post';
    const postIdx = segments.indexOf('posts');
    contentId =
      params['story_fbid'] ||
      params['fbid'] ||
      (postIdx !== -1 ? segments[postIdx + 1] : undefined) ||
      segments.join('/');
  } else if (segments[0] === 'profile.php') {
    type = 'profile';
    contentId = params['id'] || 'profile';
    channelPath = `profile.php?id=${encodeURIComponent(contentId)}`;
  } else if (segments[0] === 'groups' && segments[1] && !segments.includes('posts')) {
    type = 'profile';
    contentId = segments[1];
    channelPath = `groups/${segments[1]}`;
  } else if (segments[0] === 'pages' && segments[1]) {
    type = 'profile';
    contentId = segments[2] || segments[1];
    channelPath = segments.join('/');
  } else if (segments.length === 1 && !FACEBOOK_RESERVED_ROUTES.has(segments[0].toLowerCase())) {
    type = 'profile';
    contentId = segments[0];
    channelPath = segments[0];
  } else if (segments.length >= 2 && segments[1] === 'posts') {
    type = 'post';
    contentId = segments[2] || segments[0];
  } else {
    // Reserved route or nested path fallback
    type = 'post';
    contentId = segments.join('/') || 'facebook';
  }

  // Normalize host to www.facebook.com (except fb.watch)
  const canonicalHost = host === 'fb.watch' ? 'fb.watch' : 'www.facebook.com';
  const cleanPath = pathname === '/' ? '/' : pathname;
  const cleanUrl = `https://${canonicalHost}${cleanPath}${querySuffix}`;

  // Android Intent targeting com.facebook.katana with safe browser fallback
  const androidIntentUrl = `intent://${canonicalHost}${cleanPath}${querySuffix}#Intent;package=com.facebook.katana;scheme=https;S.browser_fallback_url=${encodeURIComponent(cleanUrl)};end`;

  // iOS: fb://facewebmodal/f?href=... opens Facebook links inside the native iOS Facebook app;
  // Universal Links also work on iOS 9+, so we provide the scheme with fast web fallback.
  const iosDeepLinkUrl = `fb://facewebmodal/f?href=${encodeURIComponent(cleanUrl)}`;

  return {
    platform: 'facebook',
    type,
    contentId,
    videoId,
    channelPath,
    params,
    cleanUrl,
    androidIntentUrl,
    androidCustomSchemeUrl: `fb://facewebmodal/f?href=${encodeURIComponent(cleanUrl)}`,
    iosDeepLinkUrl,
    iosPreferUniversalLink: false,
    webFallbackUrl: cleanUrl,
  };
}

export async function fetchFacebookMetadata(parsed: ParsedLinkInfo): Promise<PlatformMetadata> {
  let title = 'Facebook Content';
  let authorName = 'Facebook';
  let thumbnailUrl =
    'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=1200&auto=format&fit=crop&q=80';

  if (parsed.type === 'reel') title = 'Facebook Reel';
  else if (parsed.type === 'video') title = 'Facebook Video';
  else if (parsed.type === 'post') title = 'Facebook Post';
  else if (parsed.type === 'profile') {
    authorName = parsed.contentId ? `${parsed.contentId}` : 'Facebook Page';
    title = `${authorName} on Facebook`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(parsed.cleanUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const html = await res.text();
      const ogTitle = extractMeta(html, 'og:title');
      const ogImage = extractMeta(html, 'og:image');

      if (ogTitle && !ogTitle.toLowerCase().includes('log in')) {
        title = decodeHtmlEntities(ogTitle);
      }
      if (ogImage && ogImage.startsWith('http')) {
        thumbnailUrl = decodeHtmlEntities(ogImage);
      }
    }
  } catch {
    // Graceful fallback
  }

  return {
    platform: 'facebook',
    title,
    authorName,
    authorUrl: parsed.type === 'profile' ? parsed.cleanUrl : 'https://www.facebook.com',
    thumbnailUrl,
    type: parsed.type,
  };
}

function extractMeta(html: string, property: string): string | null {
  const regex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  const match = html.match(regex);
  if (match && match[1]) return match[1];

  const revRegex = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    'i'
  );
  const revMatch = html.match(revRegex);
  return revMatch && revMatch[1] ? revMatch[1] : null;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'");
}
