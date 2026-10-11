const express = require('express');
const router = express.Router();
const {
  getElectricityExpenses,
  createElectricityExpense,
  updateElectricityExpense,
  deleteElectricityExpense
} = require('../controllers/electricityController');

router.route('/')
  .get(getElectricityExpenses)
  .post(createElectricityExpense);

router.route('/:id')
  .put(updateElectricityExpense)
  .delete(deleteElectricityExpense);

module.exports = router;
