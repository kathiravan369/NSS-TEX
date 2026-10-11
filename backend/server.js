const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

const { connectDB, maskURI } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route Modules
const dashboardRoutes = require('./routes/dashboardRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const threadPurchaseRoutes = require('./routes/threadPurchaseRoutes');
const oilRoutes = require('./routes/oilRoutes');
const machineryRoutes = require('./routes/machineryRoutes');
const electricityRoutes = require('./routes/electricityRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const reportRoutes = require('./routes/reportRoutes');

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

const app = express();

// Middlewares
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health Endpoint
app.get('/api/health', (req, res) => {
  const dbStateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const dbState = mongoose.connection.readyState;
  const isDbConnected = dbState === 1;

  res.status(isDbConnected ? 200 : 503).json({
    success: true,
    status: isDbConnected ? 'HEALTHY' : 'DEGRADED',
    message: 'NSS TOWELS Manufacturing Management System API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    database: {
      status: dbStateMap[dbState] || 'unknown',
      connected: isDbConnected,
      name: mongoose.connection.name || 'nss_towels',
      host: mongoose.connection.host || 'Atlas Cluster'
    }
  });
});

// Root API Directory
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to NSS TOWELS / TexMan ERP Backend REST API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      dashboard: '/api/dashboard/summary',
      dashboardExpenses: '/api/dashboard/expenses',
      dashboardRecent: '/api/dashboard/recent-transactions',
      employees: '/api/employees',
      threadPurchases: '/api/thread-purchases',
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

// Centralized Error Handling
app.use(errorHandler);

async function startServer() {
  console.log('---------------------------------------------------------');
  console.log('🚀 Initializing NSS TOWELS Backend Server...');
  console.log(`📡 Port: ${PORT}`);
  console.log(`🔒 Database Target: ${maskURI(MONGODB_URI)}`);
  console.log('---------------------------------------------------------');

  const connected = await connectDB();

  if (!connected) {
    console.warn('⚠️ Server running in STANDBY mode with in-memory persistence.');
  }

  app.listen(PORT, () => {
    console.log(`✨ NSS TOWELS Backend is running on http://localhost:${PORT}`);
    console.log(`🩺 Health check URL: http://localhost:${PORT}/api/health`);
    console.log('---------------------------------------------------------');
  });
}

if (require.main === module) {
  startServer();
}

module.exports = app;
