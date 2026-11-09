import { app } from './app.js';
import { initDb } from './db.js';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initDb();
    console.log('✅ Database successfully initialized.');

    app.listen(PORT, () => {
      console.log(`🚀 YouTube Smart Link Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
