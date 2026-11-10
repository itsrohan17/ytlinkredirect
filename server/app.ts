import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDatabaseMode, getLinkByCode } from './db.js';
import {
  isObjectStorageConfigured,
  MAX_BROWSER_MB,
  MAX_WORKER_MB,
  SIGNED_URL_TTL_SECONDS,
} from './services/storage.js';
import { linksRouter } from './routes/links.js';
import { mediaRouter } from './routes/media.js';
import { jobsRouter } from './routes/jobs.js';
import { utilitiesRouter } from './routes/utilities.js';
import { enforceSameOriginOnMutations, getAllowedOrigins } from './services/session.js';
import { handleSmartRedirect } from './redirect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Trust proxy for rate limiting, IP detection, and protocol detection on Vercel/proxies
app.set('trust proxy', 1);

// Basic security headers, permitting required images and inline scripts for redirect UX
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging for production observability
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} - ${res.statusCode} (${Date.now() - start}ms)`);
    }
  });
  next();
});

// Rate limiting: 60 write mutations / 15 min & 300 reads / 15 min per IP
const linkCreateLimiter = rateLimit({
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
  const objectStorageConfigured = isObjectStorageConfigured();
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? 'vercel' : 'node',
    capabilities: {
      databaseMode: getDatabaseMode(),
      objectStorageConfigured,
      workerQueueSupported: objectStorageConfigured,
      limits: {
        browserWasmMaxMb: MAX_BROWSER_MB,
        workerMaxMb: MAX_WORKER_MB,
        signedUrlTtlSeconds: SIGNED_URL_TTL_SECONDS,
        fileTtlHours: Number(process.env.FILE_TTL_HOURS || 24),
      },
    },
  };
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json(buildHealthPayload());
});

app.get('/api/health', (_req, res) => {
  res.status(200).json(buildHealthPayload());
});

// Enforce CSRF same-origin guard + read/write rate limits on all API routers
app.use('/api/utilities', enforceSameOriginOnMutations, apiReadLimiter, linkCreateLimiter, utilitiesRouter);
app.use('/utilities', enforceSameOriginOnMutations, apiReadLimiter, linkCreateLimiter, utilitiesRouter);

app.use('/api/jobs', enforceSameOriginOnMutations, apiReadLimiter, linkCreateLimiter, jobsRouter);
app.use('/jobs', enforceSameOriginOnMutations, apiReadLimiter, linkCreateLimiter, jobsRouter);

app.use('/api/media', enforceSameOriginOnMutations, apiReadLimiter, linkCreateLimiter, mediaRouter);
app.use('/media', enforceSameOriginOnMutations, apiReadLimiter, linkCreateLimiter, mediaRouter);

app.use('/api/links', enforceSameOriginOnMutations, apiReadLimiter, linkCreateLimiter, linksRouter);
app.use('/links', enforceSameOriginOnMutations, apiReadLimiter, linkCreateLimiter, linksRouter);
app.use('/api', enforceSameOriginOnMutations, apiReadLimiter, linksRouter);

// Smart Redirect route: /:code
app.get('/:code', async (req, res, next) => {
  const code = String(req.params.code || '');

  // Skip static assets or reserved prefixes
  if (
    code.includes('.') ||
    code.startsWith('api') ||
    code.startsWith('assets') ||
    code === 'favicon.ico' ||
    code === 'robots.txt' ||
    code === 'health' ||
    code === 'preview' ||
    code === 'analytics' ||
    code === 'session' ||
    code === 'recent' ||
    code === 'links' ||
    code === 'media' ||
    code === 'jobs' ||
    code === 'utilities' ||
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

// Standalone Production: Serve built Vite client files if they exist on disk
const clientDistPath = path.resolve(process.cwd(), 'dist-client');
if (fs.existsSync(clientDistPath) && !process.env.VERCEL) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/links')) {
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
    req.path.startsWith('/media') ||
    req.path.startsWith('/jobs') ||
    req.path.startsWith('/utilities')
  ) {
    return res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  }
  next();
});

// Global Error Handler - ALWAYS returns JSON
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`❌ [Express Unhandled Error] ${req.method} ${req.originalUrl}:`, err);
  const status = typeof err.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json({
    error: err.message || 'Internal server error occurred',
    code: err.code || 'INTERNAL_ERROR',
  });
});

export default app;
