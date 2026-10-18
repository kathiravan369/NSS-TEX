const mongoose = require('mongoose');
const { Invoice, Customer, SalesPayment } = require('../models');
const { query } = require('../config/db');
const runtimeStore = require('../utils/runtimeStore');

// Decimal rounding helper to prevent IEEE floating point inaccuracies
function round2(val) {
  const num = Number(val) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// Check if location is intra-state (Tamil Nadu, state code 33)
function isIntraState(customerSnapshot = {}, shippingAddress = {}) {
  const state = (shippingAddress?.state || customerSnapshot?.billingAddress?.state || customerSnapshot?.state || '').toLowerCase();
  const gstin = (customerSnapshot?.gstin || '').trim();

  if (gstin && gstin.startsWith('33')) return true;
  if (state.includes('tamil') || state.includes('tamil nadu') || state === 'tn') return true;
  if (!state && !gstin) return true; // Default to intra-state
  return false;
}

// Safe calculation of invoice totals
function computeInvoiceTotals(items = [], extraDiscount = 0, isIntra = true) {
  let subtotal = 0;
  let itemDiscount = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  let processedItems = [];

  for (const item of items) {
    const qty = Number(item.quantity || item.qty || 1);
    const rate = Number(item.rate || item.price || 0);
    const discount = Number(item.discount || 0);
    const gstRate = Number(item.gstRate !== undefined ? item.gstRate : 5);

    const lineGross = round2(qty * rate);
    const lineDiscount = Math.min(lineGross, round2(discount));
    const lineTaxable = Math.max(0, round2(lineGross - lineDiscount));

    let lineCgst = 0;
    let lineSgst = 0;
    let lineIgst = 0;

    if (isIntra) {
      lineCgst = round2(lineTaxable * (gstRate / 200));
      lineSgst = round2(lineTaxable * (gstRate / 200));
    } else {
      lineIgst = round2(lineTaxable * (gstRate / 100));
    }

    const lineTotal = round2(lineTaxable + lineCgst + lineSgst + lineIgst);

    subtotal = round2(subtotal + lineGross);
    itemDiscount = round2(itemDiscount + lineDiscount);
    cgstTotal = round2(cgstTotal + lineCgst);
    sgstTotal = round2(sgstTotal + lineSgst);
    igstTotal = round2(igstTotal + lineIgst);

    processedItems.push({
      ...item,
      quantity: qty,
      rate,
      discount: lineDiscount,
      gstRate,
      taxableAmount: lineTaxable,
      cgst: lineCgst,
      sgst: lineSgst,
      igst: lineIgst,
      total: lineTotal
    });
  }

  const invoiceExtraDiscount = Math.min(round2(subtotal - itemDiscount), Number(extraDiscount) || 0);
  const taxableAmount = Math.max(0, round2(subtotal - itemDiscount - invoiceExtraDiscount));

  // If extra discount applies, prorate GST or calculate proportionally
  const discountRatio = (subtotal - itemDiscount) > 0 ? taxableAmount / (subtotal - itemDiscount) : 1;
  const finalCgst = round2(cgstTotal * discountRatio);
  const finalSgst = round2(sgstTotal * discountRatio);
  const finalIgst = round2(igstTotal * discountRatio);
  const gstAmount = round2(finalCgst + finalSgst + finalIgst);

  const rawTotal = round2(taxableAmount + gstAmount);
  const grandTotal = Math.round(rawTotal);
  const roundOff = round2(grandTotal - rawTotal);

  return {
    items: processedItems,
    subtotal,
    itemDiscount,
    extraDiscount: invoiceExtraDiscount,
    taxableAmount,
    cgstAmount: finalCgst,
    sgstAmount: finalSgst,
    igstAmount: finalIgst,
    gstAmount,
    roundOff,
    grandTotal
  };
}

// Generate sequential invoice number (e.g. INV-2026-0001)
async function generateNextInvoiceNumber() {
  const currentYear = new Date().getFullYear();
  const isDb = mongoose.connection.readyState === 1;

  if (isDb) {
    try {
      const res = await query(`
        SELECT invoice_no FROM invoices 
        WHERE invoice_no ~ '^INV-${currentYear}-\\d+$'
        ORDER BY CAST(SUBSTRING(invoice_no FROM 10) AS INTEGER) DESC 
        LIMIT 1
      `);
      if (res.rows.length > 0) {
        const lastNo = res.rows[0].invoice_no;
        const num = parseInt(lastNo.split('-')[2], 10) || 0;
        return `INV-${currentYear}-${String(num + 1).padStart(4, '0')}`;
      }
      return `INV-${currentYear}-0001`;
    } catch (e) {
      const count = await Invoice.countDocuments();
      return `INV-${currentYear}-${String(count + 1).padStart(4, '0')}`;
    }
  }

  // Fallback
  const matching = runtimeStore.invoices.filter(i => (i.invoiceNo || '').startsWith(`INV-${currentYear}-`));
  const maxNum = matching.reduce((max, i) => {
    const num = parseInt((i.invoiceNo || '').split('-')[2] || '0', 10);
    return Math.max(max, num);
  }, 0);
  return `INV-${currentYear}-${String(maxNum + 1).padStart(4, '0')}`;
}

// @desc    Calculate invoice totals in real-time
// @route   POST /api/sales/invoices/calculate
// @access  Public
exports.calculateInvoiceTotals = async (req, res, next) => {
  try {
    const { items = [], extraDiscount = 0, shippingAddress = {}, customerSnapshot = {} } = req.body;
    const isIntra = isIntraState(customerSnapshot, shippingAddress);
    const calculations = computeInvoiceTotals(items, extraDiscount, isIntra);
    res.json({ success: true, isIntraState: isIntra, ...calculations });
  } catch (error) {
    next(error);
  }
};

// @desc    Get next invoice number
// @route   GET /api/sales/invoices/next-number
// @access  Public
exports.getNextInvoiceNo = async (req, res, next) => {
  try {
    const nextNumber = await generateNextInvoiceNumber();
    res.json({ success: true, nextNumber });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all invoices with filtering, sorting and pagination
// @route   GET /api/sales/invoices
// @access  Public
exports.getInvoices = async (req, res, next) => {
  try {
    const {
      search,
      customerId,
      invoiceStatus,
      paymentStatus,
      startDate,
      endDate,
      page = 1,
      limit = 25
    } = req.query;

    const isDb = mongoose.connection.readyState === 1;

    if (isDb) {
      const filter = {};

      if (search && search.trim()) {
        const s = search.trim();
        filter.$or = [
          { invoiceNo: { $regex: s, $options: 'i' } },
          { customerName: { $regex: s, $options: 'i' } },
          { referenceNo: { $regex: s, $options: 'i' } },
          { poNumber: { $regex: s, $options: 'i' } }
        ];
      }

      if (customerId && customerId !== 'All' && customerId !== 'All Customers') {
        filter.customerId = Number(customerId);
      }

      if (invoiceStatus && invoiceStatus !== 'All' && invoiceStatus !== 'All Status') {
        filter.invoiceStatus = invoiceStatus;
      }

      if (paymentStatus && paymentStatus !== 'All' && paymentStatus !== 'All Payment Status') {
        filter.paymentStatus = paymentStatus;
      }

      if (startDate) {
        filter.invoiceDate = filter.invoiceDate || {};
        filter.invoiceDate.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.invoiceDate = filter.invoiceDate || {};
        filter.invoiceDate.$lte = new Date(endDate);
      }

      const total = await Invoice.countDocuments(filter);
      const invoices = await Invoice.find(filter)
        .sort({ id: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit));

      return res.json({
        success: true,
        count: invoices.length,
        total,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / limit) || 1
        },
        data: invoices
      });
    }

    // Memory fallback
    let list = [...runtimeStore.invoices];
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(i =>
        (i.invoiceNo && i.invoiceNo.toLowerCase().includes(s)) ||
        (i.customerName && i.customerName.toLowerCase().includes(s)) ||
        (i.referenceNo && i.referenceNo.toLowerCase().includes(s))
      );
    }
    if (customerId && customerId !== 'All' && customerId !== 'All Customers') {
      list = list.filter(i => String(i.customerId) === String(customerId));
    }
    if (invoiceStatus && invoiceStatus !== 'All' && invoiceStatus !== 'All Status') {
      list = list.filter(i => i.invoiceStatus === invoiceStatus);
    }
    if (paymentStatus && paymentStatus !== 'All' && paymentStatus !== 'All Payment Status') {
      list = list.filter(i => i.paymentStatus === paymentStatus);
    }
    if (startDate) {
      list = list.filter(i => new Date(i.invoiceDate) >= new Date(startDate));
    }
    if (endDate) {
      list = list.filter(i => new Date(i.invoiceDate) <= new Date(endDate));
    }

    const total = list.length;
    const startIndex = (Number(page) - 1) * Number(limit);
    const paginated = list.slice(startIndex, startIndex + Number(limit));

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

// @desc    Get single invoice by ID
// @route   GET /api/sales/invoices/:id
// @access  Public
exports.getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDb = mongoose.connection.readyState === 1;

    let invoice = null;

    if (isDb) {
      invoice = await Invoice.findById(id);
      if (!invoice) {
        invoice = await Invoice.findOne({ invoiceNo: id });
      }
    } else {
      invoice = runtimeStore.invoices.find(i => String(i.id) === String(id) || i.invoiceNo === id);
    }

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new invoice (Draft or Issued)
// @route   POST /api/sales/invoices
// @access  Public
exports.createInvoice = async (req, res, next) => {
  try {
    const {
      invoiceNo,
      invoiceDate = new Date().toISOString().split('T')[0],
      dueDate,
      referenceNo = '',
      customerId,
      customerSnapshot = {},
      vehicleNo = '',
      poNumber = '',
      challanNo = '',
      deliveryDate,
      salesperson = '',
      dispatchNo = '',
      items = [],
      extraDiscount = 0,
      initialPayment = 0,
      paymentMode = 'Bank Transfer',
      paymentReference = '',
      invoiceStatus = 'Issued', // 'Draft' or 'Issued'
      notes = '',
      terms = '',
      bankDetails = {}
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, error: 'Invoice must contain at least one line item' });
    }

    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      if (!it.productName || !it.productName.trim()) {
        return res.status(400).json({ success: false, error: `Product name is required for row ${idx + 1}` });
      }
      if (Number(it.quantity || 0) <= 0) {
        return res.status(400).json({ success: false, error: `Quantity must be greater than zero for row ${idx + 1}` });
      }
      if (Number(it.rate || 0) < 0) {
        return res.status(400).json({ success: false, error: `Rate cannot be negative for row ${idx + 1}` });
      }
    }

    const isDb = mongoose.connection.readyState === 1;

    // Resolve Customer Details snapshot
    let resolvedCustomer = customerSnapshot;
    let customerCode = resolvedCustomer.customerId || '';
    let customerName = resolvedCustomer.name || '';

    if (customerId && isDb && (!resolvedCustomer.name || !resolvedCustomer.phone)) {
      const dbCust = await Customer.findById(customerId);
      if (dbCust) {
        resolvedCustomer = {
          id: dbCust.id,
          customerId: dbCust.customerId,
          name: dbCust.name,
          companyName: dbCust.companyName,
          phone: dbCust.phone,
          email: dbCust.email,
          gstin: dbCust.gstin,
          pan: dbCust.pan,
          billingAddress: dbCust.billingAddress,
          shippingAddress: dbCust.shippingAddress
        };
        customerCode = dbCust.customerId;
        customerName = dbCust.name;
      }
    }

    // Determine Intra/Inter state GST
    const isIntra = isIntraState(resolvedCustomer, resolvedCustomer.shippingAddress);
    const totals = computeInvoiceTotals(items, extraDiscount, isIntra);

    // Initial Payment calculation
    const paidAmount = Math.max(0, Math.min(totals.grandTotal, Number(initialPayment) || 0));
    const balanceDue = Math.max(0, round2(totals.grandTotal - paidAmount));

    let paymentStatus = 'Unpaid';
    if (paidAmount >= totals.grandTotal && totals.grandTotal > 0) {
      paymentStatus = 'Paid';
    } else if (paidAmount > 0) {
      paymentStatus = 'Partially Paid';
    }

    const finalInvoiceNo = invoiceNo && invoiceNo.trim()
      ? invoiceNo.trim()
      : await generateNextInvoiceNumber();

    const paymentRecords = [];
    if (paidAmount > 0) {
      paymentRecords.push({
        id: `pay_${Date.now()}_1`,
        date: invoiceDate,
        amount: paidAmount,
        paymentMode,
        reference: paymentReference || 'Initial Settlement',
        notes: 'Initial payment recorded at billing time'
      });
    }

    const defaultBank = {
      bankName: 'State Bank of India',
      accountName: 'NSS TOWELS & TEXTILES',
      accountNumber: '38920194829',
      ifscCode: 'SBIN0001234',
      branch: 'Coimbatore Main Branch'
    };

    const invoicePayload = {
      invoiceNo: finalInvoiceNo,
      invoiceDate: new Date(invoiceDate),
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      referenceNo: referenceNo.trim(),
      customerId: customerId ? Number(customerId) : null,
      customerCode,
      customerName,
      customerSnapshot: resolvedCustomer,
      vehicleNo: vehicleNo.trim(),
      poNumber: poNumber.trim(),
      challanNo: challanNo.trim(),
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      salesperson: salesperson.trim(),
      dispatchNo: dispatchNo.trim(),
      items: totals.items,
      subtotal: totals.subtotal,
      itemDiscount: totals.itemDiscount,
      extraDiscount: totals.extraDiscount,
      taxableAmount: totals.taxableAmount,
      cgstAmount: totals.cgstAmount,
      sgstAmount: totals.sgstAmount,
      igstAmount: totals.igstAmount,
      gstAmount: totals.gstAmount,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      amountPaid: paidAmount,
      balanceDue,
      paymentStatus,
      invoiceStatus: invoiceStatus || 'Issued',
      notes: notes.trim(),
      terms: terms.trim() || '1. Goods once sold will not be taken back. 2. Interest @ 18% per annum will be charged if payment is delayed beyond due date.',
      bankDetails: Object.keys(bankDetails || {}).length ? bankDetails : defaultBank,
      payments: paymentRecords
    };

    if (isDb) {
      const created = await Invoice.create(invoicePayload);

      // If initial payment made, record in sales_payments audit table
      if (paidAmount > 0) {
        await SalesPayment.create({
          invoiceId: created.id,
          invoiceNo: created.invoiceNo,
          customerId: created.customerId,
          paymentDate: new Date(invoiceDate),
          amount: paidAmount,
          paymentMode,
          reference: paymentReference || 'Initial Settlement',
          notes: 'Recorded during invoice creation'
        });
      }

      return res.status(201).json({ success: true, data: created });
    }

    const nextId = String(Date.now());
    const mockCreated = {
      id: nextId,
      _id: nextId,
      ...invoicePayload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    runtimeStore.invoices.unshift(mockCreated);
    res.status(201).json({ success: true, data: mockCreated });
  } catch (error) {
    if (error.code === '23505' || error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Invoice number already exists. Please choose another.' });
    }
    next(error);
  }
};

// @desc    Update existing invoice
// @route   PUT /api/sales/invoices/:id
// @access  Public
exports.updateInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDb = mongoose.connection.readyState === 1;

    let existing = null;
    if (isDb) {
      existing = await Invoice.findById(id);
    } else {
      existing = runtimeStore.invoices.find(i => String(i.id) === String(id) || i.invoiceNo === id);
    }

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const {
      invoiceDate,
      dueDate,
      referenceNo,
      customerSnapshot,
      vehicleNo,
      poNumber,
      challanNo,
      deliveryDate,
      salesperson,
      dispatchNo,
      items,
      extraDiscount,
      invoiceStatus,
      notes,
      terms,
      bankDetails
    } = req.body;

    const resolvedCustomer = customerSnapshot || existing.customerSnapshot;
    const isIntra = isIntraState(resolvedCustomer, resolvedCustomer?.shippingAddress);
    const resolvedItems = items || existing.items || [];
    const resolvedDiscount = extraDiscount !== undefined ? extraDiscount : existing.extraDiscount;

    const totals = computeInvoiceTotals(resolvedItems, resolvedDiscount, isIntra);
    const currentPaid = Number(existing.amountPaid) || 0;
    const balanceDue = Math.max(0, round2(totals.grandTotal - currentPaid));

    let paymentStatus = 'Unpaid';
    if (currentPaid >= totals.grandTotal && totals.grandTotal > 0) {
      paymentStatus = 'Paid';
    } else if (currentPaid > 0) {
      paymentStatus = 'Partially Paid';
    }

    const updatePayload = {
      ...(invoiceDate && { invoiceDate: new Date(invoiceDate) }),
      ...(dueDate && { dueDate: new Date(dueDate) }),
      ...(referenceNo !== undefined && { referenceNo: referenceNo.trim() }),
      ...(resolvedCustomer && {
        customerSnapshot: resolvedCustomer,
        customerName: resolvedCustomer.name || existing.customerName,
        customerCode: resolvedCustomer.customerId || existing.customerCode
      }),
      ...(vehicleNo !== undefined && { vehicleNo: vehicleNo.trim() }),
      ...(poNumber !== undefined && { poNumber: poNumber.trim() }),
      ...(challanNo !== undefined && { challanNo: challanNo.trim() }),
      ...(deliveryDate !== undefined && { deliveryDate: deliveryDate ? new Date(deliveryDate) : null }),
      ...(salesperson !== undefined && { salesperson: salesperson.trim() }),
      ...(dispatchNo !== undefined && { dispatchNo: dispatchNo.trim() }),
      items: totals.items,
      subtotal: totals.subtotal,
      itemDiscount: totals.itemDiscount,
      extraDiscount: totals.extraDiscount,
      taxableAmount: totals.taxableAmount,
      cgstAmount: totals.cgstAmount,
      sgstAmount: totals.sgstAmount,
      igstAmount: totals.igstAmount,
      gstAmount: totals.gstAmount,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      balanceDue,
      paymentStatus,
      ...(invoiceStatus && { invoiceStatus }),
      ...(notes !== undefined && { notes: notes.trim() }),
      ...(terms !== undefined && { terms: terms.trim() }),
      ...(bankDetails && { bankDetails })
    };

    if (isDb) {
      const updated = await Invoice.findByIdAndUpdate(id, updatePayload, { new: true });
      return res.json({ success: true, data: updated });
    }

    const idx = runtimeStore.invoices.findIndex(i => String(i.id) === String(id) || i.invoiceNo === id);
    runtimeStore.invoices[idx] = {
      ...runtimeStore.invoices[idx],
      ...updatePayload,
      updatedAt: new Date().toISOString()
    };
    res.json({ success: true, data: runtimeStore.invoices[idx] });
  } catch (error) {
    next(error);
  }
};

// @desc    Record partial or full payment on an invoice
// @route   POST /api/sales/invoices/:id/payments
// @access  Public
exports.recordPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, paymentMode = 'Bank Transfer', paymentDate = new Date().toISOString().split('T')[0], reference = '', notes = '' } = req.body;

    const paymentAmount = round2(Number(amount));
    if (paymentAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero' });
    }

    const isDb = mongoose.connection.readyState === 1;
    let invoice = null;

    if (isDb) {
      invoice = await Invoice.findById(id);
      if (!invoice) invoice = await Invoice.findOne({ invoiceNo: id });
    } else {
      invoice = runtimeStore.invoices.find(i => String(i.id) === String(id) || i.invoiceNo === id);
    }

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const currentPaid = Number(invoice.amountPaid) || 0;
    const grandTotal = Number(invoice.grandTotal) || 0;
    const remainingBalance = Math.max(0, round2(grandTotal - currentPaid));

    if (paymentAmount > remainingBalance) {
      return res.status(400).json({
        success: false,
        error: `Payment amount (₹${paymentAmount}) cannot exceed remaining balance (₹${remainingBalance})`
      });
    }

    const newPaidAmount = round2(currentPaid + paymentAmount);
    const newBalanceDue = Math.max(0, round2(grandTotal - newPaidAmount));
    const newPaymentStatus = newBalanceDue <= 0.01 ? 'Paid' : 'Partially Paid';

    const newPaymentRecord = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      date: paymentDate,
      amount: paymentAmount,
      paymentMode,
      reference: reference.trim(),
      notes: notes.trim()
    };

    const updatedPayments = [...(Array.isArray(invoice.payments) ? invoice.payments : []), newPaymentRecord];

    if (isDb) {
      const updated = await Invoice.findByIdAndUpdate(
        invoice.id,
        {
          amountPaid: newPaidAmount,
          balanceDue: newBalanceDue,
          paymentStatus: newPaymentStatus,
          payments: updatedPayments
        },
        { new: true }
      );

      // Create ledger entry in sales_payments
      await SalesPayment.create({
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        customerId: invoice.customerId,
        paymentDate: new Date(paymentDate),
        amount: paymentAmount,
        paymentMode,
        reference: reference.trim(),
        notes: notes.trim()
      });

      return res.json({ success: true, data: updated });
    }

    invoice.amountPaid = newPaidAmount;
    invoice.balanceDue = newBalanceDue;
    invoice.paymentStatus = newPaymentStatus;
    invoice.payments = updatedPayments;
    invoice.updatedAt = new Date().toISOString();

    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

// @desc    Issue an invoice (change Draft -> Issued)
// @route   PATCH /api/sales/invoices/:id/issue
// @access  Public
exports.issueInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDb = mongoose.connection.readyState === 1;

    if (isDb) {
      const updated = await Invoice.findByIdAndUpdate(id, { invoiceStatus: 'Issued' }, { new: true });
      if (!updated) return res.status(404).json({ success: false, error: 'Invoice not found' });
      return res.json({ success: true, data: updated });
    }

    const invoice = runtimeStore.invoices.find(i => String(i.id) === String(id) || i.invoiceNo === id);
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
    invoice.invoiceStatus = 'Issued';
    invoice.updatedAt = new Date().toISOString();
    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete invoice (or cancel)
// @route   DELETE /api/sales/invoices/:id
// @access  Public
exports.deleteInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDb = mongoose.connection.readyState === 1;

    if (isDb) {
      // Also delete linked sales_payments if cascade is not active
      await query('DELETE FROM sales_payments WHERE invoice_id::text = $1', [String(id)]);
      const deleted = await Invoice.findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ success: false, error: 'Invoice not found' });
      return res.json({ success: true, message: 'Invoice deleted successfully' });
    }

    runtimeStore.invoices = runtimeStore.invoices.filter(i => String(i.id) !== String(id) && i.invoiceNo !== id);
    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    next(error);
  }
};
