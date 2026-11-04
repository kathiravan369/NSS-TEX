const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function initKdTextSchema() {
  const client = new Client({
    host: 'localhost',
    port: 5000,
    user: 'postgres',
    password: 'Skathir@123',
    database: 'KD Text'
  });

  try {
    await client.connect();
    console.log('Connected to "KD Text" database successfully!');
    const schemaSql = fs.readFileSync(path.join(__dirname, '../backend/config/schema.sql'), 'utf8');
    await client.query(schemaSql);
    console.log('Applied schema.sql to "KD Text" successfully!');

    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('"KD Text" tables now:', res.rows.map(r => r.table_name));

    await client.end();
  } catch (err) {
    console.error('Error applying schema to "KD Text":', err.message);
  }
}

initKdTextSchema();

