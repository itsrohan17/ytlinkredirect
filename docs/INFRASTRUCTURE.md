# Phase 2 Infrastructure, Storage & Worker Guide

## 1. Cost & Free Alternative Architecture

LinkTwin is designed to run at **$0/month** on free tiers for standard usage, with optional scalable upgrades for large (>100 MB) server-side video jobs:

| Component | Default / Free Option | Paid / Scale Alternative | Notes |
|---|---|---|---|
| **Web & API Hosting** | **Vercel Hobby** ($0/mo) | Vercel Pro ($20/mo) | Serverless Express API + CDN |
| **Database** | **Turso Starter** ($0/mo, 9 GB, 500 DBs) | Turso Scaler ($29/mo) | Cloud SQLite over HTTP (`@libsql/client`) |
| **Media Processing (≤100 MB)** | **Browser FFmpeg WASM & Canvas** ($0/mo) | N/A (runs on user's device) | Zero server CPU cost, full privacy |
| **Object Storage (>100 MB)** | **Cloudflare R2 Free** (10 GB storage, $0 egress) | AWS S3 ($0.023/GB + egress) | Private bucket + AWS SigV4 signed URLs |
| **Background Worker (>100 MB)** | **Render Free / Fly.io Free** / Self-hosted VPS | Railway ($5/mo usage) | Runs `npm run worker` with native `ffmpeg` |

---

## 2. Security Controls Implemented

1. **Private Object Storage & Ownership Validation:**
   - Buckets remain private; uploads (`PUT`) and downloads (`GET`) use short-lived AWS SigV4 presigned URLs (`SIGNED_URL_TTL_SECONDS`, default 600s).
   - Every job generates a cryptographic `ownerToken` whose HMAC-SHA256 hash is stored in `media_jobs.owner_token_hash` and verified with `crypto.timingSafeEqual`.
2. **Magic-Byte Signature Verification (`server/services/fileSecurity.ts`):**
   - Validates actual leading file bytes (MP4 `ftyp`, WebM/MKV `1A45DFA3`, AVI `RIFF...AVI`, JPG `FFD8FF`, PNG `89504E47`, WebP `RIFF...WEBP`, GIF, AVIF, MP3 `ID3`/`FFFB`, WAV, FLAC, OGG, PDF `%PDF-`) and blocks executables (`MZ`, `ELF`, `<?php`).
3. **SSRF Hardening with Redirect Revalidation (`safeFetchExternalUrl`):**
   - Validates protocols (`http:`/`https:` only), resolves DNS records, rejects RFC1918/loopback/link-local/metadata IP ranges, disables automatic redirects (`redirect: 'manual'`), re-validates every redirect `Location`, and caps timeout + response size.
4. **Worker Retries, Timeouts & Deduplication:**
   - Duplicate active jobs prevented via `dedupe_key`.
   - Atomic claiming (`UPDATE media_jobs SET status = 'processing' WHERE job_id = ? AND status = 'queued'`).
   - Configurable timeouts (`WORKER_JOB_TIMEOUT_MS`) killing stalled `ffmpeg` processes and automatic retries (`max_retries`).
   - Automatic expiration & S3/R2 object deletion via `runCleanupSweep()`.

---

## 3. Production Session Secret & Key Rotation

LinkTwin isolates each workspace's Smart Links, click analytics, and media job telemetry behind a 256-bit `HttpOnly` `lt_session` cookie hashed with HMAC-SHA256.

- **`SESSION_SECRET` (Required in `NODE_ENV=production` / `VERCEL=1`):** Must be at least 32 characters (e.g., `openssl rand -hex 32`). Never reuse `TURSO_AUTH_TOKEN` as the session secret. If `SESSION_SECRET` is missing or too short in production, session-creating/authenticated endpoints fail safely with `503 Service Unavailable`, while public Smart Link redirects (`/:code`) and `/api/health` continue serving normally.
- **Zero-Downtime Secret Rotation:**
  1. Generate a new 32-byte secret (`openssl rand -hex 32`).
  2. Move the old `SESSION_SECRET` value into `SESSION_SECRET_PREVIOUS` and set the new value in `SESSION_SECRET`.
  3. Existing cookies and legacy Phase 5 SHA-256 `owner_token_hash` rows are validated and atomically upgraded to the new HMAC-SHA256 hash on their next authenticated request.
  4. Once the 7-day cookie TTL elapses, remove `SESSION_SECRET_PREVIOUS`.
- **Per-User Token Rotation (`POST /api/links/session/rotate`):** Atomically re-keys all `links` and `media_jobs` owned by the caller inside a single LibSQL batch write transaction, immediately invalidating prior cookies.
