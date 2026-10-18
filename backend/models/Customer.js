const PgModel = require('./PgModel');

const Customer = new PgModel('customers', {
  customerId: { column: 'customer_id', type: 'string' },
  name: { column: 'name', type: 'string' },
  customerType: { column: 'customer_type', type: 'string' },
  phone: { column: 'phone', type: 'string' },
  alternatePhone: { column: 'alternate_phone', type: 'string' },
  email: { column: 'email', type: 'string' },
  companyName: { column: 'company_name', type: 'string' },
  gstin: { column: 'gstin', type: 'string' },
  pan: { column: 'pan', type: 'string' },
  customerCategory: { column: 'customer_category', type: 'string' },
  billingAddress: { column: 'billing_address', type: 'json' },
  shippingAddress: { column: 'shipping_address', type: 'json' },
  sameAsBilling: { column: 'same_as_billing', type: 'boolean' },
  openingBalance: { column: 'opening_balance', type: 'number' },
  openingBalanceType: { column: 'opening_balance_type', type: 'string' },
  creditLimit: { column: 'credit_limit', type: 'number' },
  paymentTerms: { column: 'payment_terms', type: 'string' },
  priceList: { column: 'price_list', type: 'string' },
  notes: { column: 'notes', type: 'string' },
  tags: { column: 'tags', type: 'json' },
  status: { column: 'status', type: 'string' },
  createdAt: { column: 'created_at', type: 'date' },
  updatedAt: { column: 'updated_at', type: 'date' }
});

module.exports = Customer;
