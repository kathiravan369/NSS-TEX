const mongoose = require('mongoose');
const { ThreadPurchase } = require('../models');
const { isValidObjectId } = require('../utils/validateObjectId');
const runtimeStore = require('../utils/runtimeStore');

// @desc    Get thread purchases with filters & pagination
// @route   GET /api/thread-purchases
// @access  Public
exports.getThreadPurchases = async (req, res, next) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;
    const { search, supplier, gstMode, status, page = 1, limit = 20 } = req.query;

    if (isDbConnected) {
      const query = {};

      if (search) {
        query.$or = [
          { invoiceNo: { $regex: search, $options: 'i' } },
          { supplier: { $regex: search, $options: 'i' } },
          { threadType: { $regex: search, $options: 'i' } }
        ];
      }

      if (supplier && supplier !== 'All Suppliers') query.supplier = supplier;
      if (status && status !== 'All') query.status = status;
      if (gstMode) {
        query.gstMode = gstMode.toUpperCase().includes('WITHOUT') ? 'WITHOUT_GST' : 'WITH_GST';
      }

      const total = await ThreadPurchase.countDocuments(query);
      const purchases = await ThreadPurchase.find(query)
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit));

      return res.json({
        success: true,
        count: purchases.length,
        total,
        pagination: { page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
        data: purchases
      });
    }

    let result = [...runtimeStore.threadPurchases];
    if (gstMode) {
      result = result.filter(p => p.gstMode?.includes(gstMode.toUpperCase().includes('WITHOUT') ? 'WITHOUT' : 'WITH_GST'));
    }
    if (supplier && supplier !== 'All Suppliers') result = result.filter(p => p.supplier === supplier);
    if (status && status !== 'All') result = result.filter(p => p.status === status);
    if (search) {
      result = result.filter(p =>
        p.invoiceNo?.toLowerCase().includes(search.toLowerCase()) ||
        p.supplier?.toLowerCase().includes(search.toLowerCase()) ||
        p.threadType?.toLowerCase().includes(search.toLowerCase())
      );
    }

    res.json({
      success: true,
      count: result.length,
      total: result.length,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single thread purchase
// @route   GET /api/thread-purchases/:id
// @access  Public
exports.getThreadPurchaseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      let purchase = null;
      if (isValidObjectId(id)) {
        purchase = await ThreadPurchase.findById(id);
      }
      if (!purchase) {
        const cleanInvoice = String(id).replace(/^inv_/, '').trim();
        purchase = await ThreadPurchase.findOne({ invoiceNo: cleanInvoice });
      }
      if (purchase) return res.json({ success: true, data: purchase });
      return res.status(404).json({ success: false, error: 'Purchase record not found' });
    }

    const purchase = runtimeStore.threadPurchases.find(p => p._id === id || p.id === id || p.invoiceNo === id || `inv_${p.invoiceNo}` === id);
    if (!purchase) return res.status(404).json({ success: false, error: 'Purchase record not found' });
    res.json({ success: true, data: purchase });
  } catch (error) {
    next(error);
  }
};

// @desc    Create thread purchase
// @route   POST /api/thread-purchases
// @access  Public
exports.createThreadPurchase = async (req, res, next) => {
  try {
    const { supplier, threadType, qty, rate, gstMode, gstRate, invoiceNo, date, dueDate, paidAmount, balanceAmount, paidAt, status, notes } = req.body;

    if (!supplier || !threadType || !qty || !rate) {
      return res.status(400).json({ success: false, error: 'Supplier, thread type, quantity, and rate are required' });
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    const isGst = (gstMode || '').toUpperCase().includes('WITH') && !(gstMode || '').toUpperCase().includes('WITHOUT');
    const actualGstRate = isGst ? Number(gstRate || 5) : 0;
    const subtotal = Number(qty) * Number(rate);
    const gstAmount = isGst ? (subtotal * actualGstRate) / 100 : 0;
    const total = subtotal + gstAmount;
    const numericPaid = paidAmount !== undefined && paidAmount !== null && paidAmount !== '' ? Number(paidAmount) : (status === 'Paid' ? total : 0);
    const numericBalance = balanceAmount !== undefined && balanceAmount !== null && balanceAmount !== '' ? Number(balanceAmount) : Math.max(0, total - numericPaid);
    const effectiveStatus = total > 0 && numericBalance === 0 ? 'Paid' : (status || 'Pending');

    if (isDbConnected) {
      const purchase = await ThreadPurchase.create({
        date: date ? new Date(date) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        supplier,
        threadType,
        qty: Number(qty),
        rate: Number(rate),
        gstMode: isGst ? 'WITH_GST' : 'WITHOUT_GST',
        gstRate: actualGstRate,
        subtotal,
        gstAmount,
        total,
        paidAmount: numericPaid,
        balanceAmount: numericBalance,
        paidAt: paidAt ? new Date(paidAt) : (effectiveStatus === 'Paid' ? new Date() : null),
        invoiceNo: invoiceNo || `INV-0036-${String(Math.floor(100 + Math.random() * 900))}`,
        status: effectiveStatus,
        notes: notes || ''
      });

      return res.status(201).json({ success: true, data: purchase });
    }

    const newPurchase = {
      id: String(Date.now()),
      _id: `67000000000000000000001${runtimeStore.threadPurchases.length + 1}`,
      date: date || new Date().toISOString().split('T')[0],
      dueDate: dueDate || null,
      supplier,
      threadType,
      qty: Number(qty),
      rate: Number(rate),
      gstMode: isGst ? 'WITH_GST' : 'WITHOUT_GST',
      gstRate: actualGstRate,
      subtotal,
      gstAmount,
      total,
      paidAmount: numericPaid,
      balanceAmount: numericBalance,
      paidAt: paidAt || (effectiveStatus === 'Paid' ? new Date().toISOString() : null),
      invoiceNo: invoiceNo || `INV-0036-${String(Math.floor(100 + Math.random() * 900))}`,
      status: effectiveStatus,
      notes: notes || ''
    };

    runtimeStore.threadPurchases.unshift(newPurchase);
    res.status(201).json({ success: true, data: newPurchase });
  } catch (error) {
    next(error);
  }
};

// @desc    Update thread purchase
// @route   PUT /api/thread-purchases/:id
// @access  Public
exports.updateThreadPurchase = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      let purchase = null;
      if (isValidObjectId(id)) {
        purchase = await ThreadPurchase.findById(id);
      }
      if (!purchase) {
        const cleanInvoice = String(id).replace(/^inv_/, '').trim();
        purchase = await ThreadPurchase.findOne({ invoiceNo: cleanInvoice });
      }

      if (purchase) {
        const qty = req.body.qty !== undefined ? Number(req.body.qty) : Number(purchase.qty);
        const rate = req.body.rate !== undefined ? Number(req.body.rate) : Number(purchase.rate);
        const gstMode = req.body.gstMode || purchase.gstMode || 'WITH_GST';
        const isGst = gstMode.toUpperCase().includes('WITH') && !gstMode.toUpperCase().includes('WITHOUT');
        const gstRate = req.body.gstRate !== undefined ? Number(req.body.gstRate) : (isGst ? Number(purchase.gstRate || 5) : 0);
        const subtotal = req.body.subtotal !== undefined ? Number(req.body.subtotal) : (qty * rate);
        const gstAmount = req.body.gstAmount !== undefined ? Number(req.body.gstAmount) : (isGst ? (subtotal * gstRate) / 100 : 0);
        const total = req.body.total !== undefined ? Number(req.body.total) : (subtotal + gstAmount);
        const paidAmount = req.body.paidAmount !== undefined && req.body.paidAmount !== null && req.body.paidAmount !== ''
          ? Number(req.body.paidAmount)
          : Number(purchase.paidAmount || 0);
        const balanceAmount = req.body.balanceAmount !== undefined && req.body.balanceAmount !== null && req.body.balanceAmount !== ''
          ? Number(req.body.balanceAmount)
          : Math.max(0, total - paidAmount);
        const effectiveStatus = total > 0 && balanceAmount === 0 ? 'Paid' : (req.body.status || purchase.status || 'Pending');

        const updateData = {
          ...req.body,
          qty,
          rate,
          gstMode: isGst ? 'WITH_GST' : 'WITHOUT_GST',
          gstRate,
          subtotal,
          gstAmount,
          total,
          paidAmount,
          balanceAmount,
          status: effectiveStatus,
          paidAt: req.body.paidAt || (effectiveStatus === 'Paid' ? (purchase.paidAt || new Date()) : null),
          dueDate: req.body.dueDate ? new Date(req.body.dueDate) : purchase.dueDate
        };

        const updated = await ThreadPurchase.findByIdAndUpdate(purchase.id, updateData, { new: true });
        return res.json({ success: true, data: updated });
      }

      return res.status(404).json({ success: false, error: 'Purchase record not found' });
    }

    const index = runtimeStore.threadPurchases.findIndex(p => p._id === id || p.id === id || p.invoiceNo === id || `inv_${p.invoiceNo}` === id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Purchase record not found' });

    const existing = runtimeStore.threadPurchases[index];
    const qty = req.body.qty !== undefined ? Number(req.body.qty) : Number(existing.qty);
    const rate = req.body.rate !== undefined ? Number(req.body.rate) : Number(existing.rate);
    const gstMode = req.body.gstMode || existing.gstMode || 'WITH_GST';
    const isGst = gstMode.toUpperCase().includes('WITH') && !gstMode.toUpperCase().includes('WITHOUT');
    const gstRate = req.body.gstRate !== undefined ? Number(req.body.gstRate) : (isGst ? Number(existing.gstRate || 5) : 0);
    const subtotal = req.body.subtotal !== undefined ? Number(req.body.subtotal) : (qty * rate);
    const gstAmount = req.body.gstAmount !== undefined ? Number(req.body.gstAmount) : (isGst ? (subtotal * gstRate) / 100 : 0);
    const total = req.body.total !== undefined ? Number(req.body.total) : (subtotal + gstAmount);
    const paidAmount = req.body.paidAmount !== undefined && req.body.paidAmount !== null && req.body.paidAmount !== ''
      ? Number(req.body.paidAmount)
      : Number(existing.paidAmount || 0);
    const balanceAmount = req.body.balanceAmount !== undefined && req.body.balanceAmount !== null && req.body.balanceAmount !== ''
      ? Number(req.body.balanceAmount)
      : Math.max(0, total - paidAmount);
    const effectiveStatus = total > 0 && balanceAmount === 0 ? 'Paid' : (req.body.status || existing.status || 'Pending');

    runtimeStore.threadPurchases[index] = {
      ...existing,
      ...req.body,
      qty,
      rate,
      gstMode: isGst ? 'WITH_GST' : 'WITHOUT_GST',
      gstRate,
      subtotal,
      gstAmount,
      total,
      paidAmount,
      balanceAmount,
      status: effectiveStatus,
      paidAt: req.body.paidAt || (effectiveStatus === 'Paid' ? (existing.paidAt || new Date().toISOString()) : null)
    };
    res.json({ success: true, data: runtimeStore.threadPurchases[index] });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete thread purchase
// @route   DELETE /api/thread-purchases/:id
// @access  Public
exports.deleteThreadPurchase = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      let purchase = null;
      if (isValidObjectId(id)) {
        purchase = await ThreadPurchase.findById(id);
      }
      if (!purchase) {
        const cleanInvoice = String(id).replace(/^inv_/, '').trim();
        purchase = await ThreadPurchase.findOne({ invoiceNo: cleanInvoice });
      }
      if (purchase) {
        await ThreadPurchase.findByIdAndDelete(purchase.id);
        return res.json({ success: true, message: 'Purchase record deleted' });
      }
      return res.status(404).json({ success: false, error: 'Purchase record not found' });
    }

    const idx = runtimeStore.threadPurchases.findIndex(p => p._id === id || p.id === id || p.invoiceNo === id || `inv_${p.invoiceNo}` === id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Purchase record not found' });

    runtimeStore.threadPurchases.splice(idx, 1);
    res.json({ success: true, message: 'Purchase record deleted' });
  } catch (error) {
    next(error);
  }
};
