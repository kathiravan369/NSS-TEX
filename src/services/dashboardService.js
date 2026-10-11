// Dashboard Data Access Layer
// Fetches live summary, expense breakdown, and recent transactions from Node.js / Express REST API

import { api } from './api';

const EMPTY_DASHBOARD_DATA = {
  kpis: {
    totalRawMaterial: 0,
    totalRawMaterialTrend: { value: 'Live', type: 'neutral', period: 'Real-time' },
    threadWithGST: 0,
    threadWithGSTTrend: { value: 'Live', type: 'neutral', period: 'Real-time' },
    threadWithoutGST: 0,
    threadWithoutGSTTrend: { value: 'Live', type: 'neutral', period: 'Real-time' },
    oilExpenses: 0,
    oilExpensesTrend: { value: 'Live', type: 'neutral', period: 'Real-time' },
    machineryCost: 0,
    machineryCostTrend: { value: 'Live', type: 'neutral', period: 'Real-time' },
    electricityCost: 0,
    electricityCostTrend: { value: 'Live', type: 'neutral', period: 'Real-time' },
    weeklySalary: 0,
    weeklySalaryTrend: { value: 'Live', type: 'neutral', period: 'Real-time' },
    estMonthlySalary: 0,
    estMonthlySalaryTrend: { value: 'Live', type: 'neutral', period: 'Real-time' },
    totalEmployees: 0,
    totalEmployeesTrend: { value: '0 Active', type: 'neutral', period: 'current' }
  },
  expenseComparison: [
    { month: 'Jan', weekly: 0, monthly: 0 },
    { month: 'Feb', weekly: 0, monthly: 0 },
    { month: 'Mar', weekly: 0, monthly: 0 },
    { month: 'Apr', weekly: 0, monthly: 0 },
    { month: 'May', weekly: 0, monthly: 0 },
    { month: 'Jun', weekly: 0, monthly: 0 },
    { month: 'Jul', weekly: 0, monthly: 0 },
    { month: 'Aug', weekly: 0, monthly: 0 },
    { month: 'Sep', weekly: 0, monthly: 0 },
    { month: 'Oct', weekly: 0, monthly: 0 }
  ],
  expenseBreakup: [
    { name: 'Raw Materials', value: 0, amount: 0, color: '#2563eb' },
    { name: 'Thread (GST)', value: 0, amount: 0, color: '#06b6d4' },
    { name: 'Thread (Without GST)', value: 0, amount: 0, color: '#3b82f6' },
    { name: 'Oil', value: 0, amount: 0, color: '#f59e0b' },
    { name: 'Machinery', value: 0, amount: 0, color: '#10b981' },
    { name: 'Electricity', value: 0, amount: 0, color: '#f97316' },
    { name: 'Salary', value: 0, amount: 0, color: '#8b5cf6' }
  ],
  totalExpensesThisMonth: 0,
  monthlyTrend: [
    { month: 'Jan', rawMaterial: 0, machinery: 0, electricity: 0, salary: 0 },
    { month: 'Feb', rawMaterial: 0, machinery: 0, electricity: 0, salary: 0 },
    { month: 'Mar', rawMaterial: 0, machinery: 0, electricity: 0, salary: 0 },
    { month: 'Apr', rawMaterial: 0, machinery: 0, electricity: 0, salary: 0 },
    { month: 'May', rawMaterial: 0, machinery: 0, electricity: 0, salary: 0 },
    { month: 'Jun', rawMaterial: 0, machinery: 0, electricity: 0, salary: 0 },
    { month: 'Jul', rawMaterial: 0, machinery: 0, electricity: 0, salary: 0 },
    { month: 'Aug', rawMaterial: 0, machinery: 0, electricity: 0, salary: 0 },
    { month: 'Sep', rawMaterial: 0, machinery: 0, electricity: 0, salary: 0 },
    { month: 'Oct', rawMaterial: 0, machinery: 0, electricity: 0, salary: 0 }
  ],
  keyStats: {
    totalPurchases: { count: 0, trend: '0%' },
    totalProduction: { count: '0 Kg', trend: '0%' },
    employeesPresent: { count: 0, trend: '0%' },
    leaveDays: { count: 0, trend: '0%' }
  },
  recentTransactions: []
};

export const dashboardService = {
  async getDashboardData() {
    try {
      const [summaryRes, expensesRes, transRes] = await Promise.allSettled([
        api.dashboard.getSummary(),
        api.dashboard.getExpenses(),
        api.dashboard.getRecentTransactions()
      ]);

      const summaryData = summaryRes.status === 'fulfilled' ? summaryRes.value?.data : null;
      const expensesData = expensesRes.status === 'fulfilled' ? expensesRes.value?.data : null;
      const transData = transRes.status === 'fulfilled' ? transRes.value?.data : null;

      if (summaryData || expensesData) {
        return {
          success: true,
          data: {
            kpis: summaryData?.kpis || EMPTY_DASHBOARD_DATA.kpis,
            expenseComparison: expensesData?.expenseComparison || EMPTY_DASHBOARD_DATA.expenseComparison,
            expenseBreakup: expensesData?.expenseBreakup || EMPTY_DASHBOARD_DATA.expenseBreakup,
            totalExpensesThisMonth: expensesData?.totalExpensesThisMonth || 0,
            monthlyTrend: expensesData?.trend || EMPTY_DASHBOARD_DATA.monthlyTrend,
            keyStats: summaryData?.keyStats || EMPTY_DASHBOARD_DATA.keyStats,
            recentTransactions: transData || []
          }
        };
      }

      return { success: true, data: EMPTY_DASHBOARD_DATA };
    } catch (error) {
      console.warn('Dashboard live fetch error:', error);
      return { success: true, data: EMPTY_DASHBOARD_DATA };
    }
  }
};
