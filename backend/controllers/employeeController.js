const mongoose = require('mongoose');
const { Employee } = require('../models');
const { isValidObjectId } = require('../utils/validateObjectId');
const runtimeStore = require('../utils/runtimeStore');

// @desc    Get all employees with search & filtering
// @route   GET /api/employees
// @access  Public
exports.getEmployees = async (req, res, next) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;
    const { search, workType, status, page = 1, limit = 20 } = req.query;

    if (isDbConnected) {
      const query = {};

      if (search) {
        query.$or = [
          { empId: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ];
      }

      if (workType && workType !== 'All Work Types') {
        if (workType === 'Day Salary') {
          query.$or = [{ workType: { $regex: 'Day', $options: 'i' } }, { workTypes: { $in: ['Day Salary'] } }];
        } else if (workType === 'Count Salary') {
          query.$or = [{ workType: { $regex: 'Count', $options: 'i' } }, { workTypes: { $in: ['Count Salary'] } }];
        } else if (workType === 'Size Salary') {
          query.$or = [{ workType: { $regex: 'Size', $options: 'i' } }, { workTypes: { $in: ['Size Salary'] } }];
        } else if (workType === 'Multiple Types' || workType === 'Multiple') {
          query.$or = [
            { 'workTypes.1': { $exists: true } },
            { workType: { $regex: ',', $options: 'i' } }
          ];
        }
      }

      if (status && status !== 'All Status') {
        query.status = status;
      }

      const total = await Employee.countDocuments(query);
      const employees = await Employee.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit));

      return res.json({
        success: true,
        count: employees.length,
        total,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / limit)
        },
        data: employees
      });
    }

    let filtered = [...runtimeStore.employees];

    if (search) {
      filtered = filtered.filter(
        (e) =>
          e.empId?.toLowerCase().includes(search.toLowerCase()) ||
          e.name?.toLowerCase().includes(search.toLowerCase()) ||
          e.phone?.includes(search)
      );
    }

    if (workType && workType !== 'All Work Types') {
      filtered = filtered.filter((e) => {
        const typesStr = `${e.type || ''} ${e.workType || ''} ${(e.workTypes || []).join(' ')}`.toLowerCase();
        if (workType === 'Day Salary') return typesStr.includes('day');
        if (workType === 'Count Salary') return typesStr.includes('count');
        if (workType === 'Size Salary') return typesStr.includes('size');
        if (workType === 'Multiple Types' || workType === 'Multiple') {
          return (e.workTypes && e.workTypes.length > 1) || typesStr.includes(',');
        }
        return true;
      });
    }

    if (status && status !== 'All Status') {
      filtered = filtered.filter((e) => e.status === status);
    }

    res.json({
      success: true,
      count: filtered.length,
      total: filtered.length,
      data: filtered
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single employee by ID
// @route   GET /api/employees/:id
// @access  Public
exports.getEmployeeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const employee = await Employee.findById(id);
      if (!employee) {
        return res.status(404).json({ success: false, error: 'Employee not found' });
      }
      return res.json({ success: true, data: employee });
    }

    const employee = runtimeStore.employees.find((e) => e._id === id || e.id === id || e.empId === id);
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    res.json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new employee
// @route   POST /api/employees
// @access  Public
exports.createEmployee = async (req, res, next) => {
  try {
    const { name, phone, type, workType, workTypes, dailyRate, pieceRate, productType, sizeRates, status, joinDate, notes, empId } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Employee name and phone are required' });
    }

    if ((dailyRate !== undefined && Number(dailyRate) < 0) || (pieceRate !== undefined && Number(pieceRate) < 0)) {
      return res.status(400).json({ success: false, error: 'Daily rate and piece rate cannot be negative' });
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    const resolvedWorkTypes = Array.isArray(workTypes) && workTypes.length > 0 
      ? workTypes 
      : [type || workType || 'Day Salary'];
    const resolvedTypeStr = resolvedWorkTypes.join(', ');

    if (isDbConnected) {
      let finalEmpId = empId;
      if (!finalEmpId) {
        const count = await Employee.countDocuments();
        finalEmpId = `EMP-${String(count + 1).padStart(4, '0')}`;
      }

      const employee = await Employee.create({
        empId: finalEmpId,
        name,
        phone,
        workType: resolvedTypeStr,
        workTypes: resolvedWorkTypes,
        dailyRate: Number(dailyRate) || 0,
        pieceRate: Number(pieceRate) || 0,
        productType: productType || '',
        sizeRates: Array.isArray(sizeRates) ? sizeRates : [],
        status: status || 'Active',
        joinDate: joinDate ? new Date(joinDate) : new Date(),
        notes: notes || ''
      });

      return res.status(201).json({ success: true, data: employee });
    }

    const nextNum = runtimeStore.employees.length + 1;
    const finalId = empId || `EMP-${String(nextNum).padStart(4, '0')}`;

    const newEmp = {
      id: String(Date.now()),
      _id: `67000000000000000000000${nextNum}`,
      empId: finalId,
      name,
      phone,
      type: resolvedTypeStr,
      workType: resolvedTypeStr,
      workTypes: resolvedWorkTypes,
      dailyRate: Number(dailyRate) || 0,
      pieceRate: Number(pieceRate) || 0,
      productType: productType || '',
      sizeRates: Array.isArray(sizeRates) ? sizeRates : [],
      status: status || 'Active',
      joinDate: joinDate || new Date().toISOString().split('T')[0],
      notes: notes || ''
    };

    runtimeStore.employees.unshift(newEmp);
    res.status(201).json({ success: true, data: newEmp });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Employee with this ID already exists' });
    }
    next(error);
  }
};

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Public
exports.updateEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const employee = await Employee.findByIdAndUpdate(id, req.body, {
        new: true,
        runValidators: true
      });
      if (!employee) {
        return res.status(404).json({ success: false, error: 'Employee not found' });
      }
      return res.json({ success: true, data: employee });
    }

    const index = runtimeStore.employees.findIndex((e) => e._id === id || e.id === id || e.empId === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    runtimeStore.employees[index] = { ...runtimeStore.employees[index], ...req.body };
    res.json({ success: true, data: runtimeStore.employees[index] });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle employee status (Active / Inactive)
// @route   PATCH /api/employees/:id/status
// @access  Public
exports.patchEmployeeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const employee = await Employee.findByIdAndUpdate(id, { status }, { new: true });
      if (!employee) {
        return res.status(404).json({ success: false, error: 'Employee not found' });
      }
      return res.json({ success: true, data: employee });
    }

    const employee = runtimeStore.employees.find((e) => e._id === id || e.id === id || e.empId === id);
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    employee.status = status;
    res.json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
};

exports.updateEmployeeStatus = exports.patchEmployeeStatus;
