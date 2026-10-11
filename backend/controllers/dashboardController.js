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

    if (isDbConnected) {
      const [
        empCount,
        threadGST,
        threadNoGST,
        oilSum,
        machSum,
        elecSum,
        payrollSum
      ] = await Promise.all([
        Employee.countDocuments({ status: { $in: ['Active', 'ACTIVE'] } }),
        ThreadPurchase.aggregate([
          { $match: { gstMode: { $in: ['WITH_GST', 'With GST'] } } },
          { $group: { _id: null, total: { $sum: '$total' } } }
        ]),
        ThreadPurchase.aggregate([
          { $match: { gstMode: { $in: ['WITHOUT_GST', 'Without GST'] } } },
          { $group: { _id: null, total: { $sum: '$total' } } }
        ]),
        OilPurchase.aggregate([{ $group: { _id: null, total: { $sum: '$final' } } }]),
        MachineryExpense.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
        ElectricityExpense.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
        WeeklyPayroll.aggregate([{ $group: { _id: null, total: { $sum: '$netPay' } } }])
      ]);

      totalEmployees = empCount || 0;
      threadGSTTotal = threadGST[0]?.total || 0;
      threadNoGSTTotal = threadNoGST[0]?.total || 0;
      oilTotal = oilSum[0]?.total || 0;
      machineryTotal = machSum[0]?.total || 0;
      electricityTotal = elecSum[0]?.total || 0;
      weeklySalaryTotal = payrollSum[0]?.total || 0;
    } else {
      // Dynamic calculation from real runtime records
      totalEmployees = runtimeStore.employees.filter(e => e.status === 'Active').length;
      threadGSTTotal = runtimeStore.threadPurchases
        .filter(t => (t.gstMode || '').includes('WITH_GST') || (t.gstMode || '').includes('With GST'))
        .reduce((sum, t) => sum + (t.total || 0), 0);
      threadNoGSTTotal = runtimeStore.threadPurchases
        .filter(t => (t.gstMode || '').includes('WITHOUT'))
        .reduce((sum, t) => sum + (t.total || 0), 0);
      oilTotal = runtimeStore.oilPurchases.reduce((sum, o) => sum + (o.final || o.cost || 0), 0);
      machineryTotal = runtimeStore.machineryExpenses.reduce((sum, m) => sum + (m.total || 0), 0);
      electricityTotal = runtimeStore.electricityExpenses.reduce((sum, e) => sum + (e.total || 0), 0);
      weeklySalaryTotal = runtimeStore.weeklyPayroll.reduce((sum, p) => sum + (p.netPay || 0), 0);
    }

    const totalRawMaterial = threadGSTTotal + threadNoGSTTotal + oilTotal;
    const estMonthlySalary = weeklySalaryTotal * 4;

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
        }
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

    if (isDbConnected) {
      const [
        threadGST,
        threadNoGST,
        oilPurchases,
        machineryExpenses,
        electricityExpenses,
        weeklyPayrolls
      ] = await Promise.all([
        ThreadPurchase.aggregate([
          { $match: { gstMode: { $in: ['WITH_GST', 'With GST'] } } },
          { $group: { _id: null, total: { $sum: '$total' } } }
        ]),
        ThreadPurchase.aggregate([
          { $match: { gstMode: { $in: ['WITHOUT_GST', 'Without GST'] } } },
          { $group: { _id: null, total: { $sum: '$total' } } }
        ]),
        OilPurchase.aggregate([{ $group: { _id: null, total: { $sum: '$final' } } }]),
        MachineryExpense.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
        ElectricityExpense.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
        WeeklyPayroll.aggregate([{ $group: { _id: null, total: { $sum: '$netPay' } } }])
      ]);

      threadGSTTotal = threadGST[0]?.total || 0;
      threadNoGSTTotal = threadNoGST[0]?.total || 0;
      oilTotal = oilPurchases[0]?.total || 0;
      machineryTotal = machineryExpenses[0]?.total || 0;
      electricityTotal = electricityExpenses[0]?.total || 0;
      salaryTotal = weeklyPayrolls[0]?.total || 0;
    } else {
      threadGSTTotal = runtimeStore.threadPurchases
        .filter(t => (t.gstMode || '').includes('WITH_GST') || (t.gstMode || '').includes('With GST'))
        .reduce((sum, t) => sum + (t.total || 0), 0);
      threadNoGSTTotal = runtimeStore.threadPurchases
        .filter(t => (t.gstMode || '').includes('WITHOUT'))
        .reduce((sum, t) => sum + (t.total || 0), 0);
      oilTotal = runtimeStore.oilPurchases.reduce((sum, o) => sum + (o.final || o.cost || 0), 0);
      machineryTotal = runtimeStore.machineryExpenses.reduce((sum, m) => sum + (m.total || 0), 0);
      electricityTotal = runtimeStore.electricityExpenses.reduce((sum, e) => sum + (e.total || 0), 0);
      salaryTotal = runtimeStore.weeklyPayroll.reduce((sum, p) => sum + (p.netPay || 0), 0);
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

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthIdx = new Date().getMonth();
    const currentMonthName = months[currentMonthIdx];

    const expenseComparison = months.slice(0, currentMonthIdx + 1).map((m) => {
      const isCurrent = m === currentMonthName;
      return {
        month: m,
        weekly: isCurrent ? salaryTotal : 0,
        monthly: isCurrent ? totalExpenses : 0
      };
    });

    res.json({
      success: true,
      data: {
        totalExpensesThisMonth: totalExpenses,
        expenseComparison,
        expenseBreakup
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
        ThreadPurchase.find().sort({ date: -1, createdAt: -1 }).limit(3).lean(),
        OilPurchase.find().sort({ date: -1, createdAt: -1 }).limit(3).lean(),
        MachineryExpense.find().sort({ date: -1, createdAt: -1 }).limit(3).lean(),
        ElectricityExpense.find().sort({ billDate: -1, createdAt: -1 }).limit(3).lean(),
        WeeklyPayroll.find().sort({ weekStart: -1, createdAt: -1 }).limit(3).lean()
      ]);

      threads.forEach((t) => {
        formatted.push({
          id: t._id,
          date: t.date ? new Date(t.date).toISOString().split('T')[0] : '',
          category: t.gstMode?.includes('WITHOUT') ? 'Thread (Without GST)' : 'Thread (GST)',
          desc: `${t.supplier || 'Supplier'} - ${t.threadType || 'Yarn'} ${t.qty || 0} ${t.unit || 'Kg'}`,
          refNo: t.invoiceNo || `TP-${String(t._id).slice(-4)}`,
          amount: t.total || 0,
          status: t.status || 'Paid'
        });
      });

      oils.forEach((o) => {
        formatted.push({
          id: o._id,
          date: o.date ? new Date(o.date).toISOString().split('T')[0] : '',
          category: 'Oil',
          desc: `${o.oilType || 'Machine Oil'} ${o.qty || 0} ${o.unit || 'Ltr'}`,
          refNo: o.invoiceNo || `OIL-${String(o._id).slice(-4)}`,
          amount: o.final || o.cost || 0,
          status: o.status || 'Paid'
        });
      });

      machinery.forEach((m) => {
        formatted.push({
          id: m._id,
          date: m.date ? new Date(m.date).toISOString().split('T')[0] : '',
          category: 'Machinery',
          desc: `${m.machine || 'Machine'} - ${m.desc || m.category || 'Repair'}`,
          refNo: m.machineId || `MC-${String(m._id).slice(-4)}`,
          amount: m.total || 0,
          status: m.status || 'Paid'
        });
      });

      electricity.forEach((e) => {
        formatted.push({
          id: e._id,
          date: e.billDate ? new Date(e.billDate).toISOString().split('T')[0] : '',
          category: 'Electricity',
          desc: `${e.month || 'Monthly'} Bill (${e.units || 0} Units)`,
          refNo: `EB-${String(e._id).slice(-4)}`,
          amount: e.total || 0,
          status: e.status || 'Pending'
        });
      });

      payrolls.forEach((p) => {
        formatted.push({
          id: p._id,
          date: p.weekEnd ? new Date(p.weekEnd).toISOString().split('T')[0] : '',
          category: 'Salary',
          desc: `Weekly Salary - ${p.employeeName || p.empId}`,
          refNo: `SAL-${p.empId}`,
          amount: p.netPay || 0,
          status: p.status || 'Pending'
        });
      });
    } else {
      runtimeStore.threadPurchases.slice(0, 3).forEach((t) => {
        formatted.push({
          id: t._id || t.id,
          date: t.date || '',
          category: t.gstMode?.includes('WITHOUT') ? 'Thread (Without GST)' : 'Thread (GST)',
          desc: `${t.supplier || 'Supplier'} - ${t.threadType || 'Yarn'} ${t.qty || 0} ${t.unit || 'Kg'}`,
          refNo: t.invoiceNo || 'TP',
          amount: t.total || 0,
          status: t.status || 'Paid'
        });
      });

      runtimeStore.oilPurchases.slice(0, 3).forEach((o) => {
        formatted.push({
          id: o._id || o.id,
          date: o.date || '',
          category: 'Oil',
          desc: `${o.oilType || 'Machine Oil'} ${o.qty || 0} ${o.unit || 'Ltr'}`,
          refNo: o.invoiceNo || 'OIL',
          amount: o.final || o.cost || 0,
          status: o.status || 'Paid'
        });
      });

      runtimeStore.machineryExpenses.slice(0, 3).forEach((m) => {
        formatted.push({
          id: m._id || m.id,
          date: m.date || '',
          category: 'Machinery',
          desc: `${m.machine || 'Machine'} - ${m.desc || m.category || 'Repair'}`,
          refNo: m.machineId || 'MC',
          amount: m.total || 0,
          status: m.status || 'Paid'
        });
      });

      runtimeStore.electricityExpenses.slice(0, 3).forEach((e) => {
        formatted.push({
          id: e._id || e.id,
          date: e.billDate || '',
          category: 'Electricity',
          desc: `${e.month || 'Monthly'} Bill (${e.units || 0} Units)`,
          refNo: 'EB',
          amount: e.total || 0,
          status: e.status || 'Pending'
        });
      });

      runtimeStore.weeklyPayroll.slice(0, 3).forEach((p) => {
        formatted.push({
          id: p._id || p.id,
          date: p.weekEnd || '',
          category: 'Salary',
          desc: `Weekly Salary - ${p.employeeName || p.empId}`,
          refNo: `SAL-${p.empId}`,
          amount: p.netPay || 0,
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
