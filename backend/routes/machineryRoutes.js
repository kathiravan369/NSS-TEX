const express = require('express');
const router = express.Router();
const {
  getMachineryExpenses,
  createMachineryExpense,
  updateMachineryExpense,
  deleteMachineryExpense
} = require('../controllers/machineryController');

router.route('/')
  .get(getMachineryExpenses)
  .post(createMachineryExpense);

router.route('/:id')
  .put(updateMachineryExpense)
  .delete(deleteMachineryExpense);

module.exports = router;
