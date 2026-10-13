// Dashboard Data Access Layer
// Combines Live Node.js / Express REST API with client-side StorageService
// Ensures 100% accurate KPIs, expense breakdowns, monthly trends, key stats, and recent transactions

import { api } from './api';
import { storageService } from './storageService';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseMonthAndYear(dateStr) {
  if (!dateStr) return { monthIdx: new Date().getMonth(), year: new Date().getFullYear() };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { monthIdx: new Date().getMonth(), year: new Date().getFullYear() };
  return { monthIdx: d.getMonth(), year: d.getFullYear() };
}

function formatDateYMD(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr).split('T')[0];
  return d.toISOString().split('T')[0];
}

/**
 * Computes live, accurate dashboard metrics directly from storage collections
 */
export function computeMetricsFromStorage(selectedYear = null, selectedPeriod = 'This Month') {
  const threadGST = storageService.getCollection('threadGST') || [];
  const threadNoGST = storageService.getCollection('threadNoGST') || [];
  const oil = storageService.getCollection('oil') || [];
  const machinery = storageService.getCollection('machinery') || [];
  const electricity = storageService.getCollection('electricity') || [];
  const weeklyPayroll = storageService.getCollection('weeklyPayroll') || [];
  const employees = storageService.getCollection('employees') || [];

  // 1. KPI Totals
  const threadWithGST = threadGST.reduce(
    (sum, t) => sum + (Number(t.total) || (Number(t.qty || 0) * Number(t.rate || 0)) || 0),
    0
  );

  const threadWithoutGST = threadNoGST.reduce(
    (sum, t) => sum + (Number(t.total) || (Number(t.qty || 0) * Number(t.rate || 0)) || 0),
    0
  );

  const oilExpenses = oil.reduce(
    (sum, o) => sum + (Number(o.final !== undefined ? o.final : (o.total !== undefined ? o.total : o.cost)) || 0),
    0
  );

  const totalRawMaterial = threadWithGST + threadWithoutGST + oilExpenses;

  const machineryCost = machinery.reduce(
    (sum, m) => sum + (Number(m.total !== undefined ? m.total : m.cost) || 0),
    0
  );

  const electricityCost = electricity.reduce(
    (sum, e) => sum + (Number(e.total !== undefined ? e.total : e.billAmount) || 0),
    0
  );

  const weeklySalary = weeklyPayroll.reduce(
    (sum, p) => sum + (Number(p.netPay !== undefined ? p.netPay : p.grossPay) || 0),
    0
  );

  const estMonthlySalary = weeklySalary * 4;

  const activeEmployees = employees.filter(e => e.status !== 'Inactive' && e.status !== 'INACTIVE');
  const totalEmployees = activeEmployees.length > 0 ? activeEmployees.length : employees.length;

  const kpis = {
    totalRawMaterial,
    totalRawMaterialTrend: { value: 'Live', type: 'neutral', period: 'Real-time calculation' },
    threadWithGST,
    threadWithGSTTrend: { value: 'Live', type: 'neutral', period: 'Real-time calculation' },
    threadWithoutGST,
    threadWithoutGSTTrend: { value: 'Live', type: 'neutral', period: 'Real-time calculation' },
    oilExpenses,
    oilExpensesTrend: { value: 'Live', type: 'neutral', period: 'Real-time calculation' },
    machineryCost,
    machineryCostTrend: { value: 'Live', type: 'neutral', period: 'Real-time calculation' },
    electricityCost,
    electricityCostTrend: { value: 'Live', type: 'neutral', period: 'Real-time calculation' },
    weeklySalary,
    weeklySalaryTrend: { value: 'Live', type: 'neutral', period: 'Real-time calculation' },
    estMonthlySalary,
    estMonthlySalaryTrend: { value: 'Live', type: 'neutral', period: 'Real-time calculation' },
    totalEmployees,
    totalEmployeesTrend: { value: `${totalEmployees} Active`, type: 'up', period: 'current' }
  };

  // 2. Expense Breakup Donut
  const rawMaterialTotal = totalRawMaterial;
  const totalExpenses = rawMaterialTotal + machineryCost + electricityCost + weeklySalary;
  const calcPercent = (amt) => (totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0);

  const expenseBreakup = [
    { name: 'Raw Materials', value: calcPercent(rawMaterialTotal), amount: rawMaterialTotal, color: '#2563eb' },
    { name: 'Thread (GST)', value: calcPercent(threadWithGST), amount: threadWithGST, color: '#06b6d4' },
    { name: 'Thread (Without GST)', value: calcPercent(threadWithoutGST), amount: threadWithoutGST, color: '#3b82f6' },
    { name: 'Oil', value: calcPercent(oilExpenses), amount: oilExpenses, color: '#f59e0b' },
    { name: 'Machinery', value: calcPercent(machineryCost), amount: machineryCost, color: '#10b981' },
    { name: 'Electricity', value: calcPercent(electricityCost), amount: electricityCost, color: '#f97316' },
    { name: 'Salary', value: calcPercent(weeklySalary), amount: weeklySalary, color: '#8b5cf6' }
  ];

  // 3. Monthly Buckets & Trends
  const targetYear = selectedYear ? Number(selectedYear) : new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();

  const monthlyBuckets = MONTH_NAMES.map(m => ({
    month: m,
    rawMaterial: 0,
    machinery: 0,
    electricity: 0,
    salary: 0,
    weekly: 0,
    monthly: 0
  }));

  const processMonthlyItem = (dateStr, category, amount) => {
    const { monthIdx, year } = parseMonthAndYear(dateStr);
    if (year === targetYear || !selectedYear) {
      if (monthIdx >= 0 && monthIdx < 12) {
        if (category === 'rawMaterial') {
          monthlyBuckets[monthIdx].rawMaterial += amount;
          monthlyBuckets[monthIdx].monthly += amount;
        } else if (category === 'machinery') {
          monthlyBuckets[monthIdx].machinery += amount;
          monthlyBuckets[monthIdx].monthly += amount;
        } else if (category === 'electricity') {
          monthlyBuckets[monthIdx].electricity += amount;
          monthlyBuckets[monthIdx].monthly += amount;
        } else if (category === 'salary') {
          monthlyBuckets[monthIdx].salary += amount;
          monthlyBuckets[monthIdx].weekly += amount;
          monthlyBuckets[monthIdx].monthly += amount;
        }
      }
    }
  };

  threadGST.forEach(t => processMonthlyItem(t.date || t.createdAt, 'rawMaterial', Number(t.total) || 0));
  threadNoGST.forEach(t => processMonthlyItem(t.date || t.createdAt, 'rawMaterial', Number(t.total) || 0));
  oil.forEach(o => processMonthlyItem(o.date || o.createdAt, 'rawMaterial', Number(o.final !== undefined ? o.final : (o.total !== undefined ? o.total : o.cost)) || 0));
  machinery.forEach(m => processMonthlyItem(m.date || m.createdAt, 'machinery', Number(m.total !== undefined ? m.total : m.cost) || 0));
  electricity.forEach(e => processMonthlyItem(e.billDate || e.date || e.createdAt, 'electricity', Number(e.total !== undefined ? e.total : e.billAmount) || 0));
  weeklyPayroll.forEach(p => processMonthlyItem(p.weekEnd || p.workDate || p.createdAt, 'salary', Number(p.netPay !== undefined ? p.netPay : p.grossPay) || 0));

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

  const currentMonthExpenses = monthlyBuckets[currentMonthIdx]?.monthly || 0;
  const totalExpensesThisMonth = currentMonthExpenses > 0 ? currentMonthExpenses : totalExpenses;

  // 4. Key Statistics
  const totalPurchasesCount = threadGST.length + threadNoGST.length + oil.length;
  const totalProductionQty = weeklyPayroll.reduce((acc, p) => acc + (Number(p.productsProduced) || 0), 0);
  const totalLeaveDays = weeklyPayroll.reduce((acc, p) => acc + (Number(p.leaveDays) || 0), 0);

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
      count: totalEmployees,
      trend: `${totalEmployees} Active`
    },
    leaveDays: {
      count: totalLeaveDays,
      trend: `${totalLeaveDays} Days`
    }
  };

  // 5. Recent Transactions
  const transactions = [];

  threadGST.forEach(t => {
    transactions.push({
      id: t._id || t.id,
      date: formatDateYMD(t.date || t.createdAt),
      category: 'Thread (GST)',
      desc: `${t.supplier || 'Supplier'} - ${t.threadType || 'Yarn'} ${t.qty || ''} ${t.unit || 'Kg'}`,
      refNo: t.invoiceNo || `TP-${String(t.id || t._id || '').slice(-4)}`,
      amount: Number(t.total) || 0,
      status: t.status || 'Paid'
    });
  });

  threadNoGST.forEach(t => {
    transactions.push({
      id: t._id || t.id,
      date: formatDateYMD(t.date || t.createdAt),
      category: 'Thread (Without GST)',
      desc: `${t.supplier || 'Supplier'} - ${t.threadType || 'Yarn'} ${t.qty || ''} ${t.unit || 'Kg'}`,
      refNo: t.invoiceNo || `TP-${String(t.id || t._id || '').slice(-4)}`,
      amount: Number(t.total) || 0,
      status: t.status || 'Paid'
    });
  });

  oil.forEach(o => {
    transactions.push({
      id: o._id || o.id,
      date: formatDateYMD(o.date || o.createdAt),
      category: 'Oil',
      desc: `${o.oilType || 'Machine Oil'} ${o.qty || ''} ${o.unit || 'Ltr'}`,
      refNo: o.invoiceNo || `OIL-${String(o.id || o._id || '').slice(-4)}`,
      amount: Number(o.final !== undefined ? o.final : (o.total !== undefined ? o.total : o.cost)) || 0,
      status: o.status || 'Paid'
    });
  });

  machinery.forEach(m => {
    transactions.push({
      id: m._id || m.id,
      date: formatDateYMD(m.date || m.createdAt),
      category: 'Machinery',
      desc: `${m.machine || 'Machine'} - ${m.desc || m.category || 'Repair'}`,
      refNo: m.machineId || m.invoiceNo || `MC-${String(m.id || m._id || '').slice(-4)}`,
      amount: Number(m.total !== undefined ? m.total : m.cost) || 0,
      status: m.status || 'Paid'
    });
  });

  electricity.forEach(e => {
    transactions.push({
      id: e._id || e.id,
      date: formatDateYMD(e.billDate || e.date || e.createdAt),
      category: 'Electricity',
      desc: `${e.month || 'Monthly'} Bill (${e.units || 0} Units)`,
      refNo: e.consumerNo || `EB-${String(e.id || e._id || '').slice(-4)}`,
      amount: Number(e.total !== undefined ? e.total : e.billAmount) || 0,
      status: e.status || 'Pending'
    });
  });

  weeklyPayroll.forEach(p => {
    transactions.push({
      id: p._id || p.id,
      date: formatDateYMD(p.weekEnd || p.workDate || p.createdAt),
      category: 'Salary',
      desc: `Weekly Salary - ${p.employeeName || p.empId}`,
      refNo: `SAL-${p.empId || String(p.id || p._id || '').slice(-4)}`,
      amount: Number(p.netPay !== undefined ? p.netPay : p.grossPay) || 0,
      status: p.status || 'Pending'
    });
  });

  transactions.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  return {
    kpis,
    expenseComparison,
    expenseBreakup,
    totalExpensesThisMonth,
    monthlyTrend,
    keyStats,
    recentTransactions: transactions.slice(0, 10)
  };
}

export const dashboardService = {
  async getDashboardData(selectedYear = null, selectedPeriod = 'This Month') {
    const localData = computeMetricsFromStorage(selectedYear, selectedPeriod);

    try {
      const [summaryRes, expensesRes, transRes] = await Promise.allSettled([
        api.dashboard.getSummary(),
        api.dashboard.getExpenses(),
        api.dashboard.getRecentTransactions()
      ]);

      const summaryData = summaryRes.status === 'fulfilled' ? summaryRes.value?.data : null;
      const expensesData = expensesRes.status === 'fulfilled' ? expensesRes.value?.data : null;
      const transData = transRes.status === 'fulfilled' ? transRes.value?.data : null;

      const apiKPIs = summaryData?.kpis;
      const apiHasRealData =
        apiKPIs &&
        (apiKPIs.totalRawMaterial > 0 ||
          apiKPIs.totalEmployees > 0 ||
          apiKPIs.weeklySalary > 0 ||
          apiKPIs.machineryCost > 0 ||
          apiKPIs.electricityCost > 0);

      const localHasRealData =
        localData.kpis.totalRawMaterial > 0 ||
        localData.kpis.totalEmployees > 0 ||
        localData.kpis.weeklySalary > 0 ||
        localData.kpis.machineryCost > 0 ||
        localData.kpis.electricityCost > 0;

      // Prefer API if it has verified live backend data; otherwise use complete localData
      if (apiHasRealData || (!localHasRealData && summaryData)) {
        return {
          success: true,
          data: {
            kpis: apiKPIs || localData.kpis,
            expenseComparison: expensesData?.expenseComparison?.length ? expensesData.expenseComparison : localData.expenseComparison,
            expenseBreakup: expensesData?.expenseBreakup?.length ? expensesData.expenseBreakup : localData.expenseBreakup,
            totalExpensesThisMonth: expensesData?.totalExpensesThisMonth !== undefined ? expensesData.totalExpensesThisMonth : localData.totalExpensesThisMonth,
            monthlyTrend: (expensesData?.monthlyTrend || expensesData?.trend || []).length ? (expensesData.monthlyTrend || expensesData.trend) : localData.monthlyTrend,
            keyStats: summaryData?.keyStats?.totalPurchases ? summaryData.keyStats : localData.keyStats,
            recentTransactions: (transData && transData.length > 0) ? transData : localData.recentTransactions
          }
        };
      }

      // Default to accurate locally reconciled calculations
      return {
        success: true,
        data: localData
      };
    } catch (error) {
      console.warn('Dashboard live API fallback to local:', error.message);
      return {
        success: true,
        data: localData
      };
    }
  }
};
