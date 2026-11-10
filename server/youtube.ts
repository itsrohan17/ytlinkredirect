export { isYouTubeUrl, parseYouTubeUrl } from './platforms/youtube.js';
import { fetchYouTubeMetadata as fetchMeta } from './platforms/youtube.js';
import { ParsedLinkInfo } from './types.js';

export async function fetchYouTubeMetadata(_url: string, parsed: ParsedLinkInfo) {
  return fetchMeta(parsed);
}
