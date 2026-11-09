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

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for rate limiting and IP detection
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

// Rate limiting for link creation (45 requests per 15 minutes per IP)
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
// Must come after API routes so it doesn't intercept /api/...
app.get('/:code', (req, res, next) => {
  const code = req.params.code;
  
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

  // Check if code exists in links DB
  const link = getLinkByCode(code);
  if (link) {
    return handleSmartRedirect(req, res);
  }

  // Not a link code, pass to next (frontend router or 404)
  next();
});

// Production: Serve built Vite client files
const clientDistPath = path.resolve(__dirname, '../dist-client');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Start server after DB initialization
async function startServer() {
  try {
    await initDb();
    console.log('✅ SQLite Database successfully initialized and loaded.');

    app.listen(PORT, () => {
      console.log(`🚀 YouTube Smart Link Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
