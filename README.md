<div align="center">

# 🎬 LinkTwin

### High-Conversion YouTube Smart Deep Link & App Redirector

[![Node.js Version](https://img.shields.io/badge/Node.js-v20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, fast, responsive web application inspired by **Linktw.in**, engineered to convert normal YouTube links into smart deep links that bypass restricted in-app browser WebViews and open directly in the **native YouTube app** on iOS & Android.

</div>

---

## 📖 Overview

When creators, artists, and marketers share YouTube links on **Instagram (Bio/Stories), TikTok, WhatsApp, Telegram, or Facebook**, those platforms trap viewers inside an embedded **in-app browser**:
- ❌ **Viewers are logged out:** They cannot 1-tap Like, Comment, or Subscribe.
- ❌ **Google blocks OAuth:** Logging into Google accounts inside WebViews is blocked for security reasons.
- ❌ **Huge drop-off:** Up to 75% of prospective subscribers leave without converting.

**LinkTwin solves this with smart deep linking:**
- 📱 **Android:** Uses Android Intents (`intent://...#Intent;package=com.google.android.youtube...`) to launch the native YouTube app with automatic fallback to browser (`S.browser_fallback_url=...`).
- 🍎 **iOS:** Triggers YouTube custom URI schemes (`youtube://...`) with a smart page blur timer fallback.
- 🌐 **Desktop:** Instant HTTP 302/307 direct redirect with zero delay and all URL parameters preserved.
- 💬 **Social Media Previews:** Automatically generates OpenGraph and Twitter cards for WhatsApp, Telegram, Discord, and X, ensuring rich thumbnails and titles appear in chat feeds.

---

## ✨ Features

- **🎯 Multi-Format Support:**
  - Standard Videos (`youtube.com/watch?v=...`, `youtu.be/...`)
  - YouTube Shorts (`youtube.com/shorts/...`)
  - Curated Playlists (`youtube.com/playlist?list=...`)
  - Creator Channels & Handles (`youtube.com/@handle`, `youtube.com/channel/...`)
  - Timestamped Links (`&t=120s` or `?start=45`)
- **⚡ Real-Time Target Detection:** Auto-detects link type and fetches YouTube title and high-resolution thumbnail on paste.
- **🏷️ Custom Slug / Alias:** Option to personalize short links (e.g. `yourdomain.com/my-vlog`).
- **📋 One-Click Copy & Share:** Instant clipboard copy with visual feedback, plus direct WhatsApp, Telegram, and X share links.
- **📱 Interactive Device Simulator:** Preview live redirect behavior across Android, iOS, Instagram In-App browser, and Desktop.
- **📊 Real-Time Analytics:** Live SQLite-backed click counter, device breakdown (Android vs iOS vs Desktop), in-app browser traps avoided, and referrers.
- **🔳 High-Resolution QR Codes:** Live SVG/Canvas QR code with 1-click PNG download.
- **🔒 Security & Spam Protection:** Anti-phishing host validation, XSS prevention, and IP-based rate limiting.

---

## 🛠️ Technologies Used

### Frontend
- **React 19** - Modern UI library
- **Vite 6** - Next-generation frontend build tool
- **Tailwind CSS 3** - Utility-first styling with dark mode and custom glowing effects
- **Lucide React** - Clean and consistent icon set
- **qrcode.react** - High-resolution client-side QR generation

### Backend & Database
- **Node.js** (v20+) & **Express 4** - High-performance HTTP server
- **TypeScript** - Strict end-to-end type safety
- **SQLite (`sql.js`)** - Sub-millisecond indexed ACID persistent storage
- **ua-parser-js** - Device, OS, and in-app browser detection
- **nanoid** - Collision-resistant unique short link generation
- **helmet** & **cors** - Standard security middleware
- **express-rate-limit** - API abuse and spam prevention

---

## ⚙️ Environment Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Available options:
| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port for the Express server to listen on |
| `NODE_ENV` | `development` | Application mode (`development` or `production`) |
| `BASE_URL` | *(request host)* | Optional domain override for generated URLs |

---

## 🚀 Installation & Local Development

### 1. Clone the repository
```bash
git clone https://github.com/itsrohan17/ytlinkredirect.git
cd ytlinkredirect
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run in Development Mode
Starts both the Express server (with file watching) and the Vite development server concurrently:
```bash
npm run dev
```

### 4. Run Automated End-to-End Tests
```bash
node tests/e2e.test.js
```

---

## 📦 Production Build & Deployment

### 1. Build the client and server
```bash
npm run build
```
This builds:
- Frontend assets into `dist-client/`
- Backend TypeScript into `dist-server/`

### 2. Start the production server
```bash
npm start
```
The server serves both the API, the smart redirect routes, and the production React SPA on `http://localhost:3000`.

---

## 🌐 Deployment Instructions

### Option A: Railway / Render / VPS with Node.js
1. Set the build command:
   ```bash
   npm run build
   ```
2. Set the start command:
   ```bash
   npm start
   ```
3. Set the environment variable:
   ```env
   NODE_ENV=production
   PORT=3000
   ```

### Option B: PM2 (Process Manager)
```bash
npm install -g pm2
npm run build
pm2 start dist-server/index.js --name "linktwin"
pm2 save
```

### Option C: Docker (Sample Dockerfile)
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist-client ./dist-client
COPY --from=builder /app/dist-server ./dist-server
EXPOSE 3000
CMD ["node", "dist-server/index.js"]
```

---

## 📡 REST API Reference

### Create a Smart Link
```http
POST /api/links
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "customSlug": "my-music-video" // optional
}
```

**Response (`201 Created`):**
```json
{
  "success": true,
  "link": {
    "id": 1,
    "code": "my-music-video",
    "clean_youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "url_type": "video",
    "title": "Rick Astley - Never Gonna Give You Up",
    "author_name": "Rick Astley",
    "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    "click_count": 0
  },
  "shortUrl": "https://yourdomain.com/my-music-video"
}
```

### Fetch Real-Time Analytics
```http
GET /api/links/:code/stats
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
