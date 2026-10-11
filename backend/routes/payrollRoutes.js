const express = require('express');
const router = express.Router();
const {
  getWeeklyPayroll,
  createWeeklyPayroll,
  getWeeklyPayrollById,
  updateWeeklyPayroll,
  finalizePayroll,
  markPayrollPayment
} = require('../controllers/payrollController');

router.route('/weekly')
  .get(getWeeklyPayroll)
  .post(createWeeklyPayroll);

router.route('/weekly/:id')
  .get(getWeeklyPayrollById)
  .put(updateWeeklyPayroll);

router.patch('/weekly/:id/finalize', finalizePayroll);
router.patch('/weekly/:id/payment', markPayrollPayment);

module.exports = router;
