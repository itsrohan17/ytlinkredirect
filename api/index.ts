import { app } from '../server/app.js';
import { initDb } from '../server/db.js';

let dbInitPromise: Promise<any> | null = null;

function ensureDb() {
  if (!dbInitPromise) {
    dbInitPromise = initDb().catch((err) => {
      console.error('❌ [Database Init Error]:', err);
      dbInitPromise = null;
      throw err;
    });
  }
  return dbInitPromise;
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return app(req, res);
  }

  try {
    await ensureDb();
  } catch (err: any) {
    console.error('❌ [Serverless Error] Database connection failure:', err);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({
        error: 'Database connection failed. Please ensure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are correctly configured.',
        details: err?.message || String(err),
      });
    }
  }

  // Wrap Express dispatch in a Promise so Vercel does not terminate before response completes
  return new Promise<void>((resolve, reject) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    res.on('error', (err: any) => {
      console.error('❌ [Response Error]:', err);
      reject(err);
    });

    try {
      app(req, res, (err: any) => {
        if (err) {
          console.error('❌ [Express Dispatch Error]:', err);
          if (!res.headersSent) {
            res.setHeader('Content-Type', 'application/json');
            res.status(500).json({ error: err.message || 'Internal server error' });
          }
          resolve();
        } else if (!res.headersSent) {
          res.setHeader('Content-Type', 'application/json');
          res.status(404).json({ error: `Not found: ${req.method} ${req.url}` });
          resolve();
        }
      });
    } catch (err: any) {
      console.error('❌ [Express Exception]:', err);
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ error: err.message || 'Internal server error' });
      }
      resolve();
    }
  });
}
