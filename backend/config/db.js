const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { AsyncLocalStorage } = require('async_hooks');

const businessStorage = new AsyncLocalStorage();

// Multi-Business PostgreSQL Configuration Registry
const BUSINESS_CONFIG = {
  nss_text: {
    id: 'nss_text',
    name: 'NSS Text',
    database: process.env.NSS_TEXT_DB || process.env.PGDATABASE || 'nss_towels',
    description: 'NSS Textiles ERP',
    badge: 'nss_towels'
  },
  kd_text: {
    id: 'kd_text',
    name: 'KD Text',
    database: process.env.KD_TEXT_DB || 'KD Text',
    description: 'KD Textiles ERP',
    badge: 'KD Text database'
  }
};

let activeBusinessId = 'nss_text';
const pools = new Map();
const connectionStatus = new Map();

// Shim mongoose.connection.readyState to dynamically reflect PostgreSQL connection
try {
  Object.defineProperty(mongoose.connection, 'readyState', {
    get: () => (isDbConnected() ? 1 : 0),
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

/**
 * Returns connection configuration for a specific business
 */
function getPoolConfigForBusiness(bizId) {
  const biz = BUSINESS_CONFIG[bizId] || BUSINESS_CONFIG.nss_text;

  return {
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5000,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: biz.database,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  };
}

/**
 * Creates or gets an existing pool for a specific business
 */
function getOrCreatePool(bizId) {
  const normalizedId = BUSINESS_CONFIG[bizId] ? bizId : 'nss_text';
  if (pools.has(normalizedId)) {
    return pools.get(normalizedId);
  }

  const config = getPoolConfigForBusiness(normalizedId);
  const pool = new Pool(config);

  pool.on('error', (err) => {
    console.error(`[PostgreSQL Pool Error - ${normalizedId}]:`, err.message);
    connectionStatus.set(normalizedId, false);
  });

  pools.set(normalizedId, pool);
  return pool;
}

/**
 * Resolves current business ID from:
 * 1. Explicit parameter
 * 2. AsyncLocalStorage (request context)
 * 3. Module-level activeBusinessId
 */
function resolveCurrentBusinessId(explicitId) {
  if (explicitId && BUSINESS_CONFIG[explicitId]) {
    return explicitId;
  }
  const store = businessStorage.getStore();
  if (store && store.businessId && BUSINESS_CONFIG[store.businessId]) {
    return store.businessId;
  }
  return activeBusinessId;
}

/**
 * Primary method called by models and controllers to obtain PostgreSQL connection pool
 */
function getPool(targetBusinessId) {
  const bizId = resolveCurrentBusinessId(targetBusinessId);
  return getOrCreatePool(bizId);
}

/**
 * Check if database is connected for a given or current business
 */
function isDbConnected(targetBusinessId) {
  const bizId = resolveCurrentBusinessId(targetBusinessId);
  return connectionStatus.get(bizId) === true && pools.has(bizId);
}

/**
 * Automatically initialize/verify database tables from schema.sql for a given business
 */
async function initSchema(bizId) {
  const pool = getOrCreatePool(bizId);
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(sql);
      console.log(`✅ [${BUSINESS_CONFIG[bizId].name}] Schema and tables verified/created successfully.`);
    }
  } catch (err) {
    console.warn(`⚠️ Warning verifying schema for [${BUSINESS_CONFIG[bizId]?.name || bizId}]:`, err.message);
  }
}

/**
 * Connect and verify all configured business databases on startup
 */
async function connectDB() {
  let allConnected = true;

  for (const [bizId, config] of Object.entries(BUSINESS_CONFIG)) {
    const poolConfig = getPoolConfigForBusiness(bizId);
    try {
      const pool = getOrCreatePool(bizId);
      const client = await pool.connect();
      const res = await client.query('SELECT current_database(), current_user, version()');
      client.release();

      connectionStatus.set(bizId, true);
      const dbName = res.rows[0].current_database;
      const dbUser = res.rows[0].current_user;
      console.log(`✅ [${config.name}] PostgreSQL Connected: Database "${dbName}" as user "${dbUser}" on port ${poolConfig.port}`);

      // Verify schema and create tables if not existing
      await initSchema(bizId);
    } catch (error) {
      allConnected = false;
      connectionStatus.set(bizId, false);
      console.error(`❌ [${config.name}] PostgreSQL Connection Error: ${error.message}`);
      console.error(`   Host: ${poolConfig.host}, Port: ${poolConfig.port}, Database: "${config.database}"`);
    }
  }

  return allConnected;
}

/**
 * Express middleware to isolate and bind business context per HTTP request
 */
function businessMiddleware(req, res, next) {
  const headerId = req.headers['x-business-id'];
  const queryId = req.query.business || req.query.businessId;

  let resolvedId = activeBusinessId;
  if (headerId && BUSINESS_CONFIG[headerId]) {
    resolvedId = headerId;
  } else if (queryId && BUSINESS_CONFIG[queryId]) {
    resolvedId = queryId;
  }

  // Stamp response header so frontend can verify active business
  res.setHeader('X-Business-Id', resolvedId);
  res.setHeader('X-Business-Name', BUSINESS_CONFIG[resolvedId].name);

  businessStorage.run({ businessId: resolvedId }, () => {
    next();
  });
}

/**
 * Direct query helper supporting request-bound or explicit business database
 */
async function query(text, params, targetBusinessId) {
  const pool = getPool(targetBusinessId);
  if (!pool) throw new Error('Database pool is not initialized');
  return pool.query(text, params);
}

/**
 * Change the active business default on the server
 */
function setActiveBusiness(bizId) {
  if (!BUSINESS_CONFIG[bizId]) {
    throw new Error(`Invalid business ID: ${bizId}. Available: ${Object.keys(BUSINESS_CONFIG).join(', ')}`);
  }
  activeBusinessId = bizId;
  return BUSINESS_CONFIG[bizId];
}

function getActiveBusiness() {
  return BUSINESS_CONFIG[activeBusinessId];
}

function getBusinessList() {
  return Object.values(BUSINESS_CONFIG).map(b => ({
    id: b.id,
    name: b.name,
    description: b.description,
    badge: b.badge,
    isConnected: connectionStatus.get(b.id) === true
  }));
}

module.exports = {
  connectDB,
  getPool,
  isDbConnected,
  query,
  maskURI,
  businessMiddleware,
  setActiveBusiness,
  getActiveBusiness,
  getBusinessList,
  BUSINESS_CONFIG
};
