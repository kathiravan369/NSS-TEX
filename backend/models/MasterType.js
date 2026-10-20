const PgModel = require('./PgModel');

const MasterType = new PgModel('master_types', {
  category: { column: 'category', type: 'string' },
  name: { column: 'name', type: 'string' },
  code: { column: 'code', type: 'string' },
  description: { column: 'description', type: 'string' },
  extraData: { column: 'extra_data', type: 'json' },
  isActive: { column: 'is_active', type: 'boolean' },
  createdAt: { column: 'created_at', type: 'date' },
  updatedAt: { column: 'updated_at', type: 'date' }
});

module.exports = MasterType;
