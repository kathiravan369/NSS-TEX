const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');

// Load environment variables with fallback paths
require('dotenv').config({ path: path.join(__dirname, '.env') });
try {
  if (process.resourcesPath) {
    require('dotenv').config({ path: path.join(process.resourcesPath, 'backend', '.env') });
  }
} catch (e) {}
require('dotenv').config();

const {
  connectDB,
  closePools,
  isDbConnected,
  maskURI,
  businessMiddleware,
  setActiveBusiness,
  getActiveBusiness,
  getBusinessList,
  BUSINESS_CONFIG
} = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route Modules
const dashboardRoutes = require('./routes/dashboardRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const threadPurchaseRoutes = require('./routes/threadPurchaseRoutes');
const towelPurchaseRoutes = require('./routes/towelPurchaseRoutes');
const oilRoutes = require('./routes/oilRoutes');
const machineryRoutes = require('./routes/machineryRoutes');
const electricityRoutes = require('./routes/electricityRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const reportRoutes = require('./routes/reportRoutes');
const customerRoutes = require('./routes/customerRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const salesRoutes = require('./routes/salesRoutes');
const typeRoutes = require('./routes/typeRoutes');

const PORT = process.env.PORT || 5001;
const DB_PORT = process.env.PGPORT || 5000;

const app = express();

// Middlewares
app.use(cors({
  origin: (origin, callback) => {
    // Allow all local, Electron (file://, null), postman, and dev origins
    callback(null, true);
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Multi-Business Context Middleware
app.use(businessMiddleware);

// Multi-Business Management Endpoints
app.get('/api/businesses', (req, res) => {
  res.json({
    success: true,
    activeBusiness: getActiveBusiness(),
    businesses: getBusinessList()
  });
});

app.post('/api/businesses/select', (req, res) => {
  const { businessId } = req.body;
  if (!businessId || !BUSINESS_CONFIG[businessId]) {
    return res.status(400).json({
      success: false,
      error: `Invalid business ID: "${businessId}". Allowed: ${Object.keys(BUSINESS_CONFIG).join(', ')}`
    });
  }

  const updated = setActiveBusiness(businessId);
  res.json({
    success: true,
    message: `Active business switched to ${updated.name}`,
    activeBusiness: updated
  });
});

// Health Endpoint
app.get('/api/health', (req, res) => {
  const connected = isDbConnected();
  const currentBiz = getActiveBusiness();

  res.status(connected ? 200 : 503).json({
    success: true,
    status: connected ? 'HEALTHY' : 'DEGRADED',
    message: 'NSS TOWELS & KD TEXT Multi-Business ERP Backend (PostgreSQL)',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    activeBusiness: currentBiz,
    businesses: getBusinessList(),
    database: {
      type: 'PostgreSQL',
      status: connected ? 'connected' : 'disconnected',
      connected: connected,
      name: currentBiz.database,
      host: `${process.env.PGHOST || 'localhost'}:${DB_PORT}`
    }
  });
});

// Root API Directory
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to NSS TOWELS / KD TEXT ERP Backend REST API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      businesses: '/api/businesses',
      selectBusiness: 'POST /api/businesses/select',
      dashboard: '/api/dashboard/summary',
      dashboardExpenses: '/api/dashboard/expenses',
      dashboardRecent: '/api/dashboard/recent-transactions',
      employees: '/api/employees',
      threadPurchases: '/api/thread-purchases',
      towelPurchases: '/api/towel-purchases',
      oilPurchases: '/api/oil-purchases',
      oilStock: '/api/oil-purchases/stock',
      machinery: '/api/machinery-expenses',
      electricity: '/api/electricity-expenses',
      payrollWeekly: '/api/payroll/weekly',
      reportsSalaryMonthly: '/api/reports/salary/monthly',
      reportsSalaryEmployee: '/api/reports/salary/employee',
      reportsExpensesMonthly: '/api/reports/expenses/monthly'
    }
  });
});

// Mount Resource Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/thread-purchases', threadPurchaseRoutes);
app.use('/api/towel-purchases', towelPurchaseRoutes);
app.use('/api/oil-purchases', oilRoutes);
app.use('/api/oil-stock', (req, res, next) => {
  const { getOilStock } = require('./controllers/oilController');
  getOilStock(req, res, next);
});
app.use('/api/oil', oilRoutes);
app.use('/api/machinery-expenses', machineryRoutes);
app.use('/api/machinery', machineryRoutes);
app.use('/api/electricity-expenses', electricityRoutes);
app.use('/api/electricity', electricityRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sales/customers', customerRoutes);
app.use('/api/sales/invoices', invoiceRoutes);
app.use('/api/sales/reports', salesRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/types', typeRoutes);

// Centralized Error Handling
app.use(errorHandler);

let serverInstance = null;

async function startServer(port = PORT) {
  if (serverInstance) {
    console.log(`[Backend] Server is already running on port ${port}`);
    return serverInstance;
  }

  const effectivePort = port || PORT;
  const dbHost = process.env.PGHOST || 'localhost';
  const dbPort = process.env.PGPORT || 5000;

  console.log('---------------------------------------------------------');
  console.log('🚀 Initializing NSS TOWELS & KD TEXT Backend Server...');
  console.log(`📡 Port: ${effectivePort}`);
  console.log(`🔒 Database Server: PostgreSQL on ${dbHost}:${dbPort}`);
  console.log('---------------------------------------------------------');

  const connected = await connectDB();

  if (!connected) {
    console.warn('⚠️ Server running with one or more database connections degraded.');
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(effectivePort, '0.0.0.0', () => {
      serverInstance = server;
      console.log(`✨ NSS & KD TEXT Backend is running on http://localhost:${effectivePort}`);
      console.log(`🩺 Health check URL: http://localhost:${effectivePort}/api/health`);
      console.log('---------------------------------------------------------');
      resolve(server);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Backend] Port ${effectivePort} is already in use; assuming backend is active.`);
        resolve(null);
      } else {
        console.error('[Backend] Server listen error:', err);
        reject(err);
      }
    });
  });
}

async function stopServer() {
  if (serverInstance) {
    try {
      await new Promise((resolve) => serverInstance.close(resolve));
      console.log('[Backend] HTTP server closed gracefully.');
    } catch (err) {
      console.warn('[Backend] Error closing HTTP server:', err.message);
    }
    serverInstance = null;
  }
  await closePools();
}

if (require.main === module) {
  startServer();
}

app.startServer = startServer;
app.stopServer = stopServer;
app.app = app;

module.exports = app;
