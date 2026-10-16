import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import ThreadPurchaseGST from './pages/ThreadPurchaseGST';
import ThreadPurchaseNoGST from './pages/ThreadPurchaseNoGST';
import OilPurchase from './pages/OilPurchase';
import MachineryCost from './pages/MachineryCost';
import ElectricityCost from './pages/ElectricityCost';
import EmployeeManagement from './pages/EmployeeManagement';
import WeeklySalary from './pages/WeeklySalary';
import SalaryReports from './pages/SalaryReports';
import WeeklySalaryReport from './pages/WeeklySalaryReport';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="raw-materials/thread-gst" element={<ThreadPurchaseGST />} />
        <Route path="raw-materials/thread-no-gst" element={<ThreadPurchaseNoGST />} />
        <Route path="raw-materials/oil" element={<OilPurchase />} />
        <Route path="machinery-cost" element={<MachineryCost />} />
        <Route path="electricity-cost" element={<ElectricityCost />} />
        <Route path="salary/employees" element={<EmployeeManagement />} />
        <Route path="salary/weekly" element={<WeeklySalary />} />
        <Route path="salary/weekly-report" element={<WeeklySalaryReport />} />
        <Route path="salary/reports/weekly" element={<WeeklySalaryReport />} />
        <Route path="salary/reports" element={<SalaryReports />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
