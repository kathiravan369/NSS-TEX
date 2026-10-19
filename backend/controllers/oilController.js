const mongoose = require('mongoose');
const { OilPurchase, OilStock } = require('../models');
const { isValidObjectId } = require('../utils/validateObjectId');
const runtimeStore = require('../utils/runtimeStore');

// @desc    Get oil purchases
// @route   GET /api/oil-purchases
// @access  Public
exports.getOilPurchases = async (req, res, next) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;
    const { search, oilType, status, page = 1, limit = 20 } = req.query;

    if (isDbConnected) {
      const query = {};
      if (search) {
        query.$or = [
          { invoiceNo: { $regex: search, $options: 'i' } },
          { supplier: { $regex: search, $options: 'i' } },
          { oilType: { $regex: search, $options: 'i' } }
        ];
      }
      if (oilType && oilType !== 'All Oil Types') query.oilType = oilType;
      if (status && status !== 'All') query.status = status;

      const total = await OilPurchase.countDocuments(query);
      const purchases = await OilPurchase.find(query)
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

    let result = [...runtimeStore.oilPurchases];
    if (oilType && oilType !== 'All Oil Types') result = result.filter(o => o.oilType === oilType);
    if (status && status !== 'All') result = result.filter(o => o.status === status);
    if (search) {
      result = result.filter(o =>
        o.invoiceNo?.toLowerCase().includes(search.toLowerCase()) ||
        o.supplier?.toLowerCase().includes(search.toLowerCase()) ||
        o.oilType?.toLowerCase().includes(search.toLowerCase())
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

// @desc    Create oil purchase & update stock
// @route   POST /api/oil-purchases
// @access  Public
exports.createOilPurchase = async (req, res, next) => {
  try {
    const { oilType, supplier, qty, unit, rate, includeGST, gstRate, invoiceNo, date, dueDate, paidAmount, balanceAmount, paidAt, status, notes } = req.body;

    if (!oilType || !supplier || !qty || !rate) {
      return res.status(400).json({ success: false, error: 'Oil type, supplier, quantity, and rate are required' });
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    const cost = Number(qty) * Number(rate);
    const gst = includeGST ? (cost * (Number(gstRate) || 5)) / 100 : 0;
    const final = cost + gst;
    const numericPaid = paidAmount !== undefined && paidAmount !== null && paidAmount !== '' ? Number(paidAmount) : (status === 'Paid' ? final : 0);
    const numericBalance = balanceAmount !== undefined && balanceAmount !== null && balanceAmount !== '' ? Number(balanceAmount) : Math.max(0, final - numericPaid);
    const effectiveStatus = final > 0 && numericBalance === 0 ? 'Paid' : (status || 'Pending');

    if (isDbConnected) {
      const purchase = await OilPurchase.create({
        oilType,
        supplier,
        qty: Number(qty),
        unit: unit || 'Litre',
        rate: Number(rate),
        cost,
        includeGST: Boolean(includeGST),
        gstRate: includeGST ? Number(gstRate || 5) : 0,
        gst,
        final,
        paidAmount: numericPaid,
        balanceAmount: numericBalance,
        paidAt: paidAt ? new Date(paidAt) : (effectiveStatus === 'Paid' ? new Date() : null),
        dueDate: dueDate ? new Date(dueDate) : null,
        invoiceNo: invoiceNo || `INV-0036-${String(Math.floor(100 + Math.random() * 900))}`,
        date: date ? new Date(date) : new Date(),
        status: effectiveStatus,
        notes: notes || ''
      });

      await OilStock.findOneAndUpdate(
        { type: oilType },
        { $inc: { stock: Number(qty) } },
        { upsert: true, new: true }
      );

      return res.status(201).json({ success: true, data: purchase });
    }

    const newPurchase = {
      id: String(Date.now()),
      _id: `67000000000000000000003${runtimeStore.oilPurchases.length + 1}`,
      oilType,
      supplier,
      qty: Number(qty),
      unit: unit || 'Litre',
      rate: Number(rate),
      cost,
      includeGST: Boolean(includeGST),
      gst,
      final,
      paidAmount: numericPaid,
      balanceAmount: numericBalance,
      paidAt: paidAt || (effectiveStatus === 'Paid' ? new Date().toISOString() : null),
      dueDate: dueDate || null,
      invoiceNo: invoiceNo || `INV-0036-${String(Math.floor(100 + Math.random() * 900))}`,
      date: date || new Date().toISOString().split('T')[0],
      status: effectiveStatus,
      notes: notes || ''
    };
    runtimeStore.oilPurchases.unshift(newPurchase);

    const stockItem = runtimeStore.oilStock.find(s => s.type === oilType);
    if (stockItem) {
      stockItem.stock += Number(qty);
    } else {
      runtimeStore.oilStock.push({ type: oilType, stock: Number(qty), unit: 'Ltr', lowStockThreshold: 50, isLow: false });
    }

    res.status(201).json({ success: true, data: newPurchase });
  } catch (error) {
    next(error);
  }
};

// @desc    Update oil purchase
// @route   PUT /api/oil-purchases/:id
// @access  Public
exports.updateOilPurchase = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      let purchase = await OilPurchase.findById(id);
      if (!purchase) {
        const cleanInvoice = String(id).replace(/^inv_/, '').trim();
        purchase = await OilPurchase.findOne({ invoiceNo: cleanInvoice });
      }
      if (!purchase) return res.status(404).json({ success: false, error: 'Oil purchase not found' });

      const qty = req.body.qty !== undefined ? Number(req.body.qty) : Number(purchase.qty || 0);
      const rate = req.body.rate !== undefined ? Number(req.body.rate) : Number(purchase.rate || 0);
      const cost = req.body.cost !== undefined ? Number(req.body.cost) : (qty * rate);
      const isGst = req.body.includeGST !== undefined ? Boolean(req.body.includeGST) : Boolean(purchase.includeGST);
      const gstRate = req.body.gstRate !== undefined ? Number(req.body.gstRate) : Number(purchase.gstRate || 5);
      const gst = req.body.gst !== undefined ? Number(req.body.gst) : (isGst ? (cost * gstRate) / 100 : 0);
      const final = req.body.final !== undefined ? Number(req.body.final) : (cost + gst);
      const paidAmount = req.body.paidAmount !== undefined && req.body.paidAmount !== null && req.body.paidAmount !== ''
        ? Number(req.body.paidAmount)
        : Number(purchase.paidAmount || 0);
      const balanceAmount = req.body.balanceAmount !== undefined && req.body.balanceAmount !== null && req.body.balanceAmount !== ''
        ? Number(req.body.balanceAmount)
        : Math.max(0, final - paidAmount);
      const effectiveStatus = final > 0 && balanceAmount === 0 ? 'Paid' : (req.body.status || purchase.status || 'Pending');

      const updated = await OilPurchase.findByIdAndUpdate(purchase.id, {
        ...req.body,
        qty,
        rate,
        cost,
        includeGST: isGst,
        gstRate,
        gst,
        final,
        paidAmount,
        balanceAmount,
        status: effectiveStatus,
        paidAt: req.body.paidAt || (effectiveStatus === 'Paid' ? (purchase.paidAt || new Date()) : null)
      }, { new: true, runValidators: true });

      return res.json({ success: true, data: updated });
    }

    const idx = runtimeStore.oilPurchases.findIndex(o => o._id === id || o.id === id || o.invoiceNo === id || `inv_${o.invoiceNo}` === id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Oil purchase not found' });

    const existing = runtimeStore.oilPurchases[idx];
    const qty = req.body.qty !== undefined ? Number(req.body.qty) : Number(existing.qty || 0);
    const rate = req.body.rate !== undefined ? Number(req.body.rate) : Number(existing.rate || 0);
    const cost = req.body.cost !== undefined ? Number(req.body.cost) : (qty * rate);
    const isGst = req.body.includeGST !== undefined ? Boolean(req.body.includeGST) : Boolean(existing.includeGST);
    const gstRate = req.body.gstRate !== undefined ? Number(req.body.gstRate) : Number(existing.gstRate || 5);
    const gst = req.body.gst !== undefined ? Number(req.body.gst) : (isGst ? (cost * gstRate) / 100 : 0);
    const final = req.body.final !== undefined ? Number(req.body.final) : (cost + gst);
    const paidAmount = req.body.paidAmount !== undefined && req.body.paidAmount !== null && req.body.paidAmount !== ''
      ? Number(req.body.paidAmount)
      : Number(existing.paidAmount || 0);
    const balanceAmount = req.body.balanceAmount !== undefined && req.body.balanceAmount !== null && req.body.balanceAmount !== ''
      ? Number(req.body.balanceAmount)
      : Math.max(0, final - paidAmount);
    const effectiveStatus = final > 0 && balanceAmount === 0 ? 'Paid' : (req.body.status || existing.status || 'Pending');

    runtimeStore.oilPurchases[idx] = {
      ...existing,
      ...req.body,
      qty,
      rate,
      cost,
      includeGST: isGst,
      gstRate,
      gst,
      final,
      paidAmount,
      balanceAmount,
      status: effectiveStatus,
      paidAt: req.body.paidAt || (effectiveStatus === 'Paid' ? (existing.paidAt || new Date().toISOString()) : null)
    };
    res.json({ success: true, data: runtimeStore.oilPurchases[idx] });
  } catch (error) {
    next(error);
  }
};

// @desc    Get oil stock inventory
// @route   GET /api/oil-stock
// @access  Public
exports.getOilStock = async (req, res, next) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const stock = await OilStock.find();
      if (stock && stock.length > 0) {
        return res.json({ success: true, count: stock.length, data: stock });
      }
    }

    res.json({
      success: true,
      count: runtimeStore.oilStock.length,
      data: runtimeStore.oilStock
    });
  } catch (error) {
    next(error);
  }
};
