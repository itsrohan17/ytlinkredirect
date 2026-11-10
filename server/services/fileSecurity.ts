import dns from 'dns/promises';
import http from 'http';
import https from 'https';
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
  const lower = ip.toLowerCase().trim();

  // Strip IPv6 zone index if present
  const cleanIp = lower.split('%')[0];

  if (cleanIp === '::1' || cleanIp === '::' || cleanIp === '0:0:0:0:0:0:0:1' || cleanIp === '0:0:0:0:0:0:0:0') {
    return true;
  }

  // IPv6 ULA (fc00::/7), link-local (fe80::/10), multicast (ff00::/8)
  if (
    cleanIp.startsWith('fc') ||
    cleanIp.startsWith('fd') ||
    cleanIp.startsWith('fe8') ||
    cleanIp.startsWith('fe9') ||
    cleanIp.startsWith('fea') ||
    cleanIp.startsWith('feb') ||
    cleanIp.startsWith('ff')
  ) {
    return true;
  }

  // IPv4-mapped IPv6 dotted form ::ffff:127.0.0.1
  if (cleanIp.startsWith('::ffff:')) {
    const mapped = cleanIp.slice(7);
    if (net.isIPv4(mapped)) {
      return isPrivateOrReservedIp(mapped);
    }
    // Hex form e.g. ::ffff:7f00:1
    const hexMatch = mapped.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMatch) {
      const hi = parseInt(hexMatch[1], 16);
      const lo = parseInt(hexMatch[2], 16);
      const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      return isPrivateOrReservedIp(ipv4);
    }
    return true;
  }

  if (net.isIPv4(cleanIp)) {
    const parts = cleanIp.split('.').map(Number);
    if (parts.length !== 4) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true; // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmark
    if (a >= 224) return true; // multicast & reserved
  }
  return false;
}

export async function resolveAndValidatePublicUrl(
  rawUrl: string
): Promise<{ url: URL; resolvedIp: string; family: 4 | 6 }> {
  let urlString = (rawUrl || '').trim();
  if (!urlString) throw new Error('URL is required.');
  const hasExplicitScheme = /^[a-zA-Z][a-zA-Z0-9+-]*:(?:\/\/|[^\d])/i.test(urlString);
  if (!hasExplicitScheme) {
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

  // Strip IPv6 brackets if literal
  const rawHost = parsed.hostname.toLowerCase();
  const host = rawHost.startsWith('[') && rawHost.endsWith(']') ? rawHost.slice(1, -1) : rawHost;

  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    throw new Error('Access to internal or local hostnames is prohibited.');
  }

  const literalFamily = net.isIP(host);
  if (literalFamily) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error('Access to private or reserved IP addresses is prohibited.');
    }
    return { url: parsed, resolvedIp: host, family: literalFamily as 4 | 6 };
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
    return {
      url: parsed,
      resolvedIp: records[0].address,
      family: (records[0].family === 6 ? 6 : 4) as 4 | 6,
    };
  } catch (err: any) {
    if (err.message?.includes('restricted') || err.message?.includes('prohibited')) {
      throw err;
    }
    throw new Error(`DNS resolution failed for ${host}`);
  }
}

/**
 * SSRF-hardened URL validation: checks protocol, hostname literals, and resolves DNS
 * to guarantee no private network, loopback, or cloud metadata address can be accessed.
 */
export async function validatePublicUrlForFetch(rawUrl: string): Promise<URL> {
  const { url } = await resolveAndValidatePublicUrl(rawUrl);
  return url;
}

function pinnedRequest(
  target: { url: URL; resolvedIp: string; family: 4 | 6 },
  headers: Record<string, string>,
  timeoutMs: number,
  maxBytes: number,
  method: 'GET' | 'HEAD' = 'GET'
): Promise<{ status: number; headers: http.IncomingHttpHeaders; bodyBuffer: Buffer }> {
  return new Promise((resolve, reject) => {
    const isHttps = target.url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const defaultPort = isHttps ? 443 : 80;
    const port = target.url.port ? Number(target.url.port) : defaultPort;
    const pathAndQuery = `${target.url.pathname}${target.url.search}`;

    const reqOptions: https.RequestOptions = {
      host: target.resolvedIp,
      port,
      family: target.family,
      method,
      path: pathAndQuery,
      headers: {
        Host: target.url.host,
        'User-Agent': 'Mozilla/5.0 (compatible; LinkTwinBot/2.0)',
        Accept: 'text/html,application/xhtml+xml,image/*,*/*;q=0.8',
        ...headers,
      },
      ...(isHttps ? { servername: target.url.hostname } : {}),
    };

    const req = lib.request(reqOptions, (res) => {
      const status = res.statusCode || 500;
      const contentLen = Number(res.headers['content-length'] || 0);
      if (contentLen > maxBytes) {
        req.destroy();
        reject(new Error(`Response size (${contentLen} bytes) exceeds safety limit.`));
        return;
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;

      res.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
          req.destroy();
          reject(new Error(`Response exceeded ${maxBytes} byte safety limit.`));
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        resolve({ status, headers: res.headers, bodyBuffer: Buffer.concat(chunks) });
      });

      res.on('error', (err) => reject(err));
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

/**
 * Performs an SSRF-safe HTTP/HTTPS GET fetch pinned directly to the validated resolved IP
 * (preventing DNS rebinding TOCTOU attacks), re-validating every 3xx redirect hop.
 */
export async function safeFetchExternalUrl(
  rawUrl: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxBytes?: number;
    maxRedirects?: number;
    method?: 'GET' | 'HEAD';
  } = {}
): Promise<{ finalUrl: string; status: number; headers: Headers; bodyText: string; bodyBuffer: Buffer }> {
  const timeoutMs = options.timeoutMs ?? 4500;
  const maxBytes = options.maxBytes ?? 1024 * 1024;
  const maxRedirects = options.maxRedirects ?? 3;
  const method = options.method ?? 'GET';

  let resolvedTarget = await resolveAndValidatePublicUrl(rawUrl);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await pinnedRequest(resolvedTarget, options.headers || {}, timeoutMs, maxBytes, method);

    if (res.status >= 300 && res.status < 400) {
      const rawLoc = res.headers['location'];
      const location = Array.isArray(rawLoc) ? rawLoc[0] : rawLoc;
      if (!location) {
        throw new Error('Redirect response missing Location header.');
      }
      const nextUrl = new URL(location, resolvedTarget.url.toString()).toString();
      resolvedTarget = await resolveAndValidatePublicUrl(nextUrl);
      continue;
    }

    const webHeaders = new Headers();
    for (const [k, v] of Object.entries(res.headers)) {
      if (typeof v === 'string') webHeaders.set(k, v);
      else if (Array.isArray(v)) webHeaders.set(k, v.join(', '));
    }

    return {
      finalUrl: resolvedTarget.url.toString(),
      status: res.status,
      headers: webHeaders,
      bodyText: res.bodyBuffer.toString('utf8'),
      bodyBuffer: res.bodyBuffer,
    };
  }

  throw new Error('Too many HTTP redirects.');
}
