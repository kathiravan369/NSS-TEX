const mongoose = require('mongoose');
const { Customer, Invoice } = require('../models');
const { query } = require('../config/db');
const runtimeStore = require('../utils/runtimeStore');

// Helper to validate phone number format (standard 10 digits)
function isValidPhone(phone) {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-\+]/g, '');
  return /^\d{10,12}$/.test(cleaned);
}

// Helper to validate email format
function isValidEmail(email) {
  if (!email) return true; // Optional field
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Helper to validate GSTIN format (15 characters)
function isValidGSTIN(gstin) {
  if (!gstin) return true; // Optional field
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(gstin.trim());
}

// Helper to validate PAN format (10 characters)
function isValidPAN(pan) {
  if (!pan) return true; // Optional field
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(pan.trim());
}

// Helper to compute next sequential customer ID (e.g. CUS-001)
async function generateNextCustomerId() {
  const isDb = mongoose.connection.readyState === 1;
  if (isDb) {
    try {
      const res = await query(`
        SELECT customer_id FROM customers 
        WHERE customer_id ~ '^CUS-\\d+$'
        ORDER BY CAST(SUBSTRING(customer_id FROM 5) AS INTEGER) DESC 
        LIMIT 1
      `);
      if (res.rows.length > 0) {
        const lastId = res.rows[0].customer_id;
        const num = parseInt(lastId.replace('CUS-', ''), 10) || 0;
        return `CUS-${String(num + 1).padStart(3, '0')}`;
      }
      return 'CUS-001';
    } catch (e) {
      const count = await Customer.countDocuments();
      return `CUS-${String(count + 1).padStart(3, '0')}`;
    }
  }

  // Runtime store fallback
  const maxNum = runtimeStore.customers.reduce((max, c) => {
    const num = parseInt((c.customerId || '').replace(/\D/g, '') || '0', 10);
    return Math.max(max, num);
  }, 0);
  return `CUS-${String(maxNum + 1).padStart(3, '0')}`;
}

// @desc    Get all customers with search, filters & pagination
// @route   GET /api/sales/customers
// @access  Public
exports.getCustomers = async (req, res, next) => {
  try {
    const isDb = mongoose.connection.readyState === 1;
    const { search, customerType, status, page = 1, limit = 25 } = req.query;

    if (isDb) {
      const filter = {};

      if (search && search.trim()) {
        const s = search.trim();
        filter.$or = [
          { customerId: { $regex: s, $options: 'i' } },
          { name: { $regex: s, $options: 'i' } },
          { phone: { $regex: s, $options: 'i' } },
          { companyName: { $regex: s, $options: 'i' } },
          { gstin: { $regex: s, $options: 'i' } }
        ];
      }

      if (customerType && customerType !== 'All' && customerType !== 'All Types') {
        filter.customerType = customerType;
      }

      if (status && status !== 'All' && status !== 'All Status') {
        filter.status = status;
      }

      const total = await Customer.countDocuments(filter);
      const customers = await Customer.find(filter)
        .sort({ id: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit));

      return res.json({
        success: true,
        count: customers.length,
        total,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / limit) || 1
        },
        data: customers
      });
    }

    // Memory store fallback
    let filtered = [...runtimeStore.customers];
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      filtered = filtered.filter(c =>
        (c.customerId && c.customerId.toLowerCase().includes(s)) ||
        (c.name && c.name.toLowerCase().includes(s)) ||
        (c.phone && c.phone.includes(s)) ||
        (c.companyName && c.companyName.toLowerCase().includes(s)) ||
        (c.gstin && c.gstin.toLowerCase().includes(s))
      );
    }
    if (customerType && customerType !== 'All' && customerType !== 'All Types') {
      filtered = filtered.filter(c => c.customerType === customerType);
    }
    if (status && status !== 'All' && status !== 'All Status') {
      filtered = filtered.filter(c => c.status === status);
    }

    const total = filtered.length;
    const startIndex = (Number(page) - 1) * Number(limit);
    const paginated = filtered.slice(startIndex, startIndex + Number(limit));

    res.json({
      success: true,
      count: paginated.length,
      total,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit) || 1
      },
      data: paginated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get next available customer ID
// @route   GET /api/sales/customers/next-id
// @access  Public
exports.getNextCustomerId = async (req, res, next) => {
  try {
    const nextId = await generateNextCustomerId();
    res.json({ success: true, nextId });
  } catch (error) {
    next(error);
  }
};

// @desc    Check for duplicate customer (phone, email, GSTIN)
// @route   GET /api/sales/customers/check-duplicate
// @access  Public
exports.checkDuplicate = async (req, res, next) => {
  try {
    const { phone, email, gstin, excludeId } = req.query;
    const isDb = mongoose.connection.readyState === 1;

    let duplicateField = null;
    let existingCustomer = null;

    if (isDb) {
      if (phone && phone.trim()) {
        const queryText = excludeId
          ? 'SELECT * FROM customers WHERE phone = $1 AND id::text != $2 LIMIT 1'
          : 'SELECT * FROM customers WHERE phone = $1 LIMIT 1';
        const params = excludeId ? [phone.trim(), String(excludeId)] : [phone.trim()];
        const resSql = await query(queryText, params);
        if (resSql.rows.length > 0) {
          duplicateField = 'Phone Number';
          existingCustomer = Customer.rowToDoc(resSql.rows[0]);
        }
      }

      if (!existingCustomer && gstin && gstin.trim()) {
        const queryText = excludeId
          ? 'SELECT * FROM customers WHERE UPPER(gstin) = UPPER($1) AND id::text != $2 LIMIT 1'
          : 'SELECT * FROM customers WHERE UPPER(gstin) = UPPER($1) LIMIT 1';
        const params = excludeId ? [gstin.trim(), String(excludeId)] : [gstin.trim()];
        const resSql = await query(queryText, params);
        if (resSql.rows.length > 0) {
          duplicateField = 'GSTIN';
          existingCustomer = Customer.rowToDoc(resSql.rows[0]);
        }
      }

      if (!existingCustomer && email && email.trim()) {
        const queryText = excludeId
          ? 'SELECT * FROM customers WHERE LOWER(email) = LOWER($1) AND id::text != $2 LIMIT 1'
          : 'SELECT * FROM customers WHERE LOWER(email) = LOWER($1) LIMIT 1';
        const params = excludeId ? [email.trim(), String(excludeId)] : [email.trim()];
        const resSql = await query(queryText, params);
        if (resSql.rows.length > 0) {
          duplicateField = 'Email Address';
          existingCustomer = Customer.rowToDoc(resSql.rows[0]);
        }
      }
    } else {
      const list = runtimeStore.customers.filter(c => !excludeId || String(c.id) !== String(excludeId));
      if (phone && phone.trim()) {
        const found = list.find(c => c.phone === phone.trim());
        if (found) { duplicateField = 'Phone Number'; existingCustomer = found; }
      }
      if (!existingCustomer && gstin && gstin.trim()) {
        const found = list.find(c => (c.gstin || '').toUpperCase() === gstin.trim().toUpperCase());
        if (found) { duplicateField = 'GSTIN'; existingCustomer = found; }
      }
      if (!existingCustomer && email && email.trim()) {
        const found = list.find(c => (c.email || '').toLowerCase() === email.trim().toLowerCase());
        if (found) { duplicateField = 'Email Address'; existingCustomer = found; }
      }
    }

    res.json({
      success: true,
      isDuplicate: !!existingCustomer,
      duplicateField,
      existingCustomer: existingCustomer ? {
        id: existingCustomer.id,
        customerId: existingCustomer.customerId,
        name: existingCustomer.name,
        companyName: existingCustomer.companyName,
        phone: existingCustomer.phone,
        gstin: existingCustomer.gstin
      } : null
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single customer by ID with billing history summary
// @route   GET /api/sales/customers/:id
// @access  Public
exports.getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDb = mongoose.connection.readyState === 1;

    let customer = null;
    let customerInvoices = [];

    if (isDb) {
      customer = await Customer.findById(id);
      if (!customer) {
        // Try finding by customerId (e.g. CUS-001)
        customer = await Customer.findOne({ customerId: id });
      }

      if (customer) {
        // Load recent invoices
        customerInvoices = await Invoice.find({ customerId: customer.id })
          .sort({ id: -1 })
          .limit(50);
      }
    } else {
      customer = runtimeStore.customers.find(c => String(c.id) === String(id) || c.customerId === id);
      if (customer) {
        customerInvoices = runtimeStore.invoices.filter(inv => String(inv.customerId) === String(customer.id));
      }
    }

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Calculate aggregated metrics
    const totalInvoices = customerInvoices.length;
    const totalBilled = customerInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
    const totalPaid = customerInvoices.reduce((sum, inv) => sum + (Number(inv.amountPaid) || 0), 0);
    const outstandingBalance = Math.max(0, totalBilled - totalPaid);

    res.json({
      success: true,
      data: {
        ...customer,
        stats: {
          totalInvoices,
          totalBilled,
          totalPaid,
          outstandingBalance
        },
        invoices: customerInvoices
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new customer with validation & duplicate detection
// @route   POST /api/sales/customers
// @access  Public
exports.createCustomer = async (req, res, next) => {
  try {
    const {
      customerId,
      name,
      customerType = 'Business',
      phone,
      alternatePhone = '',
      email = '',
      companyName = '',
      gstin = '',
      pan = '',
      customerCategory = 'Regular',
      billingAddress = {},
      shippingAddress = {},
      sameAsBilling = true,
      openingBalance = 0,
      openingBalanceType = 'Debit',
      creditLimit = 0,
      paymentTerms = '30 Days',
      priceList = 'Standard',
      notes = '',
      tags = [],
      status = 'Active',
      force = false
    } = req.body;

    // 1. Mandatory Validations
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Customer name is required' });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid phone number (10-12 digits)' });
    }

    if (email && !isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
    }

    if (gstin && !isValidGSTIN(gstin)) {
      return res.status(400).json({ success: false, error: 'Invalid GSTIN format. Example: 33ABCDE1234F1Z5 (15 characters)' });
    }

    if (pan && !isValidPAN(pan)) {
      return res.status(400).json({ success: false, error: 'Invalid PAN format. Example: ABCDE1234F (10 characters)' });
    }

    // 2. Duplicate Detection
    const isDb = mongoose.connection.readyState === 1;
    if (!force) {
      let duplicateReason = null;
      if (isDb) {
        const phoneCheck = await query('SELECT customer_id, name FROM customers WHERE phone = $1 LIMIT 1', [phone.trim()]);
        if (phoneCheck.rows.length > 0) {
          duplicateReason = `Phone number ${phone} is already registered with customer "${phoneCheck.rows[0].name}" (${phoneCheck.rows[0].customer_id})`;
        } else if (gstin && gstin.trim()) {
          const gstinCheck = await query('SELECT customer_id, name FROM customers WHERE UPPER(gstin) = UPPER($1) LIMIT 1', [gstin.trim()]);
          if (gstinCheck.rows.length > 0) {
            duplicateReason = `GSTIN ${gstin.toUpperCase()} is already registered with customer "${gstinCheck.rows[0].name}" (${gstinCheck.rows[0].customer_id})`;
          }
        }
      } else {
        const found = runtimeStore.customers.find(c => c.phone === phone.trim() || (gstin && c.gstin && c.gstin.toUpperCase() === gstin.trim().toUpperCase()));
        if (found) {
          duplicateReason = `Customer with phone or GSTIN already exists: "${found.name}" (${found.customerId})`;
        }
      }

      if (duplicateReason) {
        return res.status(409).json({
          success: false,
          isDuplicate: true,
          error: duplicateReason,
          message: 'Potential duplicate customer detected. Please confirm to proceed.'
        });
      }
    }

    // 3. Resolve Customer ID
    let finalCustId = customerId && customerId.trim() ? customerId.trim() : await generateNextCustomerId();

    // 4. Resolve Addresses
    const resolvedBilling = typeof billingAddress === 'object' && billingAddress !== null ? billingAddress : {};
    const resolvedShipping = sameAsBilling
      ? { ...resolvedBilling }
      : (typeof shippingAddress === 'object' && shippingAddress !== null ? shippingAddress : {});

    const customerPayload = {
      customerId: finalCustId,
      name: name.trim(),
      customerType,
      phone: phone.trim(),
      alternatePhone: (alternatePhone || '').trim(),
      email: (email || '').trim().toLowerCase(),
      companyName: (companyName || '').trim(),
      gstin: (gstin || '').trim().toUpperCase(),
      pan: (pan || '').trim().toUpperCase(),
      customerCategory,
      billingAddress: resolvedBilling,
      shippingAddress: resolvedShipping,
      sameAsBilling: !!sameAsBilling,
      openingBalance: Number(openingBalance) || 0,
      openingBalanceType: openingBalanceType || 'Debit',
      creditLimit: Number(creditLimit) || 0,
      paymentTerms: paymentTerms || '30 Days',
      priceList: priceList || 'Standard',
      notes: (notes || '').trim(),
      tags: Array.isArray(tags) ? tags : [],
      status: status || 'Active'
    };

    if (isDb) {
      const created = await Customer.create(customerPayload);
      return res.status(201).json({ success: true, data: created });
    }

    const nextId = String(Date.now());
    const mockCreated = {
      id: nextId,
      _id: nextId,
      ...customerPayload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    runtimeStore.customers.unshift(mockCreated);
    res.status(201).json({ success: true, data: mockCreated });
  } catch (error) {
    if (error.code === '23505' || error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Customer with this ID or phone number already exists' });
    }
    next(error);
  }
};

// @desc    Update existing customer
// @route   PUT /api/sales/customers/:id
// @access  Public
exports.updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDb = mongoose.connection.readyState === 1;

    const {
      name,
      customerType,
      phone,
      alternatePhone,
      email,
      companyName,
      gstin,
      pan,
      customerCategory,
      billingAddress,
      shippingAddress,
      sameAsBilling,
      openingBalance,
      openingBalanceType,
      creditLimit,
      paymentTerms,
      priceList,
      notes,
      tags,
      status
    } = req.body;

    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ success: false, error: 'Customer name cannot be empty' });
    }

    if (phone !== undefined && !isValidPhone(phone)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid phone number (10-12 digits)' });
    }

    if (email && !isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
    }

    if (gstin && !isValidGSTIN(gstin)) {
      return res.status(400).json({ success: false, error: 'Invalid GSTIN format' });
    }

    if (pan && !isValidPAN(pan)) {
      return res.status(400).json({ success: false, error: 'Invalid PAN format' });
    }

    const resolvedShipping = sameAsBilling
      ? { ...(billingAddress || {}) }
      : shippingAddress;

    const updatePayload = {
      ...(name !== undefined && { name: name.trim() }),
      ...(customerType !== undefined && { customerType }),
      ...(phone !== undefined && { phone: phone.trim() }),
      ...(alternatePhone !== undefined && { alternatePhone: alternatePhone.trim() }),
      ...(email !== undefined && { email: email.trim().toLowerCase() }),
      ...(companyName !== undefined && { companyName: companyName.trim() }),
      ...(gstin !== undefined && { gstin: gstin.trim().toUpperCase() }),
      ...(pan !== undefined && { pan: pan.trim().toUpperCase() }),
      ...(customerCategory !== undefined && { customerCategory }),
      ...(billingAddress !== undefined && { billingAddress }),
      ...(resolvedShipping !== undefined && { shippingAddress: resolvedShipping }),
      ...(sameAsBilling !== undefined && { sameAsBilling: !!sameAsBilling }),
      ...(openingBalance !== undefined && { openingBalance: Number(openingBalance) || 0 }),
      ...(openingBalanceType !== undefined && { openingBalanceType }),
      ...(creditLimit !== undefined && { creditLimit: Number(creditLimit) || 0 }),
      ...(paymentTerms !== undefined && { paymentTerms }),
      ...(priceList !== undefined && { priceList }),
      ...(notes !== undefined && { notes: notes.trim() }),
      ...(tags !== undefined && { tags: Array.isArray(tags) ? tags : [] }),
      ...(status !== undefined && { status })
    };

    if (isDb) {
      const updated = await Customer.findByIdAndUpdate(id, updatePayload, { new: true });
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Customer not found' });
      }
      return res.json({ success: true, data: updated });
    }

    const index = runtimeStore.customers.findIndex(c => String(c.id) === String(id) || c.customerId === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    runtimeStore.customers[index] = {
      ...runtimeStore.customers[index],
      ...updatePayload,
      updatedAt: new Date().toISOString()
    };

    res.json({ success: true, data: runtimeStore.customers[index] });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle customer active/inactive status
// @route   PATCH /api/sales/customers/:id/status
// @access  Public
exports.patchCustomerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['Active', 'Inactive'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Valid status (Active/Inactive) is required' });
    }

    const isDb = mongoose.connection.readyState === 1;
    if (isDb) {
      const updated = await Customer.findByIdAndUpdate(id, { status }, { new: true });
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Customer not found' });
      }
      return res.json({ success: true, data: updated });
    }

    const cust = runtimeStore.customers.find(c => String(c.id) === String(id) || c.customerId === id);
    if (!cust) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    cust.status = status;
    cust.updatedAt = new Date().toISOString();
    res.json({ success: true, data: cust });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete customer (preserves historical invoices)
// @route   DELETE /api/sales/customers/:id
// @access  Public
exports.deleteCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDb = mongoose.connection.readyState === 1;

    // Check if customer has associated invoices
    if (isDb) {
      const checkInvoices = await query(
        'SELECT COUNT(*) as count FROM invoices WHERE customer_id::text = $1',
        [String(id)]
      );
      const invoiceCount = Number(checkInvoices.rows[0]?.count || 0);

      if (invoiceCount > 0) {
        // Soft delete / mark inactive so historical legal invoices are never orphaned
        await Customer.findByIdAndUpdate(id, { status: 'Inactive' });
        return res.json({
          success: true,
          message: `Customer marked Inactive instead of deleting, preserving ${invoiceCount} historical invoice(s).`
        });
      }

      const deleted = await Customer.findByIdAndDelete(id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Customer not found' });
      }
      return res.json({ success: true, message: 'Customer deleted successfully' });
    }

    const hasInvoices = runtimeStore.invoices.some(inv => String(inv.customerId) === String(id));
    if (hasInvoices) {
      const cust = runtimeStore.customers.find(c => String(c.id) === String(id));
      if (cust) cust.status = 'Inactive';
      return res.json({
        success: true,
        message: 'Customer marked Inactive to preserve historical invoices.'
      });
    }

    runtimeStore.customers = runtimeStore.customers.filter(c => String(c.id) !== String(id));
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    next(error);
  }
};
