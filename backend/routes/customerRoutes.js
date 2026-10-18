const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

router.get('/next-id', customerController.getNextCustomerId);
router.get('/check-duplicate', customerController.checkDuplicate);
router.get('/', customerController.getCustomers);
router.get('/:id', customerController.getCustomerById);
router.post('/', customerController.createCustomer);
router.put('/:id', customerController.updateCustomer);
router.patch('/:id/status', customerController.patchCustomerStatus);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
