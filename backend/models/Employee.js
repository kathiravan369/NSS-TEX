const PgModel = require('./PgModel');

const Employee = new PgModel('employees', {
  empId: { column: 'emp_id', type: 'string' },
  name: { column: 'name', type: 'string' },
  phone: { column: 'phone', type: 'string' },
  joinDate: { column: 'join_date', type: 'date' },
  workType: { column: 'work_type', type: 'string' },
  workTypes: { column: 'work_types', type: 'json' },
  dailyRate: { column: 'daily_rate', type: 'number' },
  pieceRate: { column: 'piece_rate', type: 'number' },
  productType: { column: 'product_type', type: 'string' },
  sizeRates: { column: 'size_rates', type: 'json' },
  status: { column: 'status', type: 'string' },
  notes: { column: 'notes', type: 'string' },
  createdAt: { column: 'created_at', type: 'date' },
  updatedAt: { column: 'updated_at', type: 'date' }
});

module.exports = Employee;
