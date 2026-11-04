const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:Skathir%40123@localhost:5000/nss_towels'
});

async function clearAllPostgresData() {
  console.log('📦 Starting pre-wipe data backup...');
  const res = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
  );

  const backupData = {};
  let totalExistingRows = 0;

  for (const row of res.rows) {
    const tableRes = await pool.query(`SELECT * FROM "${row.table_name}"`);
    backupData[row.table_name] = tableRes.rows;
    totalExistingRows += tableRes.rows.length;
  }

  const backupsDir = path.join(__dirname, '../backend/backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupsDir, `db_backup_pre_wipe_${timestamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`💾 Safety backup created: ${backupFile} (${totalExistingRows} total rows backed up)\n`);

  console.log('🧹 Clearing all PostgreSQL database tables and resetting sequences...');
  const tableNames = res.rows.map(r => `"${r.table_name}"`).join(', ');

  if (tableNames.length > 0) {
    await pool.query(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);
  }

  console.log('✅ All PostgreSQL tables truncated successfully.\n');
  console.log('📊 Current table counts:');
  for (const row of res.rows) {
    const countRes = await pool.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
    console.log(`  - ${row.table_name}: ${countRes.rows[0].count} rows`);
  }

  await pool.end();
  console.log('\n🎉 Database is now completely fresh and ready for live production!');
}

clearAllPostgresData().catch(err => {
  console.error('❌ Error clearing PostgreSQL database:', err.message);
  process.exit(1);
});
