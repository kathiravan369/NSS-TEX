const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { query } = require('../backend/config/db');

async function checkMasterTypes() {
  console.log('--- NSS Text master_types ---');
  const nssRes = await query('SELECT * FROM master_types ORDER BY id', [], 'nss_text');
  console.log('NSS Text master_types count:', nssRes.rows.length);
  console.log(nssRes.rows);

  console.log('\n--- KD Text master_types ---');
  const kdRes = await query('SELECT * FROM master_types ORDER BY id', [], 'kd_text');
  console.log('KD Text master_types count:', kdRes.rows.length);
  console.log(kdRes.rows);

  process.exit(0);
}

checkMasterTypes();

