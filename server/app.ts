import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDatabaseMode, getLinkByCode } from './db.js';
import { linksRouter } from './routes/links.js';
import { thumbnailsRouter } from './routes/thumbnails.js';
import {
  enforceSameOriginOnMutations,
  getAllowedOrigins,
  isSessionSecretConfigured,
} from './services/session.js';
import { handleSmartRedirect } from './redirect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Trust proxy for rate limiting, IP detection, and protocol detection behind Vercel/reverse proxies
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// Restrictive same-origin CORS policy (never wildcard credentials with arbitrary third-party origins)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) {
    return next();
  }
  const allowed = getAllowedOrigins(req);
  if (allowed.has(origin.toLowerCase())) {
    return cors({ origin: true, credentials: true })(req, res, next);
  }
  return cors({ origin: false })(req, res, next);
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (never logs headers, cookies, or secrets)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} - ${res.statusCode} (${Date.now() - start}ms)`);
    }
  });
  next();
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  message: { error: 'Too many write requests from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  skip: (req) => req.method !== 'GET',
  message: { error: 'Too many read requests from this IP. Please slow down briefly.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function buildHealthPayload() {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? 'vercel' : 'node',
    capabilities: {
      databaseMode: getDatabaseMode(),
      sessionConfigured: isSessionSecretConfigured(),
    },
  };
}

app.get('/health', (_req, res) => {
  res.status(200).json(buildHealthPayload());
});

app.get('/api/health', (_req, res) => {
  res.status(200).json(buildHealthPayload());
});

// Core product API routers (CSRF origin-enforced + rate-limited)
app.use('/api/thumbnails', enforceSameOriginOnMutations, apiReadLimiter, writeLimiter, thumbnailsRouter);
app.use('/thumbnails', enforceSameOriginOnMutations, apiReadLimiter, writeLimiter, thumbnailsRouter);
app.use('/api/media', apiReadLimiter, thumbnailsRouter); // Preserves legacy /api/media/thumbnail?videoId=...&quality=...

app.use('/api/links', enforceSameOriginOnMutations, apiReadLimiter, writeLimiter, linksRouter);
app.use('/links', enforceSameOriginOnMutations, apiReadLimiter, writeLimiter, linksRouter);
app.use('/api', enforceSameOriginOnMutations, apiReadLimiter, linksRouter);

// Public Smart Redirect route: /:code (YouTube, Instagram, Facebook)
app.get('/:code', async (req, res, next) => {
  const code = String(req.params.code || '');

  if (
    code.includes('.') ||
    code.startsWith('api') ||
    code.startsWith('assets') ||
    code === 'favicon.ico' ||
    code === 'robots.txt' ||
    code === 'health' ||
    code === 'preview' ||
    code === 'session' ||
    code === 'recent' ||
    code === 'links' ||
    code === 'thumbnails' ||
    code === 'thumbnail' ||
    code === 'media' ||
    code === 'summary'
  ) {
    return next();
  }

  try {
    const link = await getLinkByCode(code);
    if (link) {
      return await handleSmartRedirect(req, res);
    }
  } catch (err) {
    console.error(`❌ [Redirect Error] /${code}:`, err);
  }

  next();
});

// Standalone Production: serve built Vite client files
const clientDistPath = path.resolve(process.cwd(), 'dist-client');
if (fs.existsSync(clientDistPath) && !process.env.VERCEL) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/links') ||
      req.path.startsWith('/thumbnails')
    ) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global 404 handler for API routes - ALWAYS returns JSON
app.use((req, res, next) => {
  if (
    req.path.startsWith('/api') ||
    req.path.startsWith('/links') ||
    req.path.startsWith('/thumbnails')
  ) {
    return res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  }
  next();
});

// Global Error Handler - ALWAYS returns JSON (never echoes credentials)
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`❌ [Express Unhandled Error] ${req.method} ${req.originalUrl}:`, err?.message || err);
  const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err?.message || 'Request failed',
  });
});
