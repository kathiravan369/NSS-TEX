const mongoose = require('mongoose');
const { WeeklyPayroll, Employee } = require('../models');
const { isValidObjectId } = require('../utils/validateObjectId');
const runtimeStore = require('../utils/runtimeStore');

// @desc    Get weekly payroll records
// @route   GET /api/payroll/weekly
// @access  Public
exports.getWeeklyPayroll = async (req, res, next) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;
    const { search, employeeFilter, weekStart, weekEnd } = req.query;

    if (isDbConnected) {
      const query = {};
      if (search) {
        query.$or = [
          { employeeName: { $regex: search, $options: 'i' } },
          { empId: { $regex: search, $options: 'i' } }
        ];
      }
      if (employeeFilter === 'Day Salary Only') query.workType = { $in: ['DAY_SALARY', 'Day Salary'] };
      if (employeeFilter === 'Count Salary Only') query.workType = { $in: ['COUNT_SALARY', 'Count Salary'] };

      const records = await WeeklyPayroll.find(query).sort({ weekStart: -1, createdAt: -1 });

      const totalGross = records.reduce((acc, curr) => acc + curr.grossPay, 0);
      const totalDeductions = records.reduce((acc, curr) => acc + curr.deductions, 0);
      const totalNet = records.reduce((acc, curr) => acc + curr.netPay, 0);

      return res.json({
        success: true,
        count: records.length,
        summary: { totalEmployees: records.length, totalGross, totalDeductions, totalNet },
        data: records
      });
    }

    let records = [...runtimeStore.weeklyPayroll];
    if (search) {
      records = records.filter(
        r => r.employeeName?.toLowerCase().includes(search.toLowerCase()) || r.empId?.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (employeeFilter === 'Day Salary Only') {
      records = records.filter(r => r.workType === 'DAY_SALARY' || r.workType === 'Day Salary');
    }
    if (employeeFilter === 'Count Salary Only') {
      records = records.filter(r => r.workType === 'COUNT_SALARY' || r.workType === 'Count Salary');
    }

    const totalGross = records.reduce((acc, curr) => acc + (curr.grossPay || 0), 0);
    const totalDeductions = records.reduce((acc, curr) => acc + (curr.deductions || 0), 0);
    const totalNet = records.reduce((acc, curr) => acc + (curr.netPay || 0), 0);

    res.json({
      success: true,
      count: records.length,
      summary: { totalEmployees: records.length, totalGross, totalDeductions, totalNet },
      data: records
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Record weekly payroll
// @route   POST /api/payroll/weekly
// @access  Public
exports.createWeeklyPayroll = async (req, res, next) => {
  try {
    const {
      empId,
      employeeName,
      workType,
      productName,
      workDate,
      sizeWiseRates,
      sizeWiseProduction,
      weekStart,
      weekEnd,
      daysWorked,
      leaveDays,
      hoursWorked,
      productsProduced,
      rate,
      grossPay,
      deductions,
      adjustments,
      netPay,
      remarks,
      status
    } = req.body;

    if (!empId || !employeeName) {
      return res.status(400).json({ success: false, error: 'Employee ID and name are required' });
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    const effectiveWeekStart = weekStart ? new Date(weekStart) : new Date();
    const effectiveWeekEnd = weekEnd ? new Date(weekEnd) : new Date();
    const isSize = workType === 'Size Based Salary' || workType === 'SIZE_SALARY';
    const isDay = workType === 'Day Salary' || workType === 'DAY_SALARY';

    let computedGross = 0;
    let computedQty = Number(productsProduced) || 0;

    if (isSize) {
      const lQty = Math.max(0, Number(req.body.largeQuantity || 0));
      const mQty = Math.max(0, Number(req.body.mediumQuantity || 0));
      const sQty = Math.max(0, Number(req.body.smallQuantity || 0));
      const lPrice = Number(req.body.largePrice !== undefined ? req.body.largePrice : 5);
      const mPrice = Number(req.body.mediumPrice !== undefined ? req.body.mediumPrice : 4);
      const sPrice = Number(req.body.smallPrice !== undefined ? req.body.smallPrice : 3);
      
      if ((lQty > 0 || mQty > 0 || sQty > 0) || !Array.isArray(sizeWiseProduction) || sizeWiseProduction.length === 0) {
        computedGross = (lQty * lPrice) + (mQty * mPrice) + (sQty * sPrice);
        computedQty = lQty + mQty + sQty;
      } else {
        computedGross = sizeWiseProduction.reduce((sum, item) => sum + (Number(item.amount) || (Number(item.qty || 0) * Number(item.rate || 0))), 0);
        computedQty = sizeWiseProduction.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
      }
    } else if (isDay) {
      computedGross = (Number(daysWorked) || 0) * (Number(rate) || 0);
    } else {
      const pPrice = Number(req.body.pricePerItem !== undefined ? req.body.pricePerItem : rate) || 0;
      const pQty = Math.max(0, Number(req.body.countQuantity !== undefined ? req.body.countQuantity : productsProduced) || 0);
      computedGross = pQty * pPrice;
      computedQty = pQty;
    }

    if (grossPay !== undefined && Number(grossPay) > 0) {
      computedGross = Number(grossPay);
    }

    const computedNet = netPay !== undefined ? Number(netPay) : (computedGross - (Number(deductions) || 0) + (Number(adjustments) || 0));

    if (isDbConnected) {
      if (weekStart && weekEnd) {
        const existing = await WeeklyPayroll.findOne({
          empId,
          $or: [
            { weekStart: effectiveWeekStart, weekEnd: effectiveWeekEnd },
            {
              weekStart: { $lte: effectiveWeekEnd },
              weekEnd: { $gte: effectiveWeekStart }
            }
          ]
        });
        if (existing) {
          return res.status(400).json({
            success: false,
            error: `Payroll record for employee ${empId} already exists for this week period.`
          });
        }
      }

      const payroll = await WeeklyPayroll.create({
        empId,
        employeeName,
        workType: workType || (isSize ? 'Size Based Salary' : isDay ? 'Day Salary' : 'Count Based Salary'),
        productName: productName || 'Towel',
        workDate: workDate ? new Date(workDate) : new Date(),
        pricePerItem: Number(req.body.pricePerItem || rate || 0),
        countQuantity: Number(req.body.countQuantity || productsProduced || 0),
        largeQuantity: Math.max(0, Number(req.body.largeQuantity || 0)),
        largePrice: Number(req.body.largePrice || 5),
        mediumQuantity: Math.max(0, Number(req.body.mediumQuantity || 0)),
        mediumPrice: Number(req.body.mediumPrice || 4),
        smallQuantity: Math.max(0, Number(req.body.smallQuantity || 0)),
        smallPrice: Number(req.body.smallPrice || 3),
        sizeWiseRates: Array.isArray(sizeWiseRates) ? sizeWiseRates : [],
        sizeWiseProduction: Array.isArray(sizeWiseProduction) ? sizeWiseProduction : [],
        weekStart: effectiveWeekStart,
        weekEnd: effectiveWeekEnd,
        daysWorked: Number(daysWorked) || 0,
        leaveDays: Number(leaveDays) || 0,
        hoursWorked: Number(hoursWorked) || 0,
        productsProduced: computedQty,
        rate: Number(rate) || 0,
        grossPay: computedGross,
        deductions: Number(deductions) || 0,
        adjustments: Number(adjustments) || 0,
        netPay: computedNet,
        remarks: remarks || '',
        status: status || 'Pending'
      });

      return res.status(201).json({ success: true, data: payroll });
    }

    if (weekStart && weekEnd) {
      const existing = runtimeStore.weeklyPayroll.find(p =>
        p.empId === empId &&
        (
          (p.weekStart === weekStart && p.weekEnd === weekEnd) ||
          (new Date(p.weekStart) <= effectiveWeekEnd && new Date(p.weekEnd) >= effectiveWeekStart)
        )
      );
      if (existing) {
        return res.status(400).json({
          success: false,
          error: `Payroll record for employee ${empId} already exists for this week period.`
        });
      }
    }

    const newPayroll = {
      id: String(Date.now()),
      _id: `67000000000000000000005${runtimeStore.weeklyPayroll.length + 1}`,
      empId,
      employeeName,
      workType: workType || (isSize ? 'Size Based Salary' : isDay ? 'Day Salary' : 'Count Based Salary'),
      productName: productName || 'Towel',
      workDate: workDate || new Date().toISOString().split('T')[0],
      pricePerItem: Number(req.body.pricePerItem || rate || 0),
      countQuantity: Number(req.body.countQuantity || productsProduced || 0),
      largeQuantity: Math.max(0, Number(req.body.largeQuantity || 0)),
      largePrice: Number(req.body.largePrice || 5),
      mediumQuantity: Math.max(0, Number(req.body.mediumQuantity || 0)),
      mediumPrice: Number(req.body.mediumPrice || 4),
      smallQuantity: Math.max(0, Number(req.body.smallQuantity || 0)),
      smallPrice: Number(req.body.smallPrice || 3),
      sizeWiseRates: Array.isArray(sizeWiseRates) ? sizeWiseRates : [],
      sizeWiseProduction: Array.isArray(sizeWiseProduction) ? sizeWiseProduction : [],
      weekStart: weekStart || new Date().toISOString().split('T')[0],
      weekEnd: weekEnd || new Date().toISOString().split('T')[0],
      daysWorked: Number(daysWorked) || 0,
      leaveDays: Number(leaveDays) || 0,
      hoursWorked: Number(hoursWorked) || 0,
      productsProduced: computedQty,
      rate: Number(rate) || 0,
      grossPay: computedGross,
      deductions: Number(deductions) || 0,
      adjustments: Number(adjustments) || 0,
      netPay: computedNet,
      remarks: remarks || '',
      status: status || 'Pending',
      isFinalized: false,
      paymentDate: ''
    };
    runtimeStore.weeklyPayroll.unshift(newPayroll);

    res.status(201).json({ success: true, data: newPayroll });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single payroll record
// @route   GET /api/payroll/weekly/:id
// @access  Public
exports.getWeeklyPayrollById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected && isValidObjectId(id)) {
      const record = await WeeklyPayroll.findById(id);
      if (!record) return res.status(404).json({ success: false, error: 'Payroll record not found' });
      return res.json({ success: true, data: record });
    }

    const record = runtimeStore.weeklyPayroll.find(r => r._id === id || r.id === id);
    if (!record) return res.status(404).json({ success: false, error: 'Payroll record not found' });
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
};

// @desc    Update weekly payroll
// @route   PUT /api/payroll/weekly/:id
// @access  Public
exports.updateWeeklyPayroll = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected && isValidObjectId(id)) {
      const record = await WeeklyPayroll.findById(id);
      if (!record) return res.status(404).json({ success: false, error: 'Payroll record not found' });

      if (record.isFinalized) {
        return res.status(400).json({ success: false, error: 'Cannot modify finalized payroll record' });
      }

      Object.assign(record, req.body);
      await record.save();
      return res.json({ success: true, data: record });
    }

    const idx = runtimeStore.weeklyPayroll.findIndex(r => r._id === id || r.id === id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Payroll record not found' });

    if (runtimeStore.weeklyPayroll[idx].isFinalized) {
      return res.status(400).json({ success: false, error: 'Cannot modify finalized payroll record' });
    }

    const updated = { ...runtimeStore.weeklyPayroll[idx], ...req.body };
    const isSize = updated.workType === 'Size Based Salary' || updated.workType === 'SIZE_SALARY';
    const isDay = updated.workType === 'Day Salary' || updated.workType === 'DAY_SALARY';
    if (req.body.grossPay === undefined) {
      if (isSize) {
        const lQty = Math.max(0, Number(updated.largeQuantity || 0));
        const mQty = Math.max(0, Number(updated.mediumQuantity || 0));
        const sQty = Math.max(0, Number(updated.smallQuantity || 0));
        const lPrice = Number(updated.largePrice !== undefined ? updated.largePrice : 5);
        const mPrice = Number(updated.mediumPrice !== undefined ? updated.mediumPrice : 4);
        const sPrice = Number(updated.smallPrice !== undefined ? updated.smallPrice : 3);
        updated.grossPay = (lQty * lPrice) + (mQty * mPrice) + (sQty * sPrice);
        updated.productsProduced = lQty + mQty + sQty;
      } else if (isDay) {
        updated.grossPay = (Number(updated.daysWorked) || 0) * (Number(updated.rate) || 0);
      } else {
        const pPrice = Number(updated.pricePerItem !== undefined ? updated.pricePerItem : updated.rate) || 0;
        const pQty = Math.max(0, Number(updated.countQuantity !== undefined ? updated.countQuantity : updated.productsProduced) || 0);
        updated.grossPay = pQty * pPrice;
        updated.productsProduced = pQty;
      }
    }
    if (req.body.netPay === undefined) {
      updated.netPay = (Number(updated.grossPay) || 0) - (Number(updated.deductions) || 0) + (Number(updated.adjustments) || 0);
    }
    runtimeStore.weeklyPayroll[idx] = updated;
    res.json({ success: true, data: runtimeStore.weeklyPayroll[idx] });
  } catch (error) {
    next(error);
  }
};

// @desc    Finalize payroll record
// @route   PATCH /api/payroll/weekly/:id/finalize
// @access  Public
exports.finalizePayroll = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected && isValidObjectId(id)) {
      const record = await WeeklyPayroll.findByIdAndUpdate(id, { isFinalized: true }, { new: true });
      if (!record) return res.status(404).json({ success: false, error: 'Payroll record not found' });
      return res.json({ success: true, message: 'Payroll period finalized', data: record });
    }

    const rec = runtimeStore.weeklyPayroll.find(r => r._id === id || r.id === id);
    if (!rec) return res.status(404).json({ success: false, error: 'Payroll record not found' });
    rec.isFinalized = true;
    res.json({ success: true, message: 'Payroll period finalized', data: rec });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark payroll as paid
// @route   PATCH /api/payroll/weekly/:id/payment
// @access  Public
exports.markPayrollPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status = 'Paid', paymentDate = new Date().toISOString().split('T')[0] } = req.body;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected && isValidObjectId(id)) {
      const record = await WeeklyPayroll.findByIdAndUpdate(
        id,
        { status, paymentDate },
        { new: true }
      );
      if (!record) return res.status(404).json({ success: false, error: 'Payroll record not found' });
      return res.json({ success: true, message: 'Payment status updated', data: record });
    }

    const rec = runtimeStore.weeklyPayroll.find(r => r._id === id || r.id === id);
    if (!rec) return res.status(404).json({ success: false, error: 'Payroll record not found' });
    rec.status = status;
    rec.paymentDate = paymentDate;
    res.json({ success: true, message: 'Payment status updated', data: rec });
  } catch (error) {
    next(error);
  }
};
