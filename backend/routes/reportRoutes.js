const express = require('express');
const router = express.Router();
const {
  getMonthlySalaryReport,
  getEmployeeSalaryReport,
  getMonthlyExpenseReport
} = require('../controllers/reportController');

router.get('/salary/monthly', getMonthlySalaryReport);
router.get('/salary/employee', getEmployeeSalaryReport);
router.get('/expenses/monthly', getMonthlyExpenseReport);

module.exports = router;
