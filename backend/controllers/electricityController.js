const mongoose = require('mongoose');
const { ElectricityExpense } = require('../models');
const { isValidObjectId } = require('../utils/validateObjectId');
const runtimeStore = require('../utils/runtimeStore');

// @desc    Get electricity expenses
// @route   GET /api/electricity-expenses
// @access  Public
exports.getElectricityExpenses = async (req, res, next) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;
    const { month, status, page = 1, limit = 20 } = req.query;

    if (isDbConnected) {
      const query = {};
      if (month && month !== 'All Months') query.month = { $regex: month, $options: 'i' };
      if (status && status !== 'All') query.status = status;

      const total = await ElectricityExpense.countDocuments(query);
      const bills = await ElectricityExpense.find(query)
        .sort({ billDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit));

      return res.json({
        success: true,
        count: bills.length,
        total,
        pagination: { page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
        data: bills
      });
    }

    let result = [...runtimeStore.electricityExpenses];
    if (month && month !== 'All Months') result = result.filter(b => b.month?.toLowerCase().includes(month.toLowerCase()));
    if (status && status !== 'All') result = result.filter(b => b.status === status);

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

// @desc    Create electricity expense
// @route   POST /api/electricity-expenses
// @access  Public
exports.createElectricityExpense = async (req, res, next) => {
  try {
    const { month, billDate, dueDate, prev, curr, rate, fixed, additional, status, notes } = req.body;

    if (!month || prev === undefined || curr === undefined) {
      return res.status(400).json({ success: false, error: 'Month and meter readings (prev, curr) are required' });
    }

    const prevNum = Number(prev);
    const currNum = Number(curr);

    if (currNum < prevNum) {
      return res.status(400).json({ success: false, error: 'Current reading cannot be lower than previous reading' });
    }

    const units = currNum - prevNum;
    const unitRate = Number(rate || 6.50);
    const fixedCharges = Number(fixed || 450);
    const addlCharges = Number(additional || 0);
    const total = (units * unitRate) + fixedCharges + addlCharges;

    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const bill = await ElectricityExpense.create({
        month,
        billDate: billDate ? new Date(billDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : new Date(),
        prev: prevNum,
        curr: currNum,
        units,
        rate: unitRate,
        fixed: fixedCharges,
        additional: addlCharges,
        total,
        status: status || 'Pending',
        notes: notes || ''
      });

      return res.status(201).json({ success: true, data: bill });
    }

    const newBill = {
      id: String(Date.now()),
      _id: `67000000000000000000005${runtimeStore.electricityExpenses.length + 1}`,
      month,
      billDate: billDate || new Date().toISOString().split('T')[0],
      dueDate: dueDate || new Date().toISOString().split('T')[0],
      prev: prevNum,
      curr: currNum,
      units,
      rate: unitRate,
      fixed: fixedCharges,
      additional: addlCharges,
      total,
      status: status || 'Pending',
      notes: notes || ''
    };
    runtimeStore.electricityExpenses.unshift(newBill);

    res.status(201).json({ success: true, data: newBill });
  } catch (error) {
    next(error);
  }
};

// @desc    Update electricity expense
// @route   PUT /api/electricity-expenses/:id
// @access  Public
exports.updateElectricityExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected && isValidObjectId(id)) {
      const bill = await ElectricityExpense.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
      if (!bill) return res.status(404).json({ success: false, error: 'Electricity bill record not found' });
      return res.json({ success: true, data: bill });
    }

    const idx = runtimeStore.electricityExpenses.findIndex(e => e._id === id || e.id === id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Electricity bill record not found' });

    runtimeStore.electricityExpenses[idx] = { ...runtimeStore.electricityExpenses[idx], ...req.body };
    res.json({ success: true, data: runtimeStore.electricityExpenses[idx] });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete electricity expense
// @route   DELETE /api/electricity-expenses/:id
// @access  Public
exports.deleteElectricityExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected && isValidObjectId(id)) {
      const bill = await ElectricityExpense.findByIdAndDelete(id);
      if (!bill) return res.status(404).json({ success: false, error: 'Electricity bill record not found' });
      return res.json({ success: true, message: 'Electricity bill deleted' });
    }

    const idx = runtimeStore.electricityExpenses.findIndex(e => e._id === id || e.id === id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Electricity bill record not found' });

    runtimeStore.electricityExpenses.splice(idx, 1);
    res.json({ success: true, message: 'Electricity bill deleted' });
  } catch (error) {
    next(error);
  }
};
