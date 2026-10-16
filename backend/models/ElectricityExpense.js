const PgModel = require('./PgModel');

const ElectricityExpense = new PgModel('electricity_expenses', {
  month: { column: 'month', type: 'string' },
  billDate: { column: 'bill_date', type: 'date' },
  dueDate: { column: 'due_date', type: 'date' },
  prev: { column: 'prev', type: 'number' },
  curr: { column: 'curr', type: 'number' },
  units: { column: 'units', type: 'number' },
  rate: { column: 'rate', type: 'number' },
  fixed: { column: 'fixed', type: 'number' },
  additional: { column: 'additional', type: 'number' },
  total: { column: 'total', type: 'number' },
  paidAmount: { column: 'paid_amount', type: 'number' },
  balanceAmount: { column: 'balance_amount', type: 'number' },
  paidAt: { column: 'paid_at', type: 'date' },
  status: { column: 'status', type: 'string' },
  payDate: { column: 'pay_date', type: 'date' },
  notes: { column: 'notes', type: 'string' },
  createdAt: { column: 'created_at', type: 'date' },
  updatedAt: { column: 'updated_at', type: 'date' }
});

module.exports = ElectricityExpense;
