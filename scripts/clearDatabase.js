const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:Skathir%40123@localhost:5000/nss_towels'
});

async function clearAllPostgresData() {
  console.log('🧹 Clearing all PostgreSQL database tables and resetting sequences...');

  const res = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
  );

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
}

clearAllPostgresData().catch(err => {
  console.error('❌ Error clearing PostgreSQL database:', err.message);
  process.exit(1);
});
