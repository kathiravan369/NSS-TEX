const PgModel = require('./PgModel');

const SalesPayment = new PgModel('sales_payments', {
  invoiceId: { column: 'invoice_id', type: 'number' },
  invoiceNo: { column: 'invoice_no', type: 'string' },
  customerId: { column: 'customer_id', type: 'number' },
  paymentDate: { column: 'payment_date', type: 'date' },
  amount: { column: 'amount', type: 'number' },
  paymentMode: { column: 'payment_mode', type: 'string' },
  reference: { column: 'reference', type: 'string' },
  notes: { column: 'notes', type: 'string' },
  createdAt: { column: 'created_at', type: 'date' }
});

module.exports = SalesPayment;
