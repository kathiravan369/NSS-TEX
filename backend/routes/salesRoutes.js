const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

router.get('/summary', salesController.getSalesSummary);
router.get('/customer-wise', salesController.getCustomerWiseSales);
router.get('/product-wise', salesController.getProductWiseSales);
router.get('/periodic', salesController.getPeriodicSalesReport);
router.get('/outstanding', salesController.getOutstandingPaymentsReport);
router.get('/gst', salesController.getGSTSummaryReport);
router.get('/reorder-reminders', salesController.getReorderRemindersReport);

module.exports = router;
