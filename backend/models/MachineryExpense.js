const PgModel = require('./PgModel');

const MachineryExpense = new PgModel('machinery_expenses', {
  machine: { column: 'machine', type: 'string' },
  machineId: { column: 'machine_id', type: 'string' },
  date: { column: 'date', type: 'date' },
  dueDate: { column: 'due_date', type: 'date' },
  category: { column: 'category', type: 'string' },
  desc: { column: 'description', type: 'string' },
  qty: { column: 'qty', type: 'number' },
  unit: { column: 'unit', type: 'string' },
  cost: { column: 'cost', type: 'number' },
  subtotal: { column: 'subtotal', type: 'number' },
  includeGST: { column: 'include_gst', type: 'boolean' },
  gstRate: { column: 'gst_rate', type: 'number' },
  gst: { column: 'gst', type: 'number' },
  total: { column: 'total', type: 'number' },
  paidAmount: { column: 'paid_amount', type: 'number' },
  balanceAmount: { column: 'balance_amount', type: 'number' },
  paidAt: { column: 'paid_at', type: 'date' },
  vendor: { column: 'vendor', type: 'string' },
  invoiceNo: { column: 'invoice_no', type: 'string' },
  status: { column: 'status', type: 'string' },
  notes: { column: 'notes', type: 'string' },
  createdAt: { column: 'created_at', type: 'date' },
  updatedAt: { column: 'updated_at', type: 'date' }
});

module.exports = MachineryExpense;
