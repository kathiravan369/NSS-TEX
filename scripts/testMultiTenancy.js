const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { connectDB, getPool, query, getBusinessList, setActiveBusiness, getActiveBusiness } = require('../backend/config/db');

async function testMultiTenancy() {
  console.log('Testing connectDB()...');
  await connectDB();

  console.log('Business List:', getBusinessList());

  // Test 1: Query NSS Text
  console.log('\n--- Query NSS Text ---');
  const nssRes = await query('SELECT current_database(), COUNT(*) as emp_count FROM employees', [], 'nss_text');
  console.log('NSS Text DB:', nssRes.rows[0]);

  // Test 2: Query KD Text
  console.log('\n--- Query KD Text ---');
  const kdRes = await query('SELECT current_database(), COUNT(*) as emp_count FROM employees', [], 'kd_text');
  console.log('KD Text DB:', kdRes.rows[0]);

  console.log('\nMulti-tenancy test PASSED!');
  process.exit(0);
}

testMultiTenancy();
