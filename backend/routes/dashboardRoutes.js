const express = require('express');
const router = express.Router();
const {
  getDashboardSummary,
  getDashboardExpenses,
  getRecentTransactions
} = require('../controllers/dashboardController');

router.get('/summary', getDashboardSummary);
router.get('/expenses', getDashboardExpenses);
router.get('/recent-transactions', getRecentTransactions);

module.exports = router;
