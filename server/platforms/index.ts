import { ParsedLinkInfo, Platform, PlatformMetadata } from '../types.js';
import { isYouTubeUrl, parseYouTubeUrl, fetchYouTubeMetadata } from './youtube.js';
import { isInstagramUrl, parseInstagramUrl, fetchInstagramMetadata } from './instagram.js';
import { isFacebookUrl, parseFacebookUrl, fetchFacebookMetadata } from './facebook.js';

/**
 * Detects which of the three supported platforms (YouTube, Instagram, Facebook) a URL belongs to.
 * Returns null for all other domains or malformed URLs.
 */
export function detectPlatform(input: string): Platform | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Reject unsafe protocols immediately
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return null;

  if (isYouTubeUrl(trimmed)) return 'youtube';
  if (isInstagramUrl(trimmed)) return 'instagram';
  if (isFacebookUrl(trimmed)) return 'facebook';

  return null;
}

export function isSupportedUrl(input: string): boolean {
  return detectPlatform(input) !== null;
}

export function parsePlatformUrl(input: string): ParsedLinkInfo {
  const platform = detectPlatform(input);
  if (platform === 'youtube') return parseYouTubeUrl(input);
  if (platform === 'instagram') return parseInstagramUrl(input);
  if (platform === 'facebook') return parseFacebookUrl(input);
  throw new Error('Unsupported URL. Only YouTube, Instagram, and Facebook links are supported.');
}

export async function fetchPlatformMetadata(parsed: ParsedLinkInfo): Promise<PlatformMetadata> {
  if (parsed.platform === 'youtube') return fetchYouTubeMetadata(parsed);
  if (parsed.platform === 'instagram') return fetchInstagramMetadata(parsed);
  if (parsed.platform === 'facebook') return fetchFacebookMetadata(parsed);
  throw new Error('Unsupported platform');
}

export {
  isYouTubeUrl,
  parseYouTubeUrl,
  fetchYouTubeMetadata,
  isInstagramUrl,
  parseInstagramUrl,
  fetchInstagramMetadata,
  isFacebookUrl,
  parseFacebookUrl,
  fetchFacebookMetadata,
};
