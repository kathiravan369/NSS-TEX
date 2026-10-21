const PgModel = require('./PgModel');

const ThreadPurchase = new PgModel('thread_purchases', {
  date: { column: 'date', type: 'date' },
  dueDate: { column: 'due_date', type: 'date' },
  supplier: { column: 'supplier', type: 'string' },
  threadType: { column: 'thread_type', type: 'string' },
  qty: { column: 'qty', type: 'number' },
  unit: { column: 'unit', type: 'string' },
  rate: { column: 'rate', type: 'number' },
  gstMode: { column: 'gst_mode', type: 'string' },
  gstRate: { column: 'gst_rate', type: 'number' },
  subtotal: { column: 'subtotal', type: 'number' },
  gstAmount: { column: 'gst_amount', type: 'number' },
  total: { column: 'total', type: 'number' },
  paidAmount: { column: 'paid_amount', type: 'number' },
  balanceAmount: { column: 'balance_amount', type: 'number' },
  paidAt: { column: 'paid_at', type: 'date' },
  invoiceNo: { column: 'invoice_no', type: 'string' },
  status: { column: 'status', type: 'string' },
  notes: { column: 'notes', type: 'string' },
  items: { column: 'items', type: 'json' },
  createdAt: { column: 'created_at', type: 'date' },
  updatedAt: { column: 'updated_at', type: 'date' }
});

module.exports = ThreadPurchase;
