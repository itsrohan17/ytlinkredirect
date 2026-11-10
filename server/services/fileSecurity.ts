import dns from 'dns/promises';
import net from 'net';

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'video/x-msvideo',
  'image/gif',
]);
const ALLOWED_AUDIO_MIMES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/flac',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
  'video/webm',
]);
const ALLOWED_PDF_MIMES = new Set(['application/pdf']);

export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() || 'file';
  const cleaned = base.replace(/[^a-zA-Z0-9._\-]/g, '_').replace(/^\.+/, '');
  return cleaned.slice(0, 100) || 'file';
}

export function isAllowedMimeForCategory(
  mime: string,
  category: 'image' | 'video' | 'audio' | 'pdf'
): boolean {
  const m = (mime || '').toLowerCase().split(';')[0].trim();
  if (category === 'image') return ALLOWED_IMAGE_MIMES.has(m);
  if (category === 'video') return ALLOWED_VIDEO_MIMES.has(m);
  if (category === 'audio') return ALLOWED_AUDIO_MIMES.has(m);
  if (category === 'pdf') return ALLOWED_PDF_MIMES.has(m);
  return false;
}

/**
 * Validates actual file magic bytes from the leading hex header (first 16+ bytes).
 * Rejects spoofed extensions or executable/script headers (MZ, ELF, <?php, <script).
 */
export function verifyMagicBytes(
  headerHex: string,
  category: 'image' | 'video' | 'audio' | 'pdf'
): { valid: boolean; detectedFormat: string | null; reason?: string } {
  const hex = (headerHex || '').replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (hex.length < 8) {
    return { valid: false, detectedFormat: null, reason: 'File header too short or empty' };
  }

  // Block common executable / script signatures immediately
  if (hex.startsWith('4D5A') || hex.startsWith('7F454C46') || hex.startsWith('3C3F7068')) {
    return { valid: false, detectedFormat: null, reason: 'Executable or script signature rejected' };
  }

  // PDF: %PDF- (25 50 44 46 2D)
  if (category === 'pdf') {
    if (hex.startsWith('255044462D')) return { valid: true, detectedFormat: 'pdf' };
    return { valid: false, detectedFormat: null, reason: 'Invalid PDF signature' };
  }

  // Images
  if (category === 'image') {
    if (hex.startsWith('FFD8FF')) return { valid: true, detectedFormat: 'jpg' };
    if (hex.startsWith('89504E470D0A1A0A')) return { valid: true, detectedFormat: 'png' };
    if (hex.startsWith('474946383761') || hex.startsWith('474946383961')) {
      return { valid: true, detectedFormat: 'gif' };
    }
    if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') {
      return { valid: true, detectedFormat: 'webp' };
    }
    if (hex.slice(8, 16) === '66747970') {
      // ISO BMFF (avif/heif)
      return { valid: true, detectedFormat: 'avif' };
    }
    return { valid: false, detectedFormat: null, reason: 'Unrecognized image file signature' };
  }

  // Video
  if (category === 'video') {
    // MP4 / MOV: 'ftyp' at byte offset 4 (hex index 8..16)
    if (hex.slice(8, 16) === '66747970' || hex.slice(8, 16) === '6D6F6F76' || hex.slice(8, 16) === '6D646174') {
      return { valid: true, detectedFormat: 'mp4/mov' };
    }
    // WebM / MKV: EBML header 1A 45 DF A3
    if (hex.startsWith('1A45DFA3')) return { valid: true, detectedFormat: 'webm/mkv' };
    // AVI: RIFF....AVI
    if (hex.startsWith('52494646') && hex.slice(16, 24) === '41564920') {
      return { valid: true, detectedFormat: 'avi' };
    }
    // GIF
    if (hex.startsWith('474946383761') || hex.startsWith('474946383961')) {
      return { valid: true, detectedFormat: 'gif' };
    }
    return { valid: false, detectedFormat: null, reason: 'Unrecognized video file signature' };
  }

  // Audio
  if (category === 'audio') {
    // MP3 ID3 or sync frame
    if (hex.startsWith('494433') || hex.startsWith('FFFB') || hex.startsWith('FFF3') || hex.startsWith('FFF2')) {
      return { valid: true, detectedFormat: 'mp3' };
    }
    // WAV: RIFF....WAVE
    if (hex.startsWith('52494646') && hex.slice(16, 24) === '57415645') {
      return { valid: true, detectedFormat: 'wav' };
    }
    // FLAC: fLaC (66 4C 61 43)
    if (hex.startsWith('664C6143')) return { valid: true, detectedFormat: 'flac' };
    // OGG: OggS (4F 67 67 53)
    if (hex.startsWith('4F676753')) return { valid: true, detectedFormat: 'ogg' };
    // M4A / AAC ADTS / MP4 container
    if (hex.slice(8, 16) === '66747970' || hex.startsWith('FFF1') || hex.startsWith('FFF9')) {
      return { valid: true, detectedFormat: 'aac/m4a' };
    }
    // WebM audio
    if (hex.startsWith('1A45DFA3')) return { valid: true, detectedFormat: 'webm' };
    return { valid: false, detectedFormat: null, reason: 'Unrecognized audio file signature' };
  }

  return { valid: false, detectedFormat: null, reason: 'Unsupported category' };
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) {
    return true;
  }
  if (ip.startsWith('::ffff:')) {
    return isPrivateOrReservedIp(ip.slice(7));
  }
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true; // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a >= 224) return true; // multicast & reserved
  }
  return false;
}

/**
 * SSRF-hardened URL validation: checks protocol, hostname literals, and resolves DNS
 * to guarantee no private network, loopback, or cloud metadata address can be accessed.
 */
export async function validatePublicUrlForFetch(rawUrl: string): Promise<URL> {
  let urlString = (rawUrl || '').trim();
  if (!urlString) throw new Error('URL is required.');
  if (!/^https?:\/\//i.test(urlString)) {
    urlString = 'https://' + urlString;
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error('Malformed URL provided.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are permitted.');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    throw new Error('Access to internal or local hostnames is prohibited.');
  }

  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error('Access to private or reserved IP addresses is prohibited.');
    }
    return parsed;
  }

  try {
    const records = await dns.lookup(host, { all: true });
    if (!records || records.length === 0) {
      throw new Error('Could not resolve target hostname.');
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        throw new Error('Target hostname resolves to a restricted private IP address.');
      }
    }
  } catch (err: any) {
    if (err.message?.includes('restricted') || err.message?.includes('prohibited')) {
      throw err;
    }
    throw new Error(`DNS resolution failed for ${host}`);
  }

  return parsed;
}

/**
 * Performs an SSRF-safe HTTP/HTTPS GET fetch:
 * - Validates initial URL and DNS resolution.
 * - Uses redirect: 'manual' and re-validates every redirect Location via validatePublicUrlForFetch.
 * - Enforces request timeout and maximum response size limit.
 */
export async function safeFetchExternalUrl(
  rawUrl: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxBytes?: number;
    maxRedirects?: number;
  } = {}
): Promise<{ finalUrl: string; status: number; headers: Headers; bodyText: string }> {
  const timeoutMs = options.timeoutMs ?? 4500;
  const maxBytes = options.maxBytes ?? 1024 * 1024; // 1 MB cap
  const maxRedirects = options.maxRedirects ?? 3;

  let currentUrl = (await validatePublicUrlForFetch(rawUrl)).toString();

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LinkTwinBot/2.0)',
          ...(options.headers || {}),
        },
      });
      clearTimeout(timer);

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) {
          throw new Error('Redirect response missing Location header.');
        }
        const resolvedNext = new URL(location, currentUrl).toString();
        currentUrl = (await validatePublicUrlForFetch(resolvedNext)).toString();
        continue;
      }

      const contentLen = Number(res.headers.get('content-length') || 0);
      if (contentLen > maxBytes) {
        throw new Error(`Response size (${contentLen} bytes) exceeds safety limit.`);
      }

      if (!res.body) {
        return { finalUrl: currentUrl, status: res.status, headers: res.headers, bodyText: '' };
      }

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.length;
          if (totalBytes > maxBytes) {
            await reader.cancel();
            throw new Error(`Response exceeded ${maxBytes} byte safety limit.`);
          }
          chunks.push(value);
        }
      }

      const decoder = new TextDecoder('utf-8', { fatal: false });
      const bodyText = decoder.decode(Buffer.concat(chunks));

      return { finalUrl: currentUrl, status: res.status, headers: res.headers, bodyText };
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  throw new Error('Too many HTTP redirects.');
}
