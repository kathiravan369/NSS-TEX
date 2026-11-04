const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { query } = require('../backend/config/db');

async function clean() {
  await query("DELETE FROM employees WHERE name LIKE '%Test%' OR name LIKE '%Specialist%'", [], 'nss_text');
  await query("DELETE FROM employees WHERE name LIKE '%Test%' OR name LIKE '%Specialist%'", [], 'kd_text');
  console.log('Cleaned test employees from both DBs.');
  process.exit(0);
}
clean();
