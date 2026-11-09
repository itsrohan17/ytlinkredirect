import { Request, Response } from 'express';
import { UAParser } from 'ua-parser-js';
import { getLinkByCode, recordClick } from './db.js';
import { parseYouTubeUrl } from './youtube.js';
import crypto from 'crypto';

// Common social crawler bot user agents
const BOT_REGEX = /bot|crawl|spider|whatsapp|telegrambot|facebookexternalhit|facebot|twitterbot|discordbot|slackbot|linkedinbot|applebot|pinterest|skypeuripreview|googlebot|bingbot|yandex/i;

// In-app browsers: Instagram, FB, TikTok, Twitter, Snapchat, LinkedIn, Line, WeChat
const IN_APP_REGEX = /instagram|fban|fbav|tiktok|musical_ly|bytedance|snapchat|line\/|micromessenger|twitter|linkedinapp|discord/i;

function hashIp(ip: string | undefined): string {
  if (!ip) return '';
  return crypto.createHash('sha256').update(ip + 'salt_yt_paster').digest('hex').slice(0, 12);
}

export function handleSmartRedirect(req: Request, res: Response) {
  const code = String(req.params.code || '');
  const link = getLinkByCode(code);

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
          <p>The YouTube smart link <code>${escapeHtml(code)}</code> does not exist or has expired.</p>
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
  const deviceTypeRaw = uaResult.device.type; // 'mobile', 'tablet', undefined

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

  // Async record click without slowing down redirect
  if (!isBot) {
    setTimeout(() => {
      recordClick({
        link_id: link.id,
        code: link.code,
        device_type: deviceCategory,
        os_name: osName,
        browser_name: browserName,
        is_in_app_browser: isInApp ? 1 : 0,
        referrer: cleanReferrer(referrer),
        user_agent: userAgent,
        ip_hash: hashIp(req.ip),
      });
    }, 0);
  }

  // Parse original YouTube info to get precise deep linking targets
  const parsed = parseYouTubeUrl(link.clean_youtube_url);

  // If Crawler / Social Bot: Output rich OpenGraph & Twitter Cards
  if (isBot) {
    return res.send(generateOpenGraphHtml(link, parsed));
  }

  // If user requested manual preview ?preview=1
  if (req.query.preview === '1') {
    return res.send(generateMobileRedirectPage(link, parsed, isAndroid, isIOS, isInApp, true));
  }

  // Desktop Redirection: If not mobile and not in-app, perform instant 302 redirect
  if (!isAndroid && !isIOS && deviceCategory === 'desktop') {
    return res.redirect(302, link.clean_youtube_url);
  }

  // Mobile Redirection (Android, iOS, Tablets, In-App WebViews):
  // Deliver the high-performance smart deep linking page
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
    if (host.includes('facebook') || host.includes('fb.com')) return 'Facebook';
    if (host.includes('twitter') || host.includes('t.co') || host.includes('x.com')) return 'Twitter / X';
    if (host.includes('discord')) return 'Discord';
    if (host.includes('tiktok')) return 'TikTok';
    if (host.includes('youtube')) return 'YouTube';
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

function generateOpenGraphHtml(link: any, parsed: any): string {
  const title = escapeHtml(link.title || 'YouTube Video');
  const author = escapeHtml(link.author_name || 'YouTube');
  const thumbnail = escapeHtml(link.thumbnail_url);
  const cleanUrl = escapeHtml(link.clean_youtube_url);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="description" content="Watch '${title}' by ${author} on YouTube">
  <meta property="og:site_name" content="YouTube">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="Watch on YouTube App | ${author}">
  <meta property="og:image" content="${thumbnail}">
  <meta property="og:image:width" content="1280">
  <meta property="og:image:height" content="720">
  <meta property="og:type" content="video.other">
  <meta property="og:url" content="${cleanUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="Watch on YouTube App | ${author}">
  <meta name="twitter:image" content="${thumbnail}">
  ${parsed.videoId ? `<meta property="al:android:url" content="vnd.youtube:${parsed.videoId}">` : ''}
  ${parsed.videoId ? `<meta property="al:android:package" content="com.google.android.youtube">` : ''}
  ${parsed.videoId ? `<meta property="al:ios:url" content="youtube://www.youtube.com/watch?v=${parsed.videoId}">` : ''}
  ${parsed.videoId ? `<meta property="al:ios:app_store_id" content="544007664">` : ''}
  ${parsed.videoId ? `<meta property="al:web:url" content="${cleanUrl}">` : ''}
</head>
<body>
  <h1>${title}</h1>
  <p><a href="${cleanUrl}">Watch on YouTube</a></p>
</body>
</html>`;
}

function generateMobileRedirectPage(
  link: any,
  parsed: any,
  isAndroid: boolean,
  isIOS: boolean,
  isInApp: boolean,
  previewMode: boolean
): string {
  const title = escapeHtml(link.title || 'YouTube Video');
  const author = escapeHtml(link.author_name || 'YouTube Creator');
  const thumbnail = escapeHtml(link.thumbnail_url);
  const cleanUrl = escapeHtml(link.clean_youtube_url);
  const typeBadge = link.url_type.toUpperCase();

  // Pick primary deep link URL based on OS
  const primaryDeepLink = isAndroid ? parsed.androidIntentUrl : parsed.iosSchemeUrl;
  const secondaryDeepLink = isAndroid ? parsed.androidCustomSchemeUrl : parsed.iosSchemeUrl;
  const webFallbackUrl = parsed.webFallbackUrl;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <meta name="theme-color" content="#09090b">
  <title>${title} - Opening YouTube...</title>
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
      background: radial-gradient(circle at 50% 20%, rgba(229, 9, 20, 0.18), transparent 70%);
      pointer-events: none;
      z-index: 0;
    }
    .container {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 440px;
      background: rgba(18, 18, 22, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 1.5rem;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5), 0 0 30px rgba(229, 9, 20, 0.15);
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
      background: rgba(229, 9, 20, 0.15);
      border: 1px solid rgba(229, 9, 20, 0.3);
      color: #ff4d4d;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      padding: 4px 10px;
      border-radius: 9999px;
    }
    .badge-pulse {
      width: 8px;
      height: 8px;
      background: #ff0000;
      border-radius: 50%;
      box-shadow: 0 0 8px #ff0000;
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
      background: rgba(229, 9, 20, 0.9);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }
    .play-icon-overlay svg {
      width: 22px; height: 22px;
      fill: #fff;
      margin-left: 3px;
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
      border-top-color: #ff0000;
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
      background: linear-gradient(135deg, #FF0000 0%, #CC0000 100%);
      color: #ffffff;
      text-decoration: none;
      font-size: 1rem;
      font-weight: 700;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(229, 9, 20, 0.4);
      transition: transform 0.15s, box-shadow 0.15s;
      cursor: pointer;
      border: none;
    }
    .btn-app:active {
      transform: scale(0.98);
      box-shadow: 0 2px 10px rgba(229, 9, 20, 0.3);
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
    .in-app-tip strong {
      color: #f4f4f5;
    }
    .footer-brand {
      margin-top: 1.25rem;
      font-size: 0.75rem;
      color: #71717a;
    }
    .footer-brand a {
      color: #a1a1aa;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="background-glow"></div>

  <div class="container">
    <div class="badge-bar">
      <div class="badge">
        <span class="badge-pulse"></span>
        <span>YOUTUBE ${typeBadge}</span>
      </div>
      <span style="font-size: 0.75rem; color: #71717a;">Smart Redirect</span>
    </div>

    <div class="thumb-wrap">
      <img src="${thumbnail}" alt="${title}" onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80'" />
      <div class="play-icon-overlay">
        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </div>
    </div>

    <h2 class="video-title">${title}</h2>
    <div class="video-author">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      <span>${author}</span>
    </div>

    <div class="status-msg" id="statusMessage">
      <div class="spinner"></div>
      <span id="statusText">Opening in YouTube App...</span>
    </div>

    <a id="openAppBtn" class="btn-app" href="${primaryDeepLink}">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
      <span>Open in YouTube App</span>
    </a>

    <a id="fallbackWebBtn" class="btn-browser" href="${webFallbackUrl}">
      Continue in Browser instead
    </a>

    ${
      isInApp
        ? `
      <div class="in-app-tip">
        <strong>⚡ In-App Browser detected:</strong><br>
        If YouTube doesn't launch automatically, tap the <strong>•••</strong> or <strong>⋮</strong> menu at the top right and select <strong>"Open in Chrome / Safari"</strong>.
      </div>
      `
        : ''
    }

    <div class="footer-brand">
      Powered by <a href="/">LinkTwin</a> &bull; Permanent Smart Links
    </div>
  </div>

  <script>
    (function() {
      var isAndroid = ${isAndroid ? 'true' : 'false'};
      var isIOS = ${isIOS ? 'true' : 'false'};
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

      // Auto-trigger redirection
      var hasSwitched = false;
      var startTime = Date.now();

      function triggerDeepLink() {
        if (isAndroid) {
          // Android Intent handles app launch and S.browser_fallback_url natively
          window.location.href = primaryUrl;
        } else if (isIOS) {
          // iOS custom scheme
          window.location.href = primaryUrl;
          
          // Fallback to web browser if still on page after 1.8s
          setTimeout(function() {
            if (!document.hidden && Date.now() - startTime < 3500) {
              if (statusText) statusText.innerText = 'Redirecting to Web YouTube...';
              window.location.replace(fallbackUrl);
            }
          }, 1800);
        } else {
          // Desktop or unrecognized mobile
          window.location.replace(fallbackUrl);
        }
      }

      // Page visibility listener: if app opened, document becomes hidden
      document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
          hasSwitched = true;
        }
      });

      // Execute on DOM load
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(triggerDeepLink, 100);
      } else {
        document.addEventListener('DOMContentLoaded', function() {
          setTimeout(triggerDeepLink, 100);
        });
      }

      // Fallback click handler if button is clicked manually
      if (openAppBtn) {
        openAppBtn.addEventListener('click', function(e) {
          if (isAndroid) {
            window.location.href = primaryUrl;
          } else if (isIOS) {
            window.location.href = primaryUrl;
            setTimeout(function() {
              if (!document.hidden) {
                window.location.href = secondaryUrl;
              }
            }, 800);
          }
        });
      }
    })();
  </script>
</body>
</html>`;
}
