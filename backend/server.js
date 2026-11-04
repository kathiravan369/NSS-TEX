const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

const {
  connectDB,
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
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5000', 'http://localhost:5001'],
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

async function startServer() {
  console.log('---------------------------------------------------------');
  console.log('🚀 Initializing NSS TOWELS & KD TEXT Backend Server...');
  console.log(`📡 Port: ${PORT}`);
  console.log(`🔒 Database Server: PostgreSQL on ${process.env.PGHOST || 'localhost'}:${DB_PORT}`);
  console.log('---------------------------------------------------------');

  const connected = await connectDB();

  if (!connected) {
    console.warn('⚠️ Server running with one or more database connections degraded.');
  }

  app.listen(PORT, () => {
    console.log(`✨ NSS & KD TEXT Backend is running on http://localhost:${PORT}`);
    console.log(`🩺 Health check URL: http://localhost:${PORT}/api/health`);
    console.log('---------------------------------------------------------');
  });
}

if (require.main === module) {
  startServer();
}

module.exports = app;
