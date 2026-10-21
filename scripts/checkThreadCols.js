require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { connectDB, getPool } = require('../backend/config/db');

async function check() {
  await connectDB();
  const pool = getPool();
  const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'thread_purchases' ORDER BY ordinal_position");
  console.log('Columns in thread_purchases:');
  res.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
