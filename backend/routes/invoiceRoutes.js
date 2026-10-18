const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');

router.get('/next-number', invoiceController.getNextInvoiceNo);
router.post('/calculate', invoiceController.calculateInvoiceTotals);
router.get('/', invoiceController.getInvoices);
router.get('/:id', invoiceController.getInvoiceById);
router.post('/', invoiceController.createInvoice);
router.put('/:id', invoiceController.updateInvoice);
router.post('/:id/payments', invoiceController.recordPayment);
router.patch('/:id/issue', invoiceController.issueInvoice);
router.delete('/:id', invoiceController.deleteInvoice);

module.exports = router;
