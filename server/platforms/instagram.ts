import { ContentType, ParsedLinkInfo, PlatformMetadata } from '../types.js';

const ALLOWED_INSTAGRAM_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
  'instagr.am',
]);

const INSTAGRAM_RESERVED_PATHS = new Set([
  'explore',
  'direct',
  'accounts',
  'stories',
  'about',
  'legal',
  'developer',
  'directory',
  'privacy',
  'terms',
  'api',
  'static',
  'reel',
  'reels',
  'p',
  'tv',
  'challenge',
  'oauth',
  'nametag',
]);

export function isInstagramUrl(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  try {
    let urlString = input.trim();
    if (!/^https?:\/\//i.test(urlString)) {
      urlString = 'https://' + urlString;
    }
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_INSTAGRAM_HOSTS.has(host);
  } catch {
    return false;
  }
}

export function parseInstagramUrl(input: string): ParsedLinkInfo {
  let urlString = input.trim();
  if (!/^https?:\/\//i.test(urlString)) {
    urlString = 'https://' + urlString;
  }

  const url = new URL(urlString);
  const segments = url.pathname.split('/').filter(Boolean);

  const params: Record<string, string> = {};
  url.searchParams.forEach((val, key) => {
    params[key] = val;
  });

  // Preserve important parameters like img_index
  const preservedParams: string[] = [];
  if (params['img_index']) {
    preservedParams.push(`img_index=${encodeURIComponent(params['img_index'])}`);
  }
  const querySuffix = preservedParams.length > 0 ? `?${preservedParams.join('&')}` : '';

  let type: ContentType = 'profile';
  let contentId: string | undefined;
  let canonicalPath = '';

  // Handle /{username}/reel/{shortcode} or /reel/{shortcode} or /reels/{shortcode}
  const reelIdx = segments.findIndex((s) => s === 'reel' || s === 'reels');
  const postIdx = segments.findIndex((s) => s === 'p' || s === 'tv');

  if (reelIdx !== -1 && segments[reelIdx + 1]) {
    type = 'reel';
    contentId = segments[reelIdx + 1];
    canonicalPath = `reel/${contentId}/`;
  } else if (postIdx !== -1 && segments[postIdx + 1]) {
    type = 'post';
    contentId = segments[postIdx + 1];
    canonicalPath = `p/${contentId}/`;
  } else if (segments[0] === 'stories' && segments[1]) {
    type = 'reel';
    contentId = segments[2] ? `${segments[1]}/${segments[2]}` : segments[1];
    canonicalPath = segments.join('/') + '/';
  } else if (segments.length >= 1 && !INSTAGRAM_RESERVED_PATHS.has(segments[0].toLowerCase())) {
    type = 'profile';
    contentId = segments[0].replace(/^@/, '');
    canonicalPath = `${contentId}/`;
  } else {
    // Reserved or ambiguous path (e.g. /explore)
    type = 'post';
    contentId = segments.join('/') || 'instagram';
    canonicalPath = segments.length > 0 ? `${segments.join('/')}/` : '';
  }

  const cleanUrl = `https://www.instagram.com/${canonicalPath}${querySuffix}`;

  // Android Intent with safe browser fallback
  const androidIntentUrl = `intent://www.instagram.com/${canonicalPath}${querySuffix}#Intent;package=com.instagram.android;scheme=https;S.browser_fallback_url=${encodeURIComponent(cleanUrl)};end`;

  // iOS: Universal Links are preferred and more reliable for Reels & Posts because custom scheme
  // instagram://media?id= requires numeric media ID rather than shortcode.
  // For profiles, instagram://user?username= works well alongside Universal Links.
  let iosDeepLinkUrl = cleanUrl;
  let iosPreferUniversalLink = true;
  let androidCustomSchemeUrl: string | undefined;

  if (type === 'profile' && contentId && !contentId.includes('/')) {
    iosDeepLinkUrl = `instagram://user?username=${encodeURIComponent(contentId)}`;
    iosPreferUniversalLink = false;
    androidCustomSchemeUrl = `instagram://user?username=${encodeURIComponent(contentId)}`;
  }

  return {
    platform: 'instagram',
    type,
    contentId,
    channelPath: type === 'profile' ? contentId : undefined,
    params,
    cleanUrl,
    androidIntentUrl,
    androidCustomSchemeUrl,
    iosDeepLinkUrl,
    iosPreferUniversalLink,
    webFallbackUrl: cleanUrl,
  };
}

export async function fetchInstagramMetadata(parsed: ParsedLinkInfo): Promise<PlatformMetadata> {
  let title = 'Instagram Content';
  let authorName = 'Instagram';
  // Clean dark-mode friendly Instagram-themed placeholder image fallback
  let thumbnailUrl =
    'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=1200&auto=format&fit=crop&q=80';

  if (parsed.type === 'reel') {
    title = `Instagram Reel${parsed.contentId ? ` (${parsed.contentId})` : ''}`;
  } else if (parsed.type === 'post') {
    title = `Instagram Post${parsed.contentId ? ` (${parsed.contentId})` : ''}`;
  } else if (parsed.type === 'profile') {
    authorName = parsed.contentId ? `@${parsed.contentId}` : 'Instagram Profile';
    title = `${authorName} on Instagram`;
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

      if (ogTitle && !ogTitle.toLowerCase().includes('login')) {
        title = decodeHtmlEntities(ogTitle);
      }
      if (ogImage && ogImage.startsWith('http')) {
        thumbnailUrl = decodeHtmlEntities(ogImage);
      }
    }
  } catch {
    // Graceful fallback without failing link generation
  }

  return {
    platform: 'instagram',
    title,
    authorName,
    authorUrl: parsed.type === 'profile' ? parsed.cleanUrl : 'https://www.instagram.com',
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
