<div align="center">

# 🎬 LinkTwin

### Universal Social Media Smart Link & Deep Link Redirector

[![Node.js Version](https://img.shields.io/badge/Node.js-v20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![SQLite / Turso](https://img.shields.io/badge/Database-Turso_libSQL-003B57?logo=sqlite&logoColor=white)](https://turso.tech/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, fast, responsive platform designed to convert **YouTube**, **Instagram**, and **Facebook** URLs into permanent smart links that route mobile visitors into native mobile apps wherever supported, with seamless browser fallbacks.

</div>

---

## 🌐 Supported Platforms (Strictly 3)

- **YouTube**: Standard Videos, Shorts, Playlists, Channels (`/@handle`, `/channel/...`), Live Streams, and preserved timestamps (`&t=...`).
- **Instagram**: Reels (`/reel/...`, `/reels/...`), Posts (`/p/...`), and Profiles (`/{username}`).
- **Facebook**: Reels (`/reel/...`, `/share/r/...`), Watch Videos (`/watch?v=...`, `fb.watch/...`), Posts, Groups, and Pages/Profiles (`/profile.php?id=...`, `/{username}`).

---

## ⚡ How Deep Linking Works

- 📱 **Android**: Uses Android App Links / Intent URIs (`intent://...#Intent;package=...;scheme=https;S.browser_fallback_url=...;end`) targeting YouTube (`com.google.android.youtube`), Instagram (`com.instagram.android`), and Facebook (`com.facebook.katana`), with automatic fallback to the mobile web browser.
- 🍎 **iOS**: Uses verified HTTPS Universal Links (preferred for Instagram Reels & Posts where custom schemes do not support shortcodes reliably) and documented app schemes (`youtube://`, `fb://facewebmodal/f?href=...`, `instagram://user?username=...`) with smart visibility-timer browser fallbacks.
- 🖥️ **Desktop**: Instant HTTP 302 redirect directly to the canonical platform URL with parameters preserved.
- 💬 **Messaging Previews**: Automatically serves full OpenGraph & App Links (`al:android:*`, `al:ios:*`) metadata to WhatsApp, Telegram, Discord, and X crawlers.

---

## ✨ Features

- **Modular Platform Detection**: Automatic detection, URL normalization, reserved route protection, and rejection of unsupported/malicious domains.
- **Custom Slugs & QR Codes**: Optional custom aliases (`yourdomain.com/my-link`) and downloadable high-resolution PNG QR codes.
- **Advanced Privacy-First Analytics**: Tracks platform-specific clicks (YouTube, Instagram, Facebook), device splits (Android, iOS, Desktop), browsers, referral sources, and header-derived country metrics (`x-vercel-ip-country` / `cf-ipcountry`) without storing raw IP addresses.
- **Permitted Creator Media Tools**:
  - 1-click HD/SD/HQ YouTube thumbnail downloads (`i.ytimg.com` public CDN).
  - Official HTML embed snippet generation for YouTube, Instagram, and Facebook.
  - Step-by-step official owner download guides (**YouTube Studio**, **Meta Accounts Center**, **Meta Business Suite**).
  - Transparent notices explaining unsupported DRM/private media restrictions.

---

## 🛠️ Technologies Used

- **Frontend**: React 19, Vite 6, Tailwind CSS 3, Lucide React, `qrcode.react`
- **Backend**: Node.js, Express 4, TypeScript, `@vercel/node`
- **Database**: Turso (`@libsql/client`) cloud SQLite in production; local SQLite (`data/app.db`) in development with non-destructive, idempotent migrations.

---

## ⚙️ Environment Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `TURSO_DATABASE_URL` | Production | Turso libSQL connection URL (`libsql://...`) |
| `TURSO_AUTH_TOKEN` | Production | Turso authentication token |
| `PORT` | Local | Server port (defaults to `3000`) |
| `NODE_ENV` | Production | Set to `production` |
| `BASE_URL` | Optional | Custom domain override (`https://yourbrand.com`) |

---

## 🚀 Installation, Testing & Deployment

### 1. Install dependencies
```bash
npm install
```

### 2. Development Mode
```bash
npm run dev
```

### 3. Production Build & Tests
```bash
npm run build
npx tsx tests/platforms.test.ts
npx tsx tests/migration.test.ts
node tests/e2e.test.js
node tests/serverless.test.js
```

### 4. Vercel Deployment Settings
- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Output Directory**: `dist-client`
- **Environment Variables**: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `NODE_ENV=production`

---

## 📡 REST API Reference

- `POST /api/links` — Create a smart link for YouTube, Instagram, or Facebook.
- `GET /api/preview?url=...` — Real-time platform detection and metadata preview.
- `GET /api/links/summary` — Global platform-specific analytics across YouTube, Instagram, and Facebook.
- `GET /api/links/:code/stats` — Detailed per-link analytics (devices, browsers, countries, referrers).
- `POST /api/media/inspect` — Inspect permitted public assets, embed codes, and official owner download workflows.
- `GET /api/media/thumbnail?videoId=...&quality=maxres|sd|hq` — Download permitted public YouTube thumbnails.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
