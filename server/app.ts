import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getLinkByCode } from './db.js';
import { linksRouter } from './routes/links.js';
import { mediaRouter } from './routes/media.js';
import { jobsRouter } from './routes/jobs.js';
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

app.use(cors());
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

// Rate limiting for link creation (60 requests per 15 minutes per IP)
const linkCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many requests created from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Mount jobsRouter on /api/jobs and /jobs
app.use('/api/jobs', linkCreateLimiter, jobsRouter);
app.use('/jobs', linkCreateLimiter, jobsRouter);

// Mount mediaRouter on /api/media and /media
app.use('/api/media', linkCreateLimiter, mediaRouter);
app.use('/media', linkCreateLimiter, mediaRouter);

// Mount linksRouter on both /api/links, /links, and /api
app.use('/api/links', linkCreateLimiter, linksRouter);
app.use('/links', linkCreateLimiter, linksRouter);
app.use('/api', linksRouter);

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
    code === 'recent' ||
    code === 'links' ||
    code === 'media' ||
    code === 'jobs' ||
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
    req.path.startsWith('/jobs')
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
