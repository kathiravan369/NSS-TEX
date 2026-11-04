import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { BusinessProvider, useBusiness } from './context/BusinessContext';
import BusinessSelection from './pages/BusinessSelection';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import TowelPurchaseGST from './pages/TowelPurchaseGST';
import TowelPurchaseNoGST from './pages/TowelPurchaseNoGST';
import ThreadPurchaseGST from './pages/ThreadPurchaseGST';
import ThreadPurchaseNoGST from './pages/ThreadPurchaseNoGST';
import OilPurchase from './pages/OilPurchase';
import MachineryCost from './pages/MachineryCost';
import ElectricityCost from './pages/ElectricityCost';
import EmployeeManagement from './pages/EmployeeManagement';
import WeeklySalary from './pages/WeeklySalary';
import SalaryReports from './pages/SalaryReports';
import WeeklySalaryReport from './pages/WeeklySalaryReport';
import CustomerDetails from './pages/CustomerDetails';
import InvoiceList from './pages/InvoiceList';
import CreateInvoice from './pages/CreateInvoice';
import InvoiceView from './pages/InvoiceView';
import SalesDetails from './pages/SalesDetails';

function AppContent() {
  const { selectedBusinessId, isSelecting } = useBusiness();

  // Initial startup screen: if no business is selected or user explicitly clicked switch/select
  if (!selectedBusinessId || isSelecting) {
    return <BusinessSelection />;
  }

  return (
    <Routes>
      <Route path="/select-business" element={<BusinessSelection />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />

        {/* Purchase Module Routes */}
        <Route path="purchase" element={<Navigate to="/purchase/towel-gst" replace />} />
        <Route path="purchase/towel-gst" element={<TowelPurchaseGST />} />
        <Route path="purchase/towel-no-gst" element={<TowelPurchaseNoGST />} />
        <Route path="purchase/towel-with-gst" element={<Navigate to="/purchase/towel-gst" replace />} />
        <Route path="purchase/towel-without-gst" element={<Navigate to="/purchase/towel-no-gst" replace />} />

        {/* Production & Raw Materials Routes */}
        <Route path="raw-materials/thread-gst" element={<ThreadPurchaseGST />} />
        <Route path="raw-materials/thread-no-gst" element={<ThreadPurchaseNoGST />} />
        <Route path="raw-materials/oil" element={<OilPurchase />} />
        <Route path="machinery-cost" element={<MachineryCost />} />
        <Route path="electricity-cost" element={<ElectricityCost />} />

        {/* Salary Module Routes */}
        <Route path="salary" element={<Navigate to="/salary/employees" replace />} />
        <Route path="salary/employees" element={<EmployeeManagement />} />
        <Route path="salary/weekly" element={<WeeklySalary />} />
        <Route path="salary/weekly-report" element={<WeeklySalaryReport />} />
        <Route path="salary/reports/weekly" element={<WeeklySalaryReport />} />
        <Route path="salary/reports" element={<SalaryReports />} />
        <Route path="salary/report" element={<Navigate to="/salary/reports" replace />} />
        <Route path="salary-reports" element={<Navigate to="/salary/reports" replace />} />
        
        {/* Sales Module Routes */}
        <Route path="sales" element={<Navigate to="/sales/customers" replace />} />
        <Route path="sales/customers" element={<CustomerDetails />} />
        <Route path="sales/invoices" element={<InvoiceList />} />
        <Route path="sales/invoices/new" element={<CreateInvoice />} />
        <Route path="sales/invoices/:id/edit" element={<CreateInvoice />} />
        <Route path="sales/invoices/:id" element={<InvoiceView />} />
        <Route path="sales/reports" element={<SalesDetails />} />
        <Route path="sales/details" element={<SalesDetails />} />
        <Route path="sales/report" element={<Navigate to="/sales/reports" replace />} />
        <Route path="sales-reports" element={<Navigate to="/sales/reports" replace />} />

        {/* Reports Root */}
        <Route path="reports" element={<Navigate to="/sales/reports" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BusinessProvider>
      <AppContent />
    </BusinessProvider>
  );
}
