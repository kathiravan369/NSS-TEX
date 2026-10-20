const PgModel = require('./PgModel');

const OilPurchase = new PgModel('oil_purchases', {
  date: { column: 'date', type: 'date' },
  dueDate: { column: 'due_date', type: 'date' },
  oilType: { column: 'oil_type', type: 'string' },
  supplier: { column: 'supplier', type: 'string' },
  qty: { column: 'qty', type: 'number' },
  unit: { column: 'unit', type: 'string' },
  rate: { column: 'rate', type: 'number' },
  cost: { column: 'cost', type: 'number' },
  includeGST: { column: 'include_gst', type: 'boolean' },
  gstRate: { column: 'gst_rate', type: 'number' },
  gst: { column: 'gst', type: 'number' },
  final: { column: 'final', type: 'number' },
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

module.exports = OilPurchase;
