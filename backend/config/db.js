const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

let pool = null;
let isConnected = false;

// Shim mongoose.connection.readyState to dynamically reflect PostgreSQL connection
try {
  Object.defineProperty(mongoose.connection, 'readyState', {
    get: () => (isConnected ? 1 : 0),
    configurable: true
  });
} catch (e) {
  // Ignored if already defined
}

// Mask URI or credentials for logging
function maskURI(uri) {
  if (!uri) return '[UNDEFINED]';
  return uri.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
}

function getPoolConfig() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URI;
  if (connectionString) {
    return { connectionString };
  }

  return {
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'nss_towels',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 4000
  };
}

async function connectDB() {
  const config = getPoolConfig();

  try {
    pool = new Pool(config);

    // Test connection
    const client = await pool.connect();
    const res = await client.query('SELECT current_database(), current_user, version()');
    client.release();

    isConnected = true;
    const dbName = res.rows[0].current_database;
    const dbUser = res.rows[0].current_user;
    console.log(`✅ PostgreSQL Connected: Database "${dbName}" as user "${dbUser}" on port ${config.port || 'default'}`);

    // Automatically initialize/verify database tables from schema.sql
    await initSchema();

    return true;
  } catch (error) {
    isConnected = false;
    console.error(`❌ PostgreSQL Connection Error: ${error.message}`);
    console.error(`   Host: ${config.host || 'url'}, Port: ${config.port || 'default'}, Database: ${config.database || 'default'}`);
    return false;
  }
}

async function initSchema() {
  if (!pool) return;
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(sql);
      console.log('✅ PostgreSQL schema and tables verified/created successfully.');
    }
  } catch (err) {
    console.warn('⚠️ Warning verifying schema:', err.message);
  }
}

function getPool() {
  return pool;
}

function isDbConnected() {
  return isConnected && pool !== null;
}

async function query(text, params) {
  if (!pool) throw new Error('Database pool is not initialized');
  return pool.query(text, params);
}

module.exports = {
  connectDB,
  getPool,
  isDbConnected,
  query,
  maskURI
};
