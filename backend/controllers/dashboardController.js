const mongoose = require('mongoose');
const {
  Employee,
  ThreadPurchase,
  OilPurchase,
  MachineryExpense,
  ElectricityExpense,
  WeeklyPayroll
} = require('../models');
const runtimeStore = require('../utils/runtimeStore');

// Helper to reliably distinguish WITH_GST from WITHOUT_GST
const isWithGST = (gstMode) => {
  const m = String(gstMode || '').trim().toUpperCase();
  return m === 'WITH_GST' || m === 'WITH GST' || (m.includes('WITH') && !m.includes('WITHOUT'));
};

const isWithoutGST = (gstMode) => {
  const m = String(gstMode || '').trim().toUpperCase();
  return m === 'WITHOUT_GST' || m === 'WITHOUT GST' || m.includes('WITHOUT');
};

const safeDateStr = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
};

const getMonthIndex = (dateVal) => {
  if (!dateVal) return -1;
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? -1 : d.getMonth();
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// @desc    Get complete manufacturing dashboard summary KPIs
// @route   GET /api/dashboard/summary
// @access  Public
exports.getDashboardSummary = async (req, res, next) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;

    let totalEmployees = 0;
    let threadGSTTotal = 0;
    let threadNoGSTTotal = 0;
    let oilTotal = 0;
    let machineryTotal = 0;
    let electricityTotal = 0;
    let weeklySalaryTotal = 0;

    let totalPurchasesCount = 0;
    let totalProductionQty = 0;
    let totalLeaveDays = 0;
    let employeesPresentCount = 0;

    if (isDbConnected) {
      const [
        empCount,
        threadGST,
        threadNoGST,
        oilSum,
        machSum,
        elecSum,
        payrollSum,
        threadCount,
        oilCount,
        payrollStats
      ] = await Promise.all([
        Employee.countDocuments({ status: { $in: ['Active', 'ACTIVE'] } }),
        ThreadPurchase.aggregate([
          { $match: { gstMode: { $in: ['WITH_GST', 'With GST', 'with_gst', 'with gst'] } } },
          { $group: { _id: null, total: { $sum: '$total' } } }
        ]),
        ThreadPurchase.aggregate([
          { $match: { gstMode: { $in: ['WITHOUT_GST', 'Without GST', 'without_gst', 'without gst'] } } },
          { $group: { _id: null, total: { $sum: '$total' } } }
        ]),
        OilPurchase.aggregate([
          { $group: { _id: null, total: { $sum: { $ifNull: ['$final', { $ifNull: ['$total', '$cost'] }] } } } }
        ]),
        MachineryExpense.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
        ElectricityExpense.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
        WeeklyPayroll.aggregate([{ $group: { _id: null, total: { $sum: '$netPay' } } }]),
        ThreadPurchase.countDocuments(),
        OilPurchase.countDocuments(),
        WeeklyPayroll.aggregate([
          {
            $group: {
              _id: null,
              totalQty: { $sum: '$productsProduced' },
              totalLeave: { $sum: '$leaveDays' }
            }
          }
        ])
      ]);

      totalEmployees = empCount || 0;
      threadGSTTotal = threadGST[0]?.total || 0;
      threadNoGSTTotal = threadNoGST[0]?.total || 0;
      oilTotal = oilSum[0]?.total || 0;
      machineryTotal = machSum[0]?.total || 0;
      electricityTotal = elecSum[0]?.total || 0;
      weeklySalaryTotal = payrollSum[0]?.total || 0;

      totalPurchasesCount = (threadCount || 0) + (oilCount || 0);
      totalProductionQty = payrollStats[0]?.totalQty || 0;
      totalLeaveDays = payrollStats[0]?.totalLeave || 0;
      employeesPresentCount = totalEmployees;
    } else {
      // Dynamic calculation from real runtime records with strict GST filtering
      totalEmployees = runtimeStore.employees.filter(e => e.status === 'Active' || e.status === 'ACTIVE').length;
      threadGSTTotal = runtimeStore.threadPurchases
        .filter(t => isWithGST(t.gstMode))
        .reduce((sum, t) => sum + (Number(t.total) || 0), 0);
      threadNoGSTTotal = runtimeStore.threadPurchases
        .filter(t => isWithoutGST(t.gstMode))
        .reduce((sum, t) => sum + (Number(t.total) || 0), 0);
      oilTotal = runtimeStore.oilPurchases.reduce((sum, o) => sum + (Number(o.final !== undefined ? o.final : (o.total !== undefined ? o.total : o.cost)) || 0), 0);
      machineryTotal = runtimeStore.machineryExpenses.reduce((sum, m) => sum + (Number(m.total !== undefined ? m.total : m.cost) || 0), 0);
      electricityTotal = runtimeStore.electricityExpenses.reduce((sum, e) => sum + (Number(e.total !== undefined ? e.total : e.billAmount) || 0), 0);
      weeklySalaryTotal = runtimeStore.weeklyPayroll.reduce((sum, p) => sum + (Number(p.netPay !== undefined ? p.netPay : p.grossPay) || 0), 0);

      totalPurchasesCount = runtimeStore.threadPurchases.length + runtimeStore.oilPurchases.length;
      totalProductionQty = runtimeStore.weeklyPayroll.reduce((acc, p) => acc + (Number(p.productsProduced) || 0), 0);
      totalLeaveDays = runtimeStore.weeklyPayroll.reduce((acc, p) => acc + (Number(p.leaveDays) || 0), 0);
      employeesPresentCount = totalEmployees;
    }

    const totalRawMaterial = threadGSTTotal + threadNoGSTTotal + oilTotal;
    const estMonthlySalary = weeklySalaryTotal * 4;

    const keyStats = {
      totalPurchases: {
        count: totalPurchasesCount,
        trend: totalPurchasesCount > 0 ? '+Live' : '0%'
      },
      totalProduction: {
        count: `${totalProductionQty.toLocaleString('en-IN')} Pcs`,
        trend: totalProductionQty > 0 ? '+Live' : '0%'
      },
      employeesPresent: {
        count: employeesPresentCount,
        trend: `${employeesPresentCount} Active`
      },
      leaveDays: {
        count: totalLeaveDays,
        trend: `${totalLeaveDays} Days`
      }
    };

    return res.json({
      success: true,
      data: {
        kpis: {
          totalRawMaterial,
          totalRawMaterialTrend: { value: 'Live', type: 'neutral', period: 'Real-time calculation' },
          threadWithGST: threadGSTTotal,
          threadWithGSTTrend: { value: 'Live', type: 'neutral', period: 'Real-time calculation' },
          threadWithoutGST: threadNoGSTTotal,
          threadWithoutGSTTrend: { value: 'Live', type: 'neutral', period: 'Real-time calculation' },
          oilExpenses: oilTotal,
          oilExpensesTrend: { value: 'Live', type: 'neutral', period: 'Real-time calculation' },
          machineryCost: machineryTotal,
          machineryCostTrend: { value: 'Live', type: 'neutral', period: 'Real-time calculation' },
          electricityCost: electricityTotal,
          electricityCostTrend: { value: 'Live', type: 'neutral', period: 'Real-time calculation' },
          weeklySalary: weeklySalaryTotal,
          weeklySalaryTrend: { value: 'Live', type: 'neutral', period: 'Real-time calculation' },
          estMonthlySalary,
          estMonthlySalaryTrend: { value: 'Live', type: 'neutral', period: 'Real-time calculation' },
          totalEmployees,
          totalEmployeesTrend: { value: `${totalEmployees} Active`, type: 'up', period: 'current' }
        },
        keyStats
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get live dynamic expense comparison and breakup charts data
// @route   GET /api/dashboard/expenses
// @access  Public
exports.getDashboardExpenses = async (req, res, next) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;

    let threadGSTTotal = 0;
    let threadNoGSTTotal = 0;
    let oilTotal = 0;
    let machineryTotal = 0;
    let electricityTotal = 0;
    let salaryTotal = 0;

    // Monthly buckets for the year
    const monthlyBuckets = MONTH_NAMES.map(m => ({
      month: m,
      rawMaterial: 0,
      machinery: 0,
      electricity: 0,
      salary: 0,
      weekly: 0,
      monthly: 0
    }));

    const currentMonthIdx = new Date().getMonth();

    if (isDbConnected) {
      const [
        threads,
        oils,
        machineryExpenses,
        electricityExpenses,
        weeklyPayrolls
      ] = await Promise.all([
        ThreadPurchase.find().lean(),
        OilPurchase.find().lean(),
        MachineryExpense.find().lean(),
        ElectricityExpense.find().lean(),
        WeeklyPayroll.find().lean()
      ]);

      threads.forEach(t => {
        const amt = Number(t.total) || 0;
        if (isWithGST(t.gstMode)) threadGSTTotal += amt;
        else if (isWithoutGST(t.gstMode)) threadNoGSTTotal += amt;
        else threadGSTTotal += amt;

        const mIdx = getMonthIndex(t.date || t.createdAt);
        if (mIdx >= 0 && mIdx < 12) {
          monthlyBuckets[mIdx].rawMaterial += amt;
          monthlyBuckets[mIdx].monthly += amt;
        }
      });

      oils.forEach(o => {
        const amt = Number(o.final !== undefined ? o.final : (o.total !== undefined ? o.total : o.cost)) || 0;
        oilTotal += amt;
        const mIdx = getMonthIndex(o.date || o.createdAt);
        if (mIdx >= 0 && mIdx < 12) {
          monthlyBuckets[mIdx].rawMaterial += amt;
          monthlyBuckets[mIdx].monthly += amt;
        }
      });

      machineryExpenses.forEach(m => {
        const amt = Number(m.total !== undefined ? m.total : m.cost) || 0;
        machineryTotal += amt;
        const mIdx = getMonthIndex(m.date || m.createdAt);
        if (mIdx >= 0 && mIdx < 12) {
          monthlyBuckets[mIdx].machinery += amt;
          monthlyBuckets[mIdx].monthly += amt;
        }
      });

      electricityExpenses.forEach(e => {
        const amt = Number(e.total !== undefined ? e.total : e.billAmount) || 0;
        electricityTotal += amt;
        const mIdx = getMonthIndex(e.billDate || e.date || e.createdAt);
        if (mIdx >= 0 && mIdx < 12) {
          monthlyBuckets[mIdx].electricity += amt;
          monthlyBuckets[mIdx].monthly += amt;
        }
      });

      weeklyPayrolls.forEach(p => {
        const amt = Number(p.netPay !== undefined ? p.netPay : p.grossPay) || 0;
        salaryTotal += amt;
        const mIdx = getMonthIndex(p.weekEnd || p.workDate || p.createdAt);
        if (mIdx >= 0 && mIdx < 12) {
          monthlyBuckets[mIdx].salary += amt;
          monthlyBuckets[mIdx].weekly += amt;
          monthlyBuckets[mIdx].monthly += amt;
        }
      });
    } else {
      runtimeStore.threadPurchases.forEach(t => {
        const amt = Number(t.total) || 0;
        if (isWithGST(t.gstMode)) threadGSTTotal += amt;
        else if (isWithoutGST(t.gstMode)) threadNoGSTTotal += amt;
        else threadGSTTotal += amt;

        const mIdx = getMonthIndex(t.date || t.createdAt);
        if (mIdx >= 0 && mIdx < 12) {
          monthlyBuckets[mIdx].rawMaterial += amt;
          monthlyBuckets[mIdx].monthly += amt;
        }
      });

      runtimeStore.oilPurchases.forEach(o => {
        const amt = Number(o.final !== undefined ? o.final : (o.total !== undefined ? o.total : o.cost)) || 0;
        oilTotal += amt;
        const mIdx = getMonthIndex(o.date || o.createdAt);
        if (mIdx >= 0 && mIdx < 12) {
          monthlyBuckets[mIdx].rawMaterial += amt;
          monthlyBuckets[mIdx].monthly += amt;
        }
      });

      runtimeStore.machineryExpenses.forEach(m => {
        const amt = Number(m.total !== undefined ? m.total : m.cost) || 0;
        machineryTotal += amt;
        const mIdx = getMonthIndex(m.date || m.createdAt);
        if (mIdx >= 0 && mIdx < 12) {
          monthlyBuckets[mIdx].machinery += amt;
          monthlyBuckets[mIdx].monthly += amt;
        }
      });

      runtimeStore.electricityExpenses.forEach(e => {
        const amt = Number(e.total !== undefined ? e.total : e.billAmount) || 0;
        electricityTotal += amt;
        const mIdx = getMonthIndex(e.billDate || e.date || e.createdAt);
        if (mIdx >= 0 && mIdx < 12) {
          monthlyBuckets[mIdx].electricity += amt;
          monthlyBuckets[mIdx].monthly += amt;
        }
      });

      runtimeStore.weeklyPayroll.forEach(p => {
        const amt = Number(p.netPay !== undefined ? p.netPay : p.grossPay) || 0;
        salaryTotal += amt;
        const mIdx = getMonthIndex(p.weekEnd || p.workDate || p.createdAt);
        if (mIdx >= 0 && mIdx < 12) {
          monthlyBuckets[mIdx].salary += amt;
          monthlyBuckets[mIdx].weekly += amt;
          monthlyBuckets[mIdx].monthly += amt;
        }
      });
    }

    const rawMaterialTotal = threadGSTTotal + threadNoGSTTotal + oilTotal;
    const totalExpenses = rawMaterialTotal + machineryTotal + electricityTotal + salaryTotal;
    const calcPercent = (amt) => (totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0);

    const expenseBreakup = [
      { name: 'Raw Materials', value: calcPercent(rawMaterialTotal), amount: rawMaterialTotal, color: '#2563eb' },
      { name: 'Thread (GST)', value: calcPercent(threadGSTTotal), amount: threadGSTTotal, color: '#06b6d4' },
      { name: 'Thread (Without GST)', value: calcPercent(threadNoGSTTotal), amount: threadNoGSTTotal, color: '#3b82f6' },
      { name: 'Oil', value: calcPercent(oilTotal), amount: oilTotal, color: '#f59e0b' },
      { name: 'Machinery', value: calcPercent(machineryTotal), amount: machineryTotal, color: '#10b981' },
      { name: 'Electricity', value: calcPercent(electricityTotal), amount: electricityTotal, color: '#f97316' },
      { name: 'Salary', value: calcPercent(salaryTotal), amount: salaryTotal, color: '#8b5cf6' }
    ];

    const currentMonthExpenses = monthlyBuckets[currentMonthIdx]?.monthly || 0;
    const totalExpensesThisMonth = currentMonthExpenses > 0 ? currentMonthExpenses : totalExpenses;

    const expenseComparison = monthlyBuckets.map(b => ({
      month: b.month,
      weekly: Math.round(b.weekly),
      monthly: Math.round(b.monthly)
    }));

    const monthlyTrend = monthlyBuckets.map(b => ({
      month: b.month,
      rawMaterial: Math.round(b.rawMaterial),
      machinery: Math.round(b.machinery),
      electricity: Math.round(b.electricity),
      salary: Math.round(b.salary)
    }));

    res.json({
      success: true,
      data: {
        totalExpensesThisMonth,
        expenseComparison,
        expenseBreakup,
        trend: monthlyTrend,
        monthlyTrend
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get live recent transactions directly from Database or Runtime Store
// @route   GET /api/dashboard/recent-transactions
// @access  Public
exports.getRecentTransactions = async (req, res, next) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;
    const formatted = [];

    if (isDbConnected) {
      const [threads, oils, machinery, electricity, payrolls] = await Promise.all([
        ThreadPurchase.find().sort({ date: -1, createdAt: -1 }).limit(10).lean(),
        OilPurchase.find().sort({ date: -1, createdAt: -1 }).limit(10).lean(),
        MachineryExpense.find().sort({ date: -1, createdAt: -1 }).limit(10).lean(),
        ElectricityExpense.find().sort({ billDate: -1, createdAt: -1 }).limit(10).lean(),
        WeeklyPayroll.find().sort({ weekEnd: -1, createdAt: -1 }).limit(10).lean()
      ]);

      threads.forEach((t) => {
        formatted.push({
          id: t._id,
          date: safeDateStr(t.date || t.createdAt),
          category: isWithoutGST(t.gstMode) ? 'Thread (Without GST)' : 'Thread (GST)',
          desc: `${t.supplier || 'Supplier'} - ${t.threadType || 'Yarn'} ${t.qty || 0} ${t.unit || 'Kg'}`,
          refNo: t.invoiceNo || `TP-${String(t._id).slice(-4)}`,
          amount: Number(t.total) || 0,
          status: t.status || 'Paid'
        });
      });

      oils.forEach((o) => {
        formatted.push({
          id: o._id,
          date: safeDateStr(o.date || o.createdAt),
          category: 'Oil',
          desc: `${o.oilType || 'Machine Oil'} ${o.qty || 0} ${o.unit || 'Ltr'}`,
          refNo: o.invoiceNo || `OIL-${String(o._id).slice(-4)}`,
          amount: Number(o.final !== undefined ? o.final : (o.total !== undefined ? o.total : o.cost)) || 0,
          status: o.status || 'Paid'
        });
      });

      machinery.forEach((m) => {
        formatted.push({
          id: m._id,
          date: safeDateStr(m.date || m.createdAt),
          category: 'Machinery',
          desc: `${m.machine || 'Machine'} - ${m.desc || m.category || 'Repair'}`,
          refNo: m.machineId || m.invoiceNo || `MC-${String(m._id).slice(-4)}`,
          amount: Number(m.total !== undefined ? m.total : m.cost) || 0,
          status: m.status || 'Paid'
        });
      });

      electricity.forEach((e) => {
        formatted.push({
          id: e._id,
          date: safeDateStr(e.billDate || e.date || e.createdAt),
          category: 'Electricity',
          desc: `${e.month || 'Monthly'} Bill (${e.units || 0} Units)`,
          refNo: e.consumerNo || `EB-${String(e._id).slice(-4)}`,
          amount: Number(e.total !== undefined ? e.total : e.billAmount) || 0,
          status: e.status || 'Pending'
        });
      });

      payrolls.forEach((p) => {
        formatted.push({
          id: p._id,
          date: safeDateStr(p.weekEnd || p.workDate || p.createdAt),
          category: 'Salary',
          desc: `Weekly Salary - ${p.employeeName || p.empId}`,
          refNo: `SAL-${p.empId || String(p._id).slice(-4)}`,
          amount: Number(p.netPay !== undefined ? p.netPay : p.grossPay) || 0,
          status: p.status || 'Pending'
        });
      });
    } else {
      runtimeStore.threadPurchases.forEach((t) => {
        formatted.push({
          id: t._id || t.id,
          date: safeDateStr(t.date || t.createdAt),
          category: isWithoutGST(t.gstMode) ? 'Thread (Without GST)' : 'Thread (GST)',
          desc: `${t.supplier || 'Supplier'} - ${t.threadType || 'Yarn'} ${t.qty || 0} ${t.unit || 'Kg'}`,
          refNo: t.invoiceNo || `TP-${String(t.id || t._id || '').slice(-4)}`,
          amount: Number(t.total) || 0,
          status: t.status || 'Paid'
        });
      });

      runtimeStore.oilPurchases.forEach((o) => {
        formatted.push({
          id: o._id || o.id,
          date: safeDateStr(o.date || o.createdAt),
          category: 'Oil',
          desc: `${o.oilType || 'Machine Oil'} ${o.qty || 0} ${o.unit || 'Ltr'}`,
          refNo: o.invoiceNo || `OIL-${String(o.id || o._id || '').slice(-4)}`,
          amount: Number(o.final !== undefined ? o.final : (o.total !== undefined ? o.total : o.cost)) || 0,
          status: o.status || 'Paid'
        });
      });

      runtimeStore.machineryExpenses.forEach((m) => {
        formatted.push({
          id: m._id || m.id,
          date: safeDateStr(m.date || m.createdAt),
          category: 'Machinery',
          desc: `${m.machine || 'Machine'} - ${m.desc || m.category || 'Repair'}`,
          refNo: m.machineId || m.invoiceNo || `MC-${String(m.id || m._id || '').slice(-4)}`,
          amount: Number(m.total !== undefined ? m.total : m.cost) || 0,
          status: m.status || 'Paid'
        });
      });

      runtimeStore.electricityExpenses.forEach((e) => {
        formatted.push({
          id: e._id || e.id,
          date: safeDateStr(e.billDate || e.date || e.createdAt),
          category: 'Electricity',
          desc: `${e.month || 'Monthly'} Bill (${e.units || 0} Units)`,
          refNo: e.consumerNo || `EB-${String(e.id || e._id || '').slice(-4)}`,
          amount: Number(e.total !== undefined ? e.total : e.billAmount) || 0,
          status: e.status || 'Pending'
        });
      });

      runtimeStore.weeklyPayroll.forEach((p) => {
        formatted.push({
          id: p._id || p.id,
          date: safeDateStr(p.weekEnd || p.workDate || p.createdAt),
          category: 'Salary',
          desc: `Weekly Salary - ${p.employeeName || p.empId}`,
          refNo: `SAL-${p.empId || String(p.id || p._id || '').slice(-4)}`,
          amount: Number(p.netPay !== undefined ? p.netPay : p.grossPay) || 0,
          status: p.status || 'Pending'
        });
      });
    }

    formatted.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    res.json({
      success: true,
      count: formatted.length,
      data: formatted.slice(0, 10)
    });
  } catch (error) {
    next(error);
  }
};
