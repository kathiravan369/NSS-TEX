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

function sanitizeCottonItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  const result = [];
  for (let i = 0; i < rawItems.length; i++) {
    const it = rawItems[i];
    if (!it) continue;
    const name = String(it.name || it.cottonType || it.type || '').trim();
    if (!name) {
      throw new Error(`Cotton variety name is required for row #${i + 1}`);
    }
    const qty = Number(it.qty);
    if (isNaN(qty) || qty <= 0) {
      throw new Error(`Quantity must be greater than 0 for "${name}"`);
    }
    const rate = Number(it.rate);
    if (isNaN(rate) || rate < 0) {
      throw new Error(`Rate cannot be negative for "${name}"`);
    }
    const unit = String(it.unit || 'Kg').trim();
    const subtotal = Math.round(qty * rate * 100) / 100;
    result.push({
      id: it.id || `cotton_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
      name,
      cottonType: name,
      qty,
      unit,
      rate,
      subtotal
    });
  }
  return result;
}

// @desc    Create oil purchase & update stock
// @route   POST /api/oil-purchases
// @access  Public
exports.createOilPurchase = async (req, res, next) => {
  try {
    const { oilType, supplier, includeGST, gstRate, invoiceNo, date, dueDate, paidAmount, balanceAmount, paidAt, status, notes } = req.body;
    let { qty, unit, rate, items } = req.body;

    if (!oilType || !supplier) {
      return res.status(400).json({ success: false, error: 'Oil/material type and supplier are required' });
    }

    const isCotton = oilType === 'Cotton' || (Array.isArray(items) && items.length > 0);
    let sanitizedItems = [];
    let calculatedCost = 0;
    let calculatedQty = 0;
    let calculatedRate = 0;
    let calculatedUnit = unit || 'Litre';

    if (isCotton) {
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'At least one cotton variety must be added' });
      }
      try {
        sanitizedItems = sanitizeCottonItems(items);
      } catch (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      if (sanitizedItems.length === 0) {
        return res.status(400).json({ success: false, error: 'At least one valid cotton variety must be added' });
      }
      calculatedCost = sanitizedItems.reduce((acc, curr) => acc + curr.subtotal, 0);
      calculatedQty = sanitizedItems.reduce((acc, curr) => acc + curr.qty, 0);
      calculatedRate = calculatedQty > 0 ? Math.round((calculatedCost / calculatedQty) * 100) / 100 : 0;
      calculatedUnit = sanitizedItems[0]?.unit || 'Kg';
    } else {
      if (!qty || rate === undefined || rate === null || rate === '') {
        return res.status(400).json({ success: false, error: 'Quantity and rate are required' });
      }
      calculatedQty = Number(qty);
      calculatedRate = Number(rate);
      if (isNaN(calculatedQty) || calculatedQty <= 0) {
        return res.status(400).json({ success: false, error: 'Quantity must be greater than 0' });
      }
      if (isNaN(calculatedRate) || calculatedRate < 0) {
        return res.status(400).json({ success: false, error: 'Rate cannot be negative' });
      }
      calculatedCost = calculatedQty * calculatedRate;
      calculatedUnit = unit || 'Litre';
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    const isGst = Boolean(includeGST);
    const effectiveGstRate = isGst ? (Number(gstRate) || 5) : 0;
    const gst = isGst ? Math.round(((calculatedCost * effectiveGstRate) / 100) * 100) / 100 : 0;
    const final = Math.round((calculatedCost + gst) * 100) / 100;
    const numericPaid = paidAmount !== undefined && paidAmount !== null && paidAmount !== '' ? Number(paidAmount) : (status === 'Paid' ? final : 0);
    const numericBalance = balanceAmount !== undefined && balanceAmount !== null && balanceAmount !== '' ? Number(balanceAmount) : Math.max(0, final - numericPaid);
    const effectiveStatus = final > 0 && numericBalance === 0 ? 'Paid' : (status || 'Pending');

    if (isDbConnected) {
      const purchase = await OilPurchase.create({
        oilType,
        supplier,
        qty: calculatedQty,
        unit: calculatedUnit,
        rate: calculatedRate,
        cost: calculatedCost,
        items: sanitizedItems,
        includeGST: isGst,
        gstRate: isGst ? effectiveGstRate : 0,
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

      if (!isCotton) {
        await OilStock.findOneAndUpdate(
          { type: oilType },
          { $inc: { stock: calculatedQty } },
          { upsert: true, new: true }
        );
      }

      return res.status(201).json({ success: true, data: purchase });
    }

    const newPurchase = {
      id: String(Date.now()),
      _id: `67000000000000000000003${runtimeStore.oilPurchases.length + 1}`,
      oilType,
      supplier,
      qty: calculatedQty,
      unit: calculatedUnit,
      rate: calculatedRate,
      cost: calculatedCost,
      items: sanitizedItems,
      includeGST: isGst,
      gstRate: isGst ? effectiveGstRate : 0,
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

    if (!isCotton) {
      const stockItem = runtimeStore.oilStock.find(s => s.type === oilType);
      if (stockItem) {
        stockItem.stock += calculatedQty;
      } else {
        runtimeStore.oilStock.push({ type: oilType, stock: calculatedQty, unit: 'Ltr', lowStockThreshold: 50, isLow: false });
      }
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

      const targetOilType = req.body.oilType || purchase.oilType;
      const isCotton = targetOilType === 'Cotton' || (Array.isArray(req.body.items) && req.body.items.length > 0);

      let finalItems = purchase.items || [];
      let qty = Number(purchase.qty || 0);
      let rate = Number(purchase.rate || 0);
      let cost = Number(purchase.cost || 0);
      let unit = purchase.unit || (isCotton ? 'Kg' : 'Litre');

      if (isCotton) {
        if (req.body.items !== undefined) {
          if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
            return res.status(400).json({ success: false, error: 'At least one cotton variety must be added' });
          }
          try {
            finalItems = sanitizeCottonItems(req.body.items);
          } catch (err) {
            return res.status(400).json({ success: false, error: err.message });
          }
          cost = finalItems.reduce((acc, curr) => acc + curr.subtotal, 0);
          qty = finalItems.reduce((acc, curr) => acc + curr.qty, 0);
          rate = qty > 0 ? Math.round((cost / qty) * 100) / 100 : 0;
          unit = finalItems[0]?.unit || 'Kg';
        } else {
          if (req.body.cost !== undefined) cost = Number(req.body.cost);
          if (req.body.qty !== undefined) qty = Number(req.body.qty);
          if (req.body.rate !== undefined) rate = Number(req.body.rate);
          if (req.body.unit !== undefined) unit = req.body.unit;
        }
      } else {
        qty = req.body.qty !== undefined ? Number(req.body.qty) : Number(purchase.qty || 0);
        rate = req.body.rate !== undefined ? Number(req.body.rate) : Number(purchase.rate || 0);
        if (qty <= 0) return res.status(400).json({ success: false, error: 'Quantity must be greater than 0' });
        if (rate < 0) return res.status(400).json({ success: false, error: 'Rate cannot be negative' });
        cost = req.body.cost !== undefined ? Number(req.body.cost) : (qty * rate);
        unit = req.body.unit || purchase.unit || 'Litre';
        if (req.body.items !== undefined) finalItems = req.body.items;
      }

      const isGst = req.body.includeGST !== undefined ? Boolean(req.body.includeGST) : Boolean(purchase.includeGST);
      const gstRate = req.body.gstRate !== undefined ? Number(req.body.gstRate) : Number(purchase.gstRate || 5);
      const gst = req.body.gst !== undefined ? Number(req.body.gst) : (isGst ? Math.round(((cost * gstRate) / 100) * 100) / 100 : 0);
      const final = req.body.final !== undefined ? Number(req.body.final) : Math.round((cost + gst) * 100) / 100;
      const paidAmount = req.body.paidAmount !== undefined && req.body.paidAmount !== null && req.body.paidAmount !== ''
        ? Number(req.body.paidAmount)
        : Number(purchase.paidAmount || 0);
      const balanceAmount = req.body.balanceAmount !== undefined && req.body.balanceAmount !== null && req.body.balanceAmount !== ''
        ? Number(req.body.balanceAmount)
        : Math.max(0, final - paidAmount);
      const effectiveStatus = final > 0 && balanceAmount === 0 ? 'Paid' : (req.body.status || purchase.status || 'Pending');

      const updated = await OilPurchase.findByIdAndUpdate(purchase.id, {
        ...req.body,
        oilType: targetOilType,
        items: finalItems,
        qty,
        rate,
        unit,
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
    const targetOilType = req.body.oilType || existing.oilType;
    const isCotton = targetOilType === 'Cotton' || (Array.isArray(req.body.items) && req.body.items.length > 0);

    let finalItems = existing.items || [];
    let qty = Number(existing.qty || 0);
    let rate = Number(existing.rate || 0);
    let cost = Number(existing.cost || 0);
    let unit = existing.unit || (isCotton ? 'Kg' : 'Litre');

    if (isCotton) {
      if (req.body.items !== undefined) {
        if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
          return res.status(400).json({ success: false, error: 'At least one cotton variety must be added' });
        }
        try {
          finalItems = sanitizeCottonItems(req.body.items);
        } catch (err) {
          return res.status(400).json({ success: false, error: err.message });
        }
        cost = finalItems.reduce((acc, curr) => acc + curr.subtotal, 0);
        qty = finalItems.reduce((acc, curr) => acc + curr.qty, 0);
        rate = qty > 0 ? Math.round((cost / qty) * 100) / 100 : 0;
        unit = finalItems[0]?.unit || 'Kg';
      } else {
        if (req.body.cost !== undefined) cost = Number(req.body.cost);
        if (req.body.qty !== undefined) qty = Number(req.body.qty);
        if (req.body.rate !== undefined) rate = Number(req.body.rate);
        if (req.body.unit !== undefined) unit = req.body.unit;
      }
    } else {
      qty = req.body.qty !== undefined ? Number(req.body.qty) : Number(existing.qty || 0);
      rate = req.body.rate !== undefined ? Number(req.body.rate) : Number(existing.rate || 0);
      if (qty <= 0) return res.status(400).json({ success: false, error: 'Quantity must be greater than 0' });
      if (rate < 0) return res.status(400).json({ success: false, error: 'Rate cannot be negative' });
      cost = req.body.cost !== undefined ? Number(req.body.cost) : (qty * rate);
      unit = req.body.unit || existing.unit || 'Litre';
      if (req.body.items !== undefined) finalItems = req.body.items;
    }

    const isGst = req.body.includeGST !== undefined ? Boolean(req.body.includeGST) : Boolean(existing.includeGST);
    const gstRate = req.body.gstRate !== undefined ? Number(req.body.gstRate) : Number(existing.gstRate || 5);
    const gst = req.body.gst !== undefined ? Number(req.body.gst) : (isGst ? Math.round(((cost * gstRate) / 100) * 100) / 100 : 0);
    const final = req.body.final !== undefined ? Number(req.body.final) : Math.round((cost + gst) * 100) / 100;
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
      oilType: targetOilType,
      items: finalItems,
      qty,
      rate,
      unit,
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
