import fs from 'fs';
import { initDb, getRecentLinks } from '../server/db.js';

async function verifyMigration() {
  console.log('=== TESTING NON-DESTRUCTIVE DATABASE MIGRATION ===');
  const backupPath = 'data/app.backup.db';
  const testPath = 'data/app.test-migration.db';

  if (!fs.existsSync(backupPath)) {
    throw new Error('Backup DB not found for migration test');
  }

  fs.copyFileSync(backupPath, testPath);

  let db: any = null;
  try {
    db = await initDb(testPath);
    const colsLinks = await db.execute('PRAGMA table_info(links);');
    const colsClicks = await db.execute('PRAGMA table_info(clicks);');
    const linkColNames = colsLinks.rows.map((r: any) => String(r.name));
    const clickColNames = colsClicks.rows.map((r: any) => String(r.name));

    console.log('Links columns:', linkColNames.join(', '));
    console.log('Clicks columns:', clickColNames.join(', '));

    if (!linkColNames.includes('platform') || !linkColNames.includes('content_id')) {
      throw new Error('Missing migrated columns on links table');
    }
    if (!clickColNames.includes('platform') || !clickColNames.includes('country')) {
      throw new Error('Missing migrated columns on clicks table');
    }

    const links = await getRecentLinks(10, db);
    console.log('Preserved existing rows count:', links.length);
    if (links.length === 0) {
      throw new Error('Existing rows were lost!');
    }
    for (const link of links) {
      if (link.platform !== 'youtube') {
        throw new Error(`Expected legacy link ${link.code} to default to youtube, got ${link.platform}`);
      }
    }
    console.log('Sample preserved row:', {
      code: links[0].code,
      platform: links[0].platform,
      title: links[0].title,
      clicks: links[0].click_count,
    });

    // Test idempotency: running initDb again must succeed without errors
    const db2 = await initDb(testPath);
    db2.close();
    console.log('Idempotent re-run succeeded!');
    console.log('=== MIGRATION TEST PASSED ===');
  } finally {
    try {
      db?.close();
    } catch {}
    if (fs.existsSync(testPath)) {
      try {
        fs.unlinkSync(testPath);
      } catch {}
    }
  }
}

verifyMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
