const express = require('express');
const router = express.Router();
const {
  getOilPurchases,
  createOilPurchase,
  updateOilPurchase,
  getOilStock
} = require('../controllers/oilController');

router.get('/stock', getOilStock);
router.get('/oil-stock', getOilStock);

router.route('/')
  .get(getOilPurchases)
  .post(createOilPurchase);

router.route('/:id')
  .put(updateOilPurchase);

module.exports = router;
