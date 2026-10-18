// Centralized Runtime Memory Store
// Holds dynamically created & updated records in memory when MongoDB Atlas is connecting / standby

const runtimeStore = {
  employees: [],
  threadPurchases: [],
  oilPurchases: [],
  oilStock: [],
  machineryExpenses: [],
  electricityExpenses: [],
  weeklyPayroll: [],
  customers: [],
  invoices: [],
  salesPayments: []
};

module.exports = runtimeStore;
