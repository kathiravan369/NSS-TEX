const express = require('express');
const router = express.Router();
const {
  getTowelPurchases,
  getTowelPurchaseById,
  createTowelPurchase,
  updateTowelPurchase,
  deleteTowelPurchase
} = require('../controllers/towelPurchaseController');

router.route('/')
  .get(getTowelPurchases)
  .post(createTowelPurchase);

router.route('/:id')
  .get(getTowelPurchaseById)
  .put(updateTowelPurchase)
  .delete(deleteTowelPurchase);

module.exports = router;
