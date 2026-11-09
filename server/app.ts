import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDb, getLinkByCode } from './db.js';
import { linksRouter } from './routes/links.js';
import { handleSmartRedirect } from './redirect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Trust proxy for rate limiting, IP detection, and protocol detection on Vercel/proxies
app.set('trust proxy', 1);

// Basic security headers, permitting required images and inline scripts for redirect UX
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled to allow external YouTube thumbnails and inline redirect scripts
    crossOriginEmbedderPolicy: false,
  })
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/links', linkCreateLimiter, linksRouter);
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
    code === 'robots.txt'
  ) {
    return next();
  }

  try {
    // Check if code exists in links DB
    const link = await getLinkByCode(code);
    if (link) {
      return await handleSmartRedirect(req, res);
    }
  } catch (err) {
    console.error('Error handling smart redirect:', err);
  }

  // Not a link code, pass to next (frontend router or 404)
  next();
});

// Standalone Production: Serve built Vite client files if they exist on disk
const clientDistPath = path.resolve(process.cwd(), 'dist-client');
if (fs.existsSync(clientDistPath) && !process.env.VERCEL) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

export default app;
