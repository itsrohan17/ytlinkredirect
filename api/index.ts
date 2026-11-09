import { app } from '../server/app.js';
import { initDb } from '../server/db.js';

let isDbInitialized = false;

export default async function handler(req: any, res: any) {
  if (!isDbInitialized) {
    try {
      await initDb();
      isDbInitialized = true;
    } catch (err) {
      console.error('Failed to initialize database in serverless function:', err);
    }
  }
  return app(req, res);
}
