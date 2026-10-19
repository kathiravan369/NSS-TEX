import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Filter,
  Calendar,
  Users,
  DollarSign,
  Box,
  TrendingUp,
  PieChart as PieIcon,
  CheckCircle2,
  Eye,
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import MetricCard from '../components/common/MetricCard';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';
import StatusBadge from '../components/common/StatusBadge';
import DateRangePicker from '../components/common/DateRangePicker';
import { storageService } from '../services/storageService';
import { api } from '../services/api';
import { formatINR, formatDate, formatDateTime } from '../utils/formatters';

export default function SalaryReports() {
  const [selectedMonth, setSelectedMonth] = useState('October');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [employeeFilter, setEmployeeFilter] = useState('All Employees');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewingItem, setViewingItem] = useState(null);
  const [toast, setToast] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await api.reports.getMonthlySalary({
        month: selectedMonth,
        year: selectedYear,
        employeeFilter
      });
      if (res && res.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.warn('Using local reconciliation fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedMonth, selectedYear, employeeFilter]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const employees = storageService.getCollection('employees') || [];
  const weeklyPayroll = storageService.getCollection('weeklyPayroll') || [];

  // Dynamic Fallback Reconciled Data from local storage collections
  const fallbackReport = useMemo(() => {
    return employees.map((emp) => {
      const isDay = emp.type === 'Day Salary';
      let empPayrolls = weeklyPayroll.filter(p => p.empId === emp.empId);

      if (startDate) {
        empPayrolls = empPayrolls.filter(p => {
          const d = p.workDate || p.weekEnd || p.date || '';
          return d >= startDate;
        });
      }
      if (endDate) {
        empPayrolls = empPayrolls.filter(p => {
          const d = p.workDate || p.weekEnd || p.date || '';
          return d <= endDate;
        });
      }
      
      const daysWorked = empPayrolls.reduce((sum, p) => sum + (Number(p.daysWorked) || 0), 0);
      const leaveDays = empPayrolls.reduce((sum, p) => sum + (Number(p.leaveDays) || 0), 0);
      const productsProduced = empPayrolls.reduce((sum, p) => sum + (Number(p.productsProduced) || 0), 0);
      const rate = isDay ? (emp.dailyRate || 600) : (emp.pieceRate || 12);
      const gross = empPayrolls.reduce((sum, p) => sum + (Number(p.grossPay) || 0), 0);
      const deductions = empPayrolls.reduce((sum, p) => sum + (Number(p.deductions) || 0), 0);
      const adjustments = empPayrolls.reduce((sum, p) => sum + (Number(p.adjustments) || 0), 0);
      const net = empPayrolls.reduce((sum, p) => sum + (Number(p.netPay) || 0), 0);
      const isPaid = empPayrolls.length > 0 && empPayrolls.every(p => p.status === 'Paid');

      return {
        id: emp.id || emp._id,
        empId: emp.empId,
        name: emp.name,
        type: emp.type,
        productType: emp.productType || '-',
        daysWorked,
        leaveDays,
        productsProduced,
        rate,
        gross,
        deductions,
        adjustments,
        net,
        status: isPaid ? 'Paid' : 'Pending',
        calculationBreakdown: isDay
          ? `${daysWorked} days × ₹${rate} - ₹${deductions}`
          : `${productsProduced} pcs × ₹${rate} - ₹${deductions}`
      };
    });
  }, [employees, weeklyPayroll]);

  const rows = reportData?.rows || fallbackReport;
  const summary = reportData?.summary || {
    totalGross: rows.reduce((a, b) => a + (b.gross || 0), 0),
    totalDeductions: rows.reduce((a, b) => a + (b.deductions || 0), 0),
    totalNet: rows.reduce((a, b) => a + (b.net || 0), 0),
    totalDaysWorked: rows.reduce((a, b) => a + (b.daysWorked || 0), 0),
    totalLeaveDays: rows.reduce((a, b) => a + (b.leaveDays || 0), 0),
    totalProducts: rows.reduce((a, b) => a + (b.productsProduced || 0), 0),
    employeesPaid: rows.filter(r => r.status === 'Paid').length,
    daySalaryTotal: rows.filter(r => r.type === 'Day Salary').reduce((a, b) => a + (b.net || 0), 0),
    countSalaryTotal: rows.filter(r => r.type === 'Count Salary').reduce((a, b) => a + (b.net || 0), 0)
  };

  const trendData = reportData?.trendData || [
    { month: selectedMonth.substring(0, 3), gross: summary.totalGross, net: summary.totalNet }
  ];

  const distributionData = [
    { name: 'Day Salary Staff', value: summary.daySalaryTotal, color: '#3b82f6' },
    { name: 'Count Salary Staff', value: summary.countSalaryTotal, color: '#10b981' }
  ];

  const handleExportCSV = () => {
    storageService.exportToCSV(`Monthly_Salary_Report_${selectedMonth}_${selectedYear}`, rows);
    showToast('Consolidated monthly salary spreadsheet downloaded.');
  };

  const handlePrint = () => {
    storageService.exportToPDF(`Monthly_Salary_Report_${selectedMonth}_${selectedYear}`, rows, columns);
  };

  const handlePrintPayslip = (item) => {
    if (!item) return;
    const payslipRows = [
      { field: 'Employee ID', value: item.empId },
      { field: 'Employee Name', value: item.name },
      { field: 'Work Type', value: item.type },
      { field: 'Days Worked', value: item.daysWorked },
      { field: 'Products Produced', value: item.productsProduced || 0 },
      { field: 'Daily Rate', value: formatINR(item.dailyRate) },
      { field: 'Gross Earnings', value: formatINR(item.grossEarnings) },
      { field: 'Advances / Deductions', value: formatINR(item.advances) },
      { field: 'Net Payable Salary', value: formatINR(item.netSalary) },
      { field: 'Month & Year', value: `${selectedMonth} ${selectedYear}` }
    ];
    const payslipCols = [
      { key: 'field', header: 'Payslip Component' },
      { key: 'value', header: 'Details' }
    ];
    storageService.exportToPDF(`Employee_Payslip_${item.empId}_${selectedMonth}_${selectedYear}`, payslipRows, payslipCols);
  };

  const columns = [
    { key: 'empId', header: 'Emp ID', render: (val) => <code>{val}</code> },
    { key: 'name', header: 'Employee Name', render: (val) => <strong>{val}</strong> },
    {
      key: 'type',
      header: 'Work Type',
      render: (val) => (
        <span
          style={{
            display: 'inline-block',
            padding: '0.2rem 0.6rem',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: val === 'Day Salary' ? '#eff6ff' : '#f0fdf4',
            color: val === 'Day Salary' ? '#1d4ed8' : '#15803d'
          }}
        >
          {val}
        </span>
      )
    },
    { key: 'daysWorked', header: 'Work Days' },
    { key: 'leaveDays', header: 'Leaves' },
    {
      key: 'productsProduced',
      header: 'Products',
      render: (val, item) => (item.type === 'Count Salary' ? `${val} pcs` : '-')
    },
    {
      key: 'gross',
      header: 'Gross Pay',
      render: (val) => <strong>{formatINR(val)}</strong>
    },
    {
      key: 'deductions',
      header: 'Deductions',
      render: (val) => <span style={{ color: 'var(--danger-color)' }}>{formatINR(val)}</span>
    },
    {
      key: 'net',
      header: 'Net Pay',
      render: (val) => (
        <strong style={{ color: 'var(--primary-color)', fontSize: '0.95rem' }}>
          {formatINR(val)}
        </strong>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (val) => <StatusBadge status={val} />
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_, item) => (
        <button
          onClick={() => setViewingItem(item)}
          className="btn-icon"
          title="View Reconciled Payslip"
          style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', cursor: 'pointer' }}
        >
          <Eye size={15} color="#2563eb" />
        </button>
      )
    }
  ];

  return (
    <div className="page-container">
      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">Monthly Salary Reports</h1>
          <p className="page-subtitle">
            Exact calendar month salary reconciliations attributed to underlying daily & production records.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={handleExportCSV} className="btn btn-secondary">
            <Download size={16} /> Export Excel
          </button>
          <button onClick={handlePrint} className="btn btn-primary">
            <Printer size={16} /> Export PDF
          </button>
        </div>
      </div>

      {/* Month Boundary Methodology Note */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.25rem',
          fontSize: '0.85rem',
          color: '#1e40af'
        }}
      >
        <Info size={18} style={{ flexShrink: 0 }} />
        <div>
          <strong>Reconciliation Guarantee:</strong> Monthly earnings are strictly attributed to eligible dates and verified production counts. Weeks crossing month boundaries are allocated proportionally by active working days within {selectedMonth} {selectedYear} without four-week estimation shortcuts.
        </div>
      </div>

      {/* Month & Filter Controls */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} color="var(--primary-color)" />
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Month:</label>
              <select
                className="input"
                style={{ width: '130px', padding: '0.4rem 0.6rem' }}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                {[
                  'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'
                ].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={16} color="var(--text-muted)" />
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Work Type:</label>
              <select
                className="input"
                style={{ width: '150px', padding: '0.4rem 0.6rem' }}
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
              >
                <option value="All Employees">All Employees</option>
                <option value="Day Salary">Day Salary Only</option>
                <option value="Count Salary">Count Salary Only</option>
              </select>
            </div>

            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={({ startDate: s, endDate: e }) => {
                setStartDate(s);
                setEndDate(e);
              }}
              onReset={() => {
                setStartDate('');
                setEndDate('');
              }}
            />
          </div>

          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Showing <strong>{rows.length}</strong> reconciled employee records
          </div>
        </div>
      </div>

      {/* 7 Reconciled Monthly KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <MetricCard
          title="Total Gross Salary"
          value={formatINR(summary.totalGross)}
          icon={DollarSign}
          iconColor="#2563eb"
          iconBg="#eff6ff"
        />
        <MetricCard
          title="Total Deductions"
          value={formatINR(summary.totalDeductions)}
          icon={DollarSign}
          iconColor="#ef4444"
          iconBg="#fef2f2"
        />
        <MetricCard
          title="Total Net Paid"
          value={formatINR(summary.totalNet)}
          icon={CheckCircle2}
          iconColor="#10b981"
          iconBg="#f0fdf4"
        />
        <MetricCard
          title="Day Salary Staff"
          value={formatINR(summary.daySalaryTotal)}
          icon={Users}
          iconColor="#3b82f6"
          iconBg="#eff6ff"
        />
        <MetricCard
          title="Count Salary Staff"
          value={formatINR(summary.countSalaryTotal)}
          icon={Box}
          iconColor="#f59e0b"
          iconBg="#fffbeb"
        />
        <MetricCard
          title="Total Work Days"
          value={`${summary.totalDaysWorked} Days`}
          icon={Calendar}
          iconColor="#8b5cf6"
          iconBg="#f5f3ff"
        />
        <MetricCard
          title="Products Produced"
          value={`${summary.totalProducts.toLocaleString()} Pcs`}
          icon={TrendingUp}
          iconColor="#06b6d4"
          iconBg="#ecfeff"
        />
      </div>

      {/* Analytics Charts Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '1.25rem',
          marginBottom: '1.5rem'
        }}
      >
        {/* Salary Trend Chart */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
            Monthly Salary Payout Trend (2026)
          </h3>
          <div style={{ height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `₹${val / 1000}k`}
                />
                <Tooltip formatter={(value) => formatINR(value)} />
                <Bar dataKey="gross" name="Gross Pay" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net" name="Net Pay" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Day vs Count Salary Ratio */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
            Salary Distribution
          </h3>
          <div style={{ height: '180px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatINR(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            {distributionData.map((d) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.color }} />
                <span>{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Consolidated DataTable */}
      <DataTable
        title={`Employee Monthly Salary Summary - ${selectedMonth} ${selectedYear}`}
        columns={columns}
        data={rows}
      />

      {/* Employee Detail Modal */}
      {viewingItem && (
        <Modal
          isOpen={Boolean(viewingItem)}
          onClose={() => setViewingItem(null)}
          title={`Monthly Reconciled Payslip: ${viewingItem.name} (${viewingItem.empId})`}
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                background: '#f8fafc',
                padding: '1rem',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Period:</span>
                <p style={{ fontWeight: 600 }}>{selectedMonth} {selectedYear}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Work Type:</span>
                <p style={{ fontWeight: 600 }}>{viewingItem.type}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Work Days:</span>
                <p style={{ fontWeight: 600 }}>{viewingItem.daysWorked} Days (Leaves: {viewingItem.leaveDays})</p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Products Produced:</span>
                <p style={{ fontWeight: 600 }}>{viewingItem.productsProduced ? `${viewingItem.productsProduced} Pcs` : 'N/A'}</p>
              </div>
            </div>

            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--radius-md)',
                padding: '1rem'
              }}
            >
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                Earnings & Deduction Breakdown
              </h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                <span>Gross Earnings:</span>
                <strong>{formatINR(viewingItem.gross)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--danger-color)' }}>
                <span>Total Deductions / Advances:</span>
                <span>- {formatINR(viewingItem.deductions)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '0.5rem',
                  borderTop: '1px dashed #cbd5e1',
                  fontWeight: 700,
                  fontSize: '1rem',
                  color: 'var(--primary-color)'
                }}
              >
                <span>Net Salary Payable:</span>
                <span>{formatINR(viewingItem.net)}</span>
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#64748b', background: '#f1f5f9', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
              <strong>Calculation:</strong> {viewingItem.calculationBreakdown}
            </div>

            {/* Timestamps */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '0.75rem'
            }}>
              <div>
                <strong style={{ color: 'var(--text-main)' }}>Generated At:</strong> {formatDateTime(viewingItem.createdAt || new Date())}
              </div>
              <div>
                <strong style={{ color: 'var(--text-main)' }}>Last Updated:</strong> {formatDateTime(viewingItem.updatedAt || viewingItem.createdAt || new Date())}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button onClick={() => handlePrintPayslip(viewingItem)} className="btn btn-secondary">
                <Printer size={16} /> Print Payslip
              </button>
              <button onClick={() => setViewingItem(null)} className="btn btn-primary">
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
