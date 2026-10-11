const express = require('express');
const router = express.Router();
const {
  getThreadPurchases,
  getThreadPurchaseById,
  createThreadPurchase,
  updateThreadPurchase,
  deleteThreadPurchase
} = require('../controllers/threadPurchaseController');

router.route('/')
  .get(getThreadPurchases)
  .post(createThreadPurchase);

router.route('/:id')
  .get(getThreadPurchaseById)
  .put(updateThreadPurchase)
  .delete(deleteThreadPurchase);

module.exports = router;
