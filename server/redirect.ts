import { Request, Response } from 'express';
import { UAParser } from 'ua-parser-js';
import { getLinkByCode, recordClick } from './db.js';
import { parsePlatformUrl } from './platforms/index.js';
import { LinkRecord, ParsedLinkInfo, Platform } from './types.js';
import crypto from 'crypto';

// Common social crawler bot user agents
const BOT_REGEX =
  /bot|crawl|spider|whatsapp|telegrambot|facebookexternalhit|facebot|twitterbot|discordbot|slackbot|linkedinbot|applebot|pinterest|skypeuripreview|googlebot|bingbot|yandex/i;

// In-app browsers: Instagram, Facebook, Snapchat, Line, WeChat, Twitter, LinkedIn, Discord
const IN_APP_REGEX =
  /instagram|fban|fbav|snapchat|line\/|micromessenger|twitter|linkedinapp|discord/i;

function hashIp(ip: string | undefined): string {
  if (!ip) return '';
  return crypto.createHash('sha256').update(ip + 'salt_linktwin_v2').digest('hex').slice(0, 12);
}

function getCountryFromHeaders(req: Request): string {
  const vercelCountry = req.headers['x-vercel-ip-country'];
  const cfCountry = req.headers['cf-ipcountry'];
  const raw = Array.isArray(vercelCountry)
    ? vercelCountry[0]
    : vercelCountry || (Array.isArray(cfCountry) ? cfCountry[0] : cfCountry);
  if (raw && typeof raw === 'string' && raw !== 'XX') {
    return raw.toUpperCase();
  }
  return 'Unknown';
}

export async function handleSmartRedirect(req: Request, res: Response) {
  const code = String(req.params.code || '');
  const link = await getLinkByCode(code);

  if (!link) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Link Not Found - LinkTwin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { background:#09090b; color:#f4f4f5; font-family:system-ui, -apple-system, sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
          .card { text-align:center; padding:2rem; max-width:400px; background:#18181b; border:1px solid #27272a; border-radius:12px; }
          h1 { color:#ef4444; margin-top:0; }
          a { display:inline-block; margin-top:1rem; padding:0.6rem 1.2rem; background:#ef4444; color:#fff; text-decoration:none; border-radius:6px; font-weight:600; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>404 - Link Not Found</h1>
          <p>The smart link <code>${escapeHtml(code)}</code> does not exist or has expired.</p>
          <a href="/">Create New Smart Link</a>
        </div>
      </body>
      </html>
    `);
  }

  const rawUa = req.headers['user-agent'];
  const userAgent = Array.isArray(rawUa) ? rawUa[0] || '' : rawUa || '';
  const parser = new UAParser(userAgent);
  const uaResult = parser.getResult();
  const osName = uaResult.os.name || 'Unknown';
  const browserName = uaResult.browser.name || 'Unknown';
  const deviceTypeRaw = uaResult.device.type;

  const isAndroid = /Android/i.test(userAgent) || /Android/i.test(osName);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent) || /iOS/i.test(osName);
  const isBot = BOT_REGEX.test(userAgent);
  const isInApp = IN_APP_REGEX.test(userAgent);

  let deviceCategory: 'android' | 'ios' | 'desktop' | 'tablet' | 'other' = 'desktop';
  if (deviceTypeRaw === 'tablet') {
    deviceCategory = 'tablet';
  } else if (isAndroid) {
    deviceCategory = 'android';
  } else if (isIOS) {
    deviceCategory = 'ios';
  }

  const referrer = (req.headers['referer'] || req.headers['referrer'] || 'Direct').toString();
  const country = getCountryFromHeaders(req);

  const parsed = parsePlatformUrl(link.clean_url || link.clean_youtube_url);
  const platform: Platform = link.platform || parsed.platform;

  if (!isBot) {
    recordClick({
      link_id: link.id,
      code: link.code,
      platform,
      device_type: deviceCategory,
      os_name: osName,
      browser_name: browserName,
      is_in_app_browser: isInApp ? 1 : 0,
      referrer: cleanReferrer(referrer),
      country,
      user_agent: userAgent,
      ip_hash: hashIp(req.ip),
    }).catch(() => {});
  }

  // Social crawlers & messaging bots receive rich OpenGraph & AppLinks metadata
  if (isBot) {
    return res.send(generateOpenGraphHtml(link, parsed));
  }

  // Manual preview mode
  if (req.query.preview === '1') {
    return res.send(generateMobileRedirectPage(link, parsed, isAndroid, isIOS, isInApp, true));
  }

  // Desktop users go directly to the canonical web URL with zero interstitial delay
  if (!isAndroid && !isIOS && deviceCategory === 'desktop') {
    return res.redirect(302, link.clean_url || link.clean_youtube_url);
  }

  // Mobile devices receive the platform-aware smart redirect interstitial
  return res.send(generateMobileRedirectPage(link, parsed, isAndroid, isIOS, isInApp, false));
}

function cleanReferrer(ref: string): string {
  if (!ref || ref === 'Direct') return 'Direct';
  try {
    const url = new URL(ref);
    const host = url.hostname.toLowerCase();
    if (host.includes('instagram')) return 'Instagram';
    if (host.includes('whatsapp')) return 'WhatsApp';
    if (host.includes('t.me') || host.includes('telegram')) return 'Telegram';
    if (host.includes('facebook') || host.includes('fb.com') || host.includes('fb.watch')) return 'Facebook';
    if (host.includes('twitter') || host.includes('t.co') || host.includes('x.com')) return 'X (Twitter)';
    if (host.includes('discord')) return 'Discord';
    if (host.includes('youtube') || host.includes('youtu.be')) return 'YouTube';
    return host;
  } catch {
    return ref.slice(0, 50);
  }
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getPlatformBrandMeta(platform: Platform) {
  switch (platform) {
    case 'instagram':
      return {
        name: 'Instagram',
        androidPkg: 'com.instagram.android',
        iosAppId: '389801252',
        accentColor: '#E1306C',
        buttonBg: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
        shadowColor: 'rgba(225, 48, 108, 0.4)',
        badgeBg: 'rgba(225, 48, 108, 0.15)',
        badgeBorder: 'rgba(225, 48, 108, 0.35)',
        badgeText: '#f472b6',
        svgIcon:
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
      };
    case 'facebook':
      return {
        name: 'Facebook',
        androidPkg: 'com.facebook.katana',
        iosAppId: '284882215',
        accentColor: '#1877F2',
        buttonBg: 'linear-gradient(135deg, #1877F2 0%, #0d5bd9 100%)',
        shadowColor: 'rgba(24, 119, 242, 0.4)',
        badgeBg: 'rgba(24, 119, 242, 0.15)',
        badgeBorder: 'rgba(24, 119, 242, 0.35)',
        badgeText: '#60a5fa',
        svgIcon:
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
      };
    case 'youtube':
    default:
      return {
        name: 'YouTube',
        androidPkg: 'com.google.android.youtube',
        iosAppId: '544007664',
        accentColor: '#FF0000',
        buttonBg: 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)',
        shadowColor: 'rgba(229, 9, 20, 0.4)',
        badgeBg: 'rgba(229, 9, 20, 0.15)',
        badgeBorder: 'rgba(229, 9, 20, 0.35)',
        badgeText: '#ff4d4d',
        svgIcon:
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
      };
  }
}

function generateOpenGraphHtml(link: LinkRecord, parsed: ParsedLinkInfo): string {
  const brand = getPlatformBrandMeta(parsed.platform);
  const title = escapeHtml(link.title || `${brand.name} Content`);
  const author = escapeHtml(link.author_name || brand.name);
  const thumbnail = escapeHtml(link.thumbnail_url);
  const cleanUrl = escapeHtml(link.clean_url || link.clean_youtube_url);
  const ogType = parsed.platform === 'youtube' ? 'video.other' : 'website';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="description" content="Open '${title}' by ${author} on ${brand.name}">
  <meta property="og:site_name" content="${brand.name}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="Open in ${brand.name} App | ${author}">
  <meta property="og:image" content="${thumbnail}">
  <meta property="og:image:width" content="1280">
  <meta property="og:image:height" content="720">
  <meta property="og:type" content="${ogType}">
  <meta property="og:url" content="${cleanUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="Open in ${brand.name} App | ${author}">
  <meta name="twitter:image" content="${thumbnail}">
  <meta property="al:android:package" content="${brand.androidPkg}">
  <meta property="al:android:url" content="${escapeHtml(parsed.androidCustomSchemeUrl || cleanUrl)}">
  <meta property="al:ios:url" content="${escapeHtml(parsed.iosDeepLinkUrl)}">
  <meta property="al:ios:app_store_id" content="${brand.iosAppId}">
  <meta property="al:web:url" content="${cleanUrl}">
</head>
<body>
  <h1>${title}</h1>
  <p><a href="${cleanUrl}">Open on ${brand.name}</a></p>
</body>
</html>`;
}

function generateMobileRedirectPage(
  link: LinkRecord,
  parsed: ParsedLinkInfo,
  isAndroid: boolean,
  isIOS: boolean,
  isInApp: boolean,
  previewMode: boolean
): string {
  const brand = getPlatformBrandMeta(parsed.platform);
  const title = escapeHtml(link.title || `${brand.name} Content`);
  const author = escapeHtml(link.author_name || brand.name);
  const thumbnail = escapeHtml(link.thumbnail_url);
  const typeBadge = `${brand.name.toUpperCase()} ${link.url_type.toUpperCase()}`;

  const primaryDeepLink = isAndroid ? parsed.androidIntentUrl : parsed.iosDeepLinkUrl;
  const secondaryDeepLink = isAndroid
    ? parsed.androidCustomSchemeUrl || parsed.webFallbackUrl
    : parsed.webFallbackUrl;
  const webFallbackUrl = parsed.webFallbackUrl;
  const iosPreferUniversal = parsed.iosPreferUniversalLink;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <meta name="theme-color" content="#09090b">
  <title>${title} - Opening ${brand.name}...</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #09090b;
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
      text-align: center;
      overflow-x: hidden;
    }
    .background-glow {
      position: fixed;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100vw;
      height: 60vh;
      background: radial-gradient(circle at 50% 20%, ${brand.shadowColor}, transparent 70%);
      opacity: 0.45;
      pointer-events: none;
      z-index: 0;
    }
    .container {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 440px;
      background: rgba(18, 18, 22, 0.88);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 1.5rem;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5), 0 0 30px ${brand.shadowColor};
    }
    .badge-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: ${brand.badgeBg};
      border: 1px solid ${brand.badgeBorder};
      color: ${brand.badgeText};
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      padding: 4px 10px;
      border-radius: 9999px;
    }
    .badge-pulse {
      width: 8px;
      height: 8px;
      background: ${brand.accentColor};
      border-radius: 50%;
      box-shadow: 0 0 8px ${brand.accentColor};
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.25); opacity: 1; }
      100% { transform: scale(0.95); opacity: 0.8; }
    }
    .thumb-wrap {
      position: relative;
      width: 100%;
      padding-top: 56.25%;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 1.25rem;
      background: #18181b;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    .thumb-wrap img {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      object-fit: cover;
    }
    .play-icon-overlay {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 48px; height: 48px;
      background: ${brand.buttonBg};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }
    .video-title {
      font-size: 1.125rem;
      font-weight: 700;
      line-height: 1.35;
      margin-bottom: 0.35rem;
      text-align: left;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .video-author {
      font-size: 0.875rem;
      color: #a1a1aa;
      text-align: left;
      margin-bottom: 1.25rem;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .status-msg {
      font-size: 0.875rem;
      color: #e4e4e7;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .spinner {
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,0.2);
      border-top-color: ${brand.accentColor};
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .btn-app {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 0.875rem 1.25rem;
      background: ${brand.buttonBg};
      color: #ffffff;
      text-decoration: none;
      font-size: 1rem;
      font-weight: 700;
      border-radius: 12px;
      box-shadow: 0 4px 20px ${brand.shadowColor};
      transition: transform 0.15s, box-shadow 0.15s;
      cursor: pointer;
      border: none;
    }
    .btn-app:active {
      transform: scale(0.98);
    }
    .btn-browser {
      display: block;
      margin-top: 0.875rem;
      padding: 0.65rem;
      color: #a1a1aa;
      font-size: 0.85rem;
      text-decoration: none;
      border-radius: 8px;
      transition: color 0.2s;
    }
    .btn-browser:hover {
      color: #ffffff;
      text-decoration: underline;
    }
    .in-app-tip {
      margin-top: 1.25rem;
      padding: 0.75rem 0.875rem;
      background: rgba(255, 255, 255, 0.04);
      border: 1px dashed rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      font-size: 0.775rem;
      color: #a1a1aa;
      line-height: 1.45;
      text-align: left;
    }
    .in-app-tip strong { color: #f4f4f5; }
    .footer-brand { margin-top: 1.25rem; font-size: 0.75rem; color: #71717a; }
    .footer-brand a { color: #a1a1aa; text-decoration: none; }
  </style>
</head>
<body>
  <div class="background-glow"></div>

  <div class="container">
    <div class="badge-bar">
      <div class="badge">
        <span class="badge-pulse"></span>
        <span>${typeBadge}</span>
      </div>
      <span style="font-size: 0.75rem; color: #71717a;">Smart Redirect</span>
    </div>

    <div class="thumb-wrap">
      <img src="${thumbnail}" alt="${title}" onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80'" />
      <div class="play-icon-overlay">
        ${brand.svgIcon}
      </div>
    </div>

    <h2 class="video-title">${title}</h2>
    <div class="video-author">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      <span>${author}</span>
    </div>

    <div class="status-msg" id="statusMessage">
      <div class="spinner"></div>
      <span id="statusText">Opening in ${brand.name}...</span>
    </div>

    <a id="openAppBtn" class="btn-app" href="${escapeHtml(primaryDeepLink)}">
      ${brand.svgIcon}
      <span>Open in ${brand.name} App</span>
    </a>

    <a id="fallbackWebBtn" class="btn-browser" href="${escapeHtml(webFallbackUrl)}">
      Continue in Browser instead
    </a>

    ${
      isInApp
        ? `
      <div class="in-app-tip">
        <strong>In-App Browser detected:</strong><br>
        Some in-app browsers restrict automatic app switching. If ${brand.name} does not open automatically, tap the <strong>•••</strong> or <strong>⋮</strong> menu and choose <strong>"Open in Chrome / Safari"</strong>.
      </div>
      `
        : ''
    }

    <div class="footer-brand">
      Powered by <a href="/">LinkTwin</a> &bull; Universal Smart Links
    </div>
  </div>

  <script>
    (function() {
      var isAndroid = ${isAndroid ? 'true' : 'false'};
      var isIOS = ${isIOS ? 'true' : 'false'};
      var iosPreferUniversal = ${iosPreferUniversal ? 'true' : 'false'};
      var previewMode = ${previewMode ? 'true' : 'false'};
      var primaryUrl = ${JSON.stringify(primaryDeepLink)};
      var secondaryUrl = ${JSON.stringify(secondaryDeepLink)};
      var fallbackUrl = ${JSON.stringify(webFallbackUrl)};

      var statusText = document.getElementById('statusText');
      var openAppBtn = document.getElementById('openAppBtn');

      if (previewMode) {
        if (statusText) statusText.innerText = 'Preview Mode (Simulated)';
        return;
      }

      var startTime = Date.now();

      function triggerDeepLink() {
        if (isAndroid) {
          // Android Intent handles native app launch and S.browser_fallback_url safely
          window.location.href = primaryUrl;
        } else if (isIOS) {
          if (iosPreferUniversal) {
            // For iOS Universal Links (e.g., Instagram Reels/Posts), navigate directly to HTTPS Universal Link
            // so iOS handles opening the app when installed or falls back natively to Safari.
            if (statusText) statusText.innerText = 'Launching ${brand.name} Universal Link...';
            setTimeout(function() {
              window.location.replace(fallbackUrl);
            }, 350);
          } else {
            window.location.href = primaryUrl;
            setTimeout(function() {
              if (!document.hidden && Date.now() - startTime < 3500) {
                if (statusText) statusText.innerText = 'Opening in Browser fallback...';
                window.location.replace(fallbackUrl);
              }
            }, 1800);
          }
        } else {
          window.location.replace(fallbackUrl);
        }
      }

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(triggerDeepLink, 120);
      } else {
        document.addEventListener('DOMContentLoaded', function() {
          setTimeout(triggerDeepLink, 120);
        });
      }

      if (openAppBtn) {
        openAppBtn.addEventListener('click', function() {
          if (isAndroid) {
            window.location.href = primaryUrl;
          } else if (isIOS && !iosPreferUniversal) {
            window.location.href = primaryUrl;
            setTimeout(function() {
              if (!document.hidden) {
                window.location.href = secondaryUrl;
              }
            }, 900);
          }
        });
      }
    })();
  </script>
</body>
</html>`;
}
