const mongoose = require('mongoose');
const { MachineryExpense } = require('../models');
const { isValidObjectId } = require('../utils/validateObjectId');
const runtimeStore = require('../utils/runtimeStore');

// @desc    Get machinery expenses
// @route   GET /api/machinery-expenses
// @access  Public
exports.getMachineryExpenses = async (req, res, next) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;
    const { search, category, machine, status, page = 1, limit = 20 } = req.query;

    if (isDbConnected) {
      const query = {};
      if (search) {
        query.$or = [
          { machine: { $regex: search, $options: 'i' } },
          { desc: { $regex: search, $options: 'i' } },
          { vendor: { $regex: search, $options: 'i' } }
        ];
      }
      if (category && category !== 'All Categories') query.category = category;
      if (machine && machine !== 'All Machines') query.machine = machine;
      if (status && status !== 'All') query.status = status;

      const total = await MachineryExpense.countDocuments(query);
      const expenses = await MachineryExpense.find(query)
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit));

      return res.json({
        success: true,
        count: expenses.length,
        total,
        pagination: { page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
        data: expenses
      });
    }

    let result = [...runtimeStore.machineryExpenses];
    if (category && category !== 'All Categories') result = result.filter(m => m.category === category);
    if (machine && machine !== 'All Machines') result = result.filter(m => m.machine === machine);
    if (status && status !== 'All') result = result.filter(m => m.status === status);
    if (search) {
      result = result.filter(m =>
        m.machine?.toLowerCase().includes(search.toLowerCase()) ||
        m.desc?.toLowerCase().includes(search.toLowerCase()) ||
        m.vendor?.toLowerCase().includes(search.toLowerCase())
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

// @desc    Create machinery expense
// @route   POST /api/machinery-expenses
// @access  Public
exports.createMachineryExpense = async (req, res, next) => {
  try {
    const { machine, machineId, category, desc, qty, unit, cost, includeGST, gstRate, vendor, date, dueDate, paidAmount, balanceAmount, paidAt, status, notes } = req.body;

    if (!machine || !desc || !cost) {
      return res.status(400).json({ success: false, error: 'Machine, description, and cost are required' });
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    const isGst = Boolean(includeGST);
    const actualGstRate = isGst ? Number(gstRate || 18) : 0;
    const gst = isGst ? (Number(cost) * actualGstRate) / 100 : 0;
    const total = Number(cost) + gst;
    const numericPaid = paidAmount !== undefined && paidAmount !== null && paidAmount !== '' ? Number(paidAmount) : (status === 'Paid' ? total : 0);
    const numericBalance = balanceAmount !== undefined && balanceAmount !== null && balanceAmount !== '' ? Number(balanceAmount) : Math.max(0, total - numericPaid);
    const effectiveStatus = total > 0 && numericBalance === 0 ? 'Paid' : (status || 'Pending');

    if (isDbConnected) {
      const expense = await MachineryExpense.create({
        machine,
        machineId: machineId || `MC-${String(Math.floor(100 + Math.random() * 900))}`,
        category: category || 'Maintenance',
        desc,
        qty: Number(qty) || 1,
        unit: unit || 'Nos',
        cost: Number(cost),
        includeGST: isGst,
        gstRate: actualGstRate,
        gst,
        total,
        paidAmount: numericPaid,
        balanceAmount: numericBalance,
        paidAt: paidAt ? new Date(paidAt) : (effectiveStatus === 'Paid' ? new Date() : null),
        dueDate: dueDate ? new Date(dueDate) : null,
        vendor: vendor || 'Engineering Works',
        date: date ? new Date(date) : new Date(),
        status: effectiveStatus,
        notes: notes || ''
      });

      return res.status(201).json({ success: true, data: expense });
    }

    const newExpense = {
      id: String(Date.now()),
      _id: `67000000000000000000004${runtimeStore.machineryExpenses.length + 1}`,
      machine,
      machineId: machineId || `MC-${String(Math.floor(100 + Math.random() * 900))}`,
      category: category || 'Maintenance',
      desc,
      qty: Number(qty) || 1,
      unit: unit || 'Nos',
      cost: Number(cost),
      includeGST: isGst,
      gstRate: actualGstRate,
      gst,
      total,
      paidAmount: numericPaid,
      balanceAmount: numericBalance,
      paidAt: paidAt || (effectiveStatus === 'Paid' ? new Date().toISOString() : null),
      dueDate: dueDate || null,
      vendor: vendor || 'Engineering Works',
      date: date || new Date().toISOString().split('T')[0],
      status: effectiveStatus,
      notes: notes || ''
    };
    runtimeStore.machineryExpenses.unshift(newExpense);

    res.status(201).json({ success: true, data: newExpense });
  } catch (error) {
    next(error);
  }
};

// @desc    Update machinery expense
// @route   PUT /api/machinery-expenses/:id
// @access  Public
exports.updateMachineryExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      let expense = await MachineryExpense.findById(id);
      if (!expense) {
        expense = await MachineryExpense.findOne({ machineId: id });
      }
      if (!expense) return res.status(404).json({ success: false, error: 'Machinery expense record not found' });

      const cost = req.body.cost !== undefined ? Number(req.body.cost) : Number(expense.cost || 0);
      const isGst = req.body.includeGST !== undefined ? Boolean(req.body.includeGST) : Boolean(expense.includeGST);
      const gstRate = req.body.gstRate !== undefined ? Number(req.body.gstRate) : (isGst ? Number(expense.gstRate || 18) : 0);
      const gst = req.body.gst !== undefined ? Number(req.body.gst) : (isGst ? (cost * gstRate) / 100 : 0);
      const total = req.body.total !== undefined ? Number(req.body.total) : (cost + gst);
      const paidAmount = req.body.paidAmount !== undefined && req.body.paidAmount !== null && req.body.paidAmount !== ''
        ? Number(req.body.paidAmount)
        : Number(expense.paidAmount || 0);
      const balanceAmount = req.body.balanceAmount !== undefined && req.body.balanceAmount !== null && req.body.balanceAmount !== ''
        ? Number(req.body.balanceAmount)
        : Math.max(0, total - paidAmount);
      const effectiveStatus = total > 0 && balanceAmount === 0 ? 'Paid' : (req.body.status || expense.status || 'Pending');

      const updated = await MachineryExpense.findByIdAndUpdate(expense.id, {
        ...req.body,
        cost,
        includeGST: isGst,
        gstRate,
        gst,
        total,
        paidAmount,
        balanceAmount,
        status: effectiveStatus,
        paidAt: req.body.paidAt || (effectiveStatus === 'Paid' ? (expense.paidAt || new Date()) : null)
      }, { new: true, runValidators: true });

      return res.json({ success: true, data: updated });
    }

    const idx = runtimeStore.machineryExpenses.findIndex(m => m._id === id || m.id === id || m.machineId === id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Machinery expense record not found' });

    const existing = runtimeStore.machineryExpenses[idx];
    const cost = req.body.cost !== undefined ? Number(req.body.cost) : Number(existing.cost || 0);
    const isGst = req.body.includeGST !== undefined ? Boolean(req.body.includeGST) : Boolean(existing.includeGST);
    const gstRate = req.body.gstRate !== undefined ? Number(req.body.gstRate) : (isGst ? Number(existing.gstRate || 18) : 0);
    const gst = req.body.gst !== undefined ? Number(req.body.gst) : (isGst ? (cost * gstRate) / 100 : 0);
    const total = req.body.total !== undefined ? Number(req.body.total) : (cost + gst);
    const paidAmount = req.body.paidAmount !== undefined && req.body.paidAmount !== null && req.body.paidAmount !== ''
      ? Number(req.body.paidAmount)
      : Number(existing.paidAmount || 0);
    const balanceAmount = req.body.balanceAmount !== undefined && req.body.balanceAmount !== null && req.body.balanceAmount !== ''
      ? Number(req.body.balanceAmount)
      : Math.max(0, total - paidAmount);
    const effectiveStatus = total > 0 && balanceAmount === 0 ? 'Paid' : (req.body.status || existing.status || 'Pending');

    runtimeStore.machineryExpenses[idx] = {
      ...existing,
      ...req.body,
      cost,
      includeGST: isGst,
      gstRate,
      gst,
      total,
      paidAmount,
      balanceAmount,
      status: effectiveStatus,
      paidAt: req.body.paidAt || (effectiveStatus === 'Paid' ? (existing.paidAt || new Date().toISOString()) : null)
    };
    res.json({ success: true, data: runtimeStore.machineryExpenses[idx] });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete machinery expense
// @route   DELETE /api/machinery-expenses/:id
// @access  Public
exports.deleteMachineryExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      let expense = await MachineryExpense.findById(id);
      if (!expense) {
        expense = await MachineryExpense.findOne({ machineId: id });
      }
      if (expense) {
        await MachineryExpense.findByIdAndDelete(expense.id);
        return res.json({ success: true, message: 'Machinery expense deleted' });
      }
      return res.status(404).json({ success: false, error: 'Machinery expense record not found' });
    }

    const idx = runtimeStore.machineryExpenses.findIndex(m => m._id === id || m.id === id || m.machineId === id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Machinery expense record not found' });

    runtimeStore.machineryExpenses.splice(idx, 1);
    res.json({ success: true, message: 'Machinery expense deleted' });
  } catch (error) {
    next(error);
  }
};
