import { Router, Request, Response } from 'express';
import { safeFetchExternalUrl, validatePublicUrlForFetch } from '../services/fileSecurity.js';

export const utilitiesRouter = Router();

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

function extractMeta(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const p1 = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`,
    'i'
  );
  const m1 = html.match(p1);
  if (m1 && m1[1] !== undefined) return decodeHtmlEntities(m1[1].trim());

  const p2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`,
    'i'
  );
  const m2 = html.match(p2);
  if (m2 && m2[1] !== undefined) return decodeHtmlEntities(m2[1].trim());

  return null;
}

function extractTitleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m && m[1] ? decodeHtmlEntities(m[1].replace(/\s+/g, ' ').trim()) : null;
}

function extractCanonical(html: string): string | null {
  const m1 = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  if (m1 && m1[1]) return decodeHtmlEntities(m1[1].trim());
  const m2 = html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  return m2 && m2[1] ? decodeHtmlEntities(m2[1].trim()) : null;
}

function extractFavicon(html: string): string | null {
  const m1 = html.match(
    /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i
  );
  if (m1 && m1[1]) return decodeHtmlEntities(m1[1].trim());
  const m2 = html.match(
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i
  );
  return m2 && m2[1] ? decodeHtmlEntities(m2[1].trim()) : null;
}

async function sanitizeExtractedAssetUrl(
  rawAssetUrl: string | null,
  baseUrl: string
): Promise<{ safeUrl: string | null; rejectedReason?: string }> {
  if (!rawAssetUrl) return { safeUrl: null };
  try {
    const resolved = new URL(rawAssetUrl, baseUrl).toString();
    const validated = await validatePublicUrlForFetch(resolved);
    return { safeUrl: validated.toString() };
  } catch {
    return {
      safeUrl: null,
      rejectedReason: 'Linked media URL failed public safety validation and was omitted.',
    };
  }
}

// POST /api/utilities/qr - Validate & construct QR payload
utilitiesRouter.post('/qr', (req: Request, res: Response) => {
  const { type, data } = req.body || {};
  const qrType = String(type || '');
  let payload = '';

  try {
    if (qrType === 'url' || qrType === 'linktwin') {
      const raw = String(data?.url || '').trim();
      if (!raw) return res.status(400).json({ error: 'URL cannot be empty.' });
      const hasAnyScheme = /^[a-zA-Z][a-zA-Z0-9+-]*:(?:\/\/|[^\d])/i.test(raw);
      const withScheme = hasAnyScheme ? raw : `https://${raw}`;
      const u = new URL(withScheme);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        return res.status(400).json({ error: 'Only HTTP/HTTPS URLs are supported.' });
      }
      if (!u.hostname || (!u.hostname.includes('.') && u.hostname !== 'localhost')) {
        return res.status(400).json({ error: 'Please enter a valid domain URL.' });
      }
      payload = u.toString();
    } else if (qrType === 'text') {
      const txt = String(data?.text || '').trim();
      if (!txt) return res.status(400).json({ error: 'Text content cannot be empty.' });
      if (txt.length > 2000) return res.status(400).json({ error: 'Text exceeds 2000 character limit.' });
      payload = txt;
    } else if (qrType === 'email') {
      const to = String(data?.email || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }
      const params = new URLSearchParams();
      if (data?.subject) params.set('subject', String(data.subject).slice(0, 200));
      if (data?.body) params.set('body', String(data.body).slice(0, 1000));
      const qs = params.toString();
      payload = `mailto:${to}${qs ? `?${qs}` : ''}`;
    } else if (qrType === 'phone') {
      const phone = String(data?.phone || '').replace(/[^\d+]/g, '');
      if (phone.length < 5) {
        return res.status(400).json({ error: 'Please enter a valid phone number.' });
      }
      payload = `tel:${phone}`;
    } else if (qrType === 'wifi') {
      const ssid = String(data?.ssid || '').trim();
      if (!ssid) return res.status(400).json({ error: 'Wi-Fi network name (SSID) is required.' });
      const auth = ['WPA', 'WEP', 'nopass'].includes(data?.encryption) ? data.encryption : 'WPA';
      const pass = auth === 'nopass' ? '' : String(data?.password || '');
      const hidden = data?.hidden ? 'true' : 'false';
      const esc = (s: string) => s.replace(/([\\;,:"'])/g, '\\$1');
      payload = `WIFI:T:${auth};S:${esc(ssid)};P:${esc(pass)};H:${hidden};;`;
    } else if (qrType === 'whatsapp') {
      const digits = String(data?.phone || '').replace(/\D/g, '');
      if (digits.length < 6) {
        return res.status(400).json({ error: 'Please enter a valid WhatsApp phone number with country code.' });
      }
      const msg = String(data?.message || '').trim();
      payload = `https://wa.me/${digits}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
    } else {
      return res.status(400).json({ error: 'Unsupported QR code type.' });
    }

    return res.json({ success: true, type: qrType, payload });
  } catch {
    return res.status(400).json({ error: 'Invalid input format for QR code.' });
  }
});

// POST /api/utilities/preview - SSRF-hardened OpenGraph & Social Preview Metadata Inspector
utilitiesRouter.post('/preview', async (req: Request, res: Response) => {
  try {
    const rawUrl = String(req.body?.url || '').trim();
    if (!rawUrl) {
      return res.status(400).json({ error: 'Please provide a public HTTP or HTTPS URL.' });
    }

    let fetchResult;
    try {
      fetchResult = await safeFetchExternalUrl(rawUrl, {
        timeoutMs: 4500,
        maxBytes: 1024 * 1024, // 1 MB HTML limit
        maxRedirects: 3,
      });
    } catch (err: any) {
      // Never leak internal IP addresses or stack details
      const msg = String(err?.message || '');
      if (
        msg.includes('prohibited') ||
        msg.includes('restricted') ||
        msg.includes('Only HTTP and HTTPS') ||
        msg.includes('Malformed')
      ) {
        return res.status(400).json({ error: msg });
      }
      if (msg.includes('timed out')) {
        return res.status(504).json({ error: 'Target site did not respond within the timeout limit.' });
      }
      if (msg.includes('exceeds') || msg.includes('exceeded')) {
        return res.status(413).json({ error: 'Target page exceeded maximum allowed response size (1 MB).' });
      }
      return res.status(502).json({ error: 'Could not reach the specified public URL.' });
    }

    const contentType = (fetchResult.headers.get('content-type') || '').toLowerCase();
    if (
      contentType &&
      !contentType.includes('text/html') &&
      !contentType.includes('application/xhtml+xml')
    ) {
      return res.status(400).json({
        error: `Target URL returned unsupported content type (${contentType.split(';')[0]}). Only HTML pages can be inspected.`,
      });
    }

    const html = fetchResult.bodyText;
    const finalUrl = fetchResult.finalUrl;

    const ogTitle = extractMeta(html, 'og:title');
    const ogDescription = extractMeta(html, 'og:description');
    const ogImageRaw = extractMeta(html, 'og:image') || extractMeta(html, 'og:image:secure_url');
    const ogUrl = extractMeta(html, 'og:url');
    const ogSiteName = extractMeta(html, 'og:site_name');
    const ogType = extractMeta(html, 'og:type');

    const twitterCard = extractMeta(html, 'twitter:card');
    const twitterTitle = extractMeta(html, 'twitter:title');
    const twitterDescription = extractMeta(html, 'twitter:description');
    const twitterImageRaw = extractMeta(html, 'twitter:image') || extractMeta(html, 'twitter:image:src');

    const pageTitle = extractTitleTag(html);
    const pageDescription = extractMeta(html, 'description');
    const canonicalLink = extractCanonical(html);
    const faviconRaw = extractFavicon(html);

    // Re-validate extracted image & favicon URLs so private/malicious meta URLs are never returned
    const [ogImageCheck, twImageCheck, faviconCheck] = await Promise.all([
      sanitizeExtractedAssetUrl(ogImageRaw, finalUrl),
      sanitizeExtractedAssetUrl(twitterImageRaw, finalUrl),
      sanitizeExtractedAssetUrl(faviconRaw, finalUrl),
    ]);

    const resolvedTitle = ogTitle || twitterTitle || pageTitle || '';
    const resolvedDescription = ogDescription || twitterDescription || pageDescription || '';
    const resolvedImage = ogImageCheck.safeUrl || twImageCheck.safeUrl || null;
    const resolvedCanonical = ogUrl || canonicalLink || finalUrl;

    // Completeness audit & recommendations
    const issues: Array<{ severity: 'error' | 'warning' | 'ok'; message: string }> = [];

    if (!ogTitle) {
      issues.push({
        severity: 'error',
        message: 'Missing og:title — WhatsApp, Telegram, and Facebook rely on this for link headlines.',
      });
    } else if (ogTitle.length > 65) {
      issues.push({
        severity: 'warning',
        message: `og:title is ${ogTitle.length} characters; platforms often truncate titles above 60–65 characters.`,
      });
    } else {
      issues.push({ severity: 'ok', message: 'og:title is present and concise.' });
    }

    if (!ogDescription) {
      issues.push({
        severity: 'warning',
        message: 'Missing og:description — adding a 1–2 sentence summary improves click-through rates.',
      });
    } else if (ogDescription.length > 160) {
      issues.push({
        severity: 'warning',
        message: `og:description is ${ogDescription.length} characters; keep under 160 characters to prevent clipping.`,
      });
    } else {
      issues.push({ severity: 'ok', message: 'og:description is present and well-sized.' });
    }

    if (!ogImageRaw) {
      issues.push({
        severity: 'error',
        message: 'Missing og:image — shares will appear without a preview thumbnail card.',
      });
    } else if (ogImageCheck.rejectedReason) {
      issues.push({ severity: 'error', message: `og:image rejected: ${ogImageCheck.rejectedReason}` });
    } else if (ogImageCheck.safeUrl && ogImageCheck.safeUrl.startsWith('http://')) {
      issues.push({
        severity: 'warning',
        message: 'og:image uses unencrypted HTTP. Use HTTPS for reliable WhatsApp/Facebook rendering.',
      });
    } else {
      issues.push({ severity: 'ok', message: 'og:image is present over HTTPS.' });
    }

    if (!twitterCard) {
      issues.push({
        severity: 'warning',
        message: 'Missing twitter:card (recommended: "summary_large_image").',
      });
    }

    const totalChecks = 4;
    const passedChecks = [
      Boolean(ogTitle),
      Boolean(ogDescription),
      Boolean(ogImageCheck.safeUrl),
      Boolean(twitterCard),
    ].filter(Boolean).length;

    return res.json({
      success: true,
      finalUrl,
      status: fetchResult.status,
      metadata: {
        title: resolvedTitle,
        description: resolvedDescription,
        image: resolvedImage,
        canonicalUrl: resolvedCanonical,
        siteName: ogSiteName || new URL(finalUrl).hostname,
        favicon: faviconCheck.safeUrl,
        og: {
          title: ogTitle,
          description: ogDescription,
          image: ogImageCheck.safeUrl,
          url: ogUrl,
          siteName: ogSiteName,
          type: ogType,
        },
        twitter: {
          card: twitterCard,
          title: twitterTitle,
          description: twitterDescription,
          image: twImageCheck.safeUrl,
        },
        basic: {
          title: pageTitle,
          description: pageDescription,
          canonical: canonicalLink,
        },
      },
      audit: {
        score: Math.round((passedChecks / totalChecks) * 100),
        issues,
      },
      disclaimer:
        'Previews are representative estimates based on parsed public metadata. Actual rendering on WhatsApp, Telegram, Facebook, and X may differ due to platform caching and layout updates.',
    });
  } catch (err) {
    console.error('❌ [Social Preview Error]:', err);
    return res.status(500).json({ error: 'Unable to inspect social preview metadata.' });
  }
});
