const PgModel = require('./PgModel');

const OilStock = new PgModel('oil_stock', {
  type: { column: 'type', type: 'string' },
  stock: { column: 'stock', type: 'number' },
  unit: { column: 'unit', type: 'string' },
  lowStockThreshold: { column: 'low_stock_threshold', type: 'number' },
  isLow: { column: 'is_low', type: 'boolean' },
  createdAt: { column: 'created_at', type: 'date' },
  updatedAt: { column: 'updated_at', type: 'date' }
});

module.exports = OilStock;
