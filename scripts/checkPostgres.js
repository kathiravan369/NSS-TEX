const { Client } = require('pg');

async function checkDatabases() {
  const client = new Client({
    host: 'localhost',
    port: 5000,
    user: 'postgres',
    password: 'Skathir@123',
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully!');
    const res = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false;');
    console.log('Databases:', res.rows.map(r => r.datname));

    for (const row of res.rows) {
      const dbName = row.datname;
      const subClient = new Client({
        host: 'localhost',
        port: 5000,
        user: 'postgres',
        password: 'Skathir@123',
        database: dbName
      });
      try {
        await subClient.connect();
        const tablesRes = await subClient.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          ORDER BY table_name;
        `);
        console.log(`Database "${dbName}" has tables:`, tablesRes.rows.map(t => t.table_name));
        await subClient.end();
      } catch (err) {
        console.log(`Could not connect to database "${dbName}":`, err.message);
      }
    }

    await client.end();
  } catch (err) {
    console.error('Check databases error:', err.message);
  }
}

checkDatabases();
