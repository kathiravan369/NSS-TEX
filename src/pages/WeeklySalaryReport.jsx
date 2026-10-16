import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  UserCheck,
  AlertCircle,
  Eye,
  X,
  Search,
  Download,
  Printer,
  ChevronRight,
  Home,
  Coins,
  CalendarDays,
  Plus
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { formatINR, formatDate } from '../utils/formatters';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Helper to safely parse dates avoiding timezone offsets
function parseDateSafe(dStr) {
  if (!dStr) return null;
  if (typeof dStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dStr)) {
    const parts = dStr.split('T')[0].split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  const d = new Date(dStr);
  return isNaN(d.getTime()) ? null : d;
}

// Helper to compute all Wednesdays of a given month and year
function getWednesdaysOfMonth(year, monthIndex) {
  const list = [];
  const d = new Date(year, monthIndex, 1);
  while (d.getDay() !== 3) {
    d.setDate(d.getDate() + 1);
  }
  while (d.getMonth() === monthIndex) {
    list.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return list;
}

// Format date as "02 Sep 2026 (Wed)"
function formatWedShort(d) {
  const day = String(d.getDate()).padStart(2, '0');
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = shortMonths[d.getMonth()];
  const y = d.getFullYear();
  return `${day} ${m} ${y} (Wed)`;
}

// Format date as "09 September 2026 (Wednesday)"
function formatWedHeader(d) {
  const day = String(d.getDate()).padStart(2, '0');
  const m = MONTH_NAMES[d.getMonth()];
  const y = d.getFullYear();
  return `${day} ${m} ${y} (Wednesday)`;
}

// Format date as "YYYY-MM-DD"
function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function WeeklySalaryReport() {
  const navigate = useNavigate();
  const currentMonthIdx = new Date().getMonth();
  const currentYearNum = new Date().getFullYear();

  const [selectedMonth, setSelectedMonth] = useState(MONTH_NAMES[currentMonthIdx] || 'October');
  const [selectedYear, setSelectedYear] = useState(currentYearNum || 2026);
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedWedDateISO, setSelectedWedDateISO] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch real data from backend/storage
  const loadData = async () => {
    try {
      const livePayrolls = await storageService.fetchLiveCollection('weeklyPayroll');
      const liveEmps = await storageService.fetchLiveCollection('employees');
      setPayrollRecords(Array.isArray(livePayrolls) ? livePayrolls : storageService.getCollection('weeklyPayroll') || []);
      setEmployees(Array.isArray(liveEmps) ? liveEmps : storageService.getCollection('employees') || []);
    } catch {
      setPayrollRecords(storageService.getCollection('weeklyPayroll') || []);
      setEmployees(storageService.getCollection('employees') || []);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute month index
  const monthIndex = useMemo(() => {
    const idx = MONTH_NAMES.findIndex(m => m.toLowerCase() === selectedMonth.toLowerCase());
    return idx !== -1 ? idx : currentMonthIdx;
  }, [selectedMonth, currentMonthIdx]);

  // Compute all Wednesdays for selected month & year
  const wednesdays = useMemo(() => {
    return getWednesdaysOfMonth(Number(selectedYear), monthIndex);
  }, [selectedYear, monthIndex]);

  // Real data calculation for each Wednesday of the month
  const wednesdayReports = useMemo(() => {
    return wednesdays.map((wedDate, wIdx) => {
      const wedISO = toISODate(wedDate);

      // Work week cycle: 6 days prior (Thursday 00:00:00) to Wednesday (23:59:59)
      const weekStart = new Date(wedDate);
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(wedDate);
      weekEnd.setHours(23, 59, 59, 999);

      // Filter real payroll records belonging to this Wednesday week
      const matchingPayrolls = payrollRecords.filter((p) => {
        // 1. Direct weekEnd match
        if (p.weekEnd) {
          const wEndISO = String(p.weekEnd).split('T')[0];
          if (wEndISO === wedISO) return true;
        }

        // 2. Date span: check workDate, weekEnd, or weekStart
        const dStr = p.workDate || p.weekEnd || p.weekStart || p.createdAt;
        if (!dStr) return false;
        const d = parseDateSafe(dStr);
        if (!d) return false;

        return d >= weekStart && d <= weekEnd;
      });

      // Map real payroll records to employee items
      const employeeList = matchingPayrolls.map((p, idx) => {
        const emp = employees.find(e => e.empId === p.empId) || {};

        let typeStr = p.workType || emp.workType || emp.type || 'Day Salary';
        if (typeStr.includes('Size')) typeStr = 'Size Based';
        else if (typeStr.includes('Count')) typeStr = 'Count Based';
        else if (typeStr.includes('Day')) typeStr = 'Day Salary';

        const daysWorked = Number(p.daysWorked !== undefined ? p.daysWorked : 6);
        const leaveDays = Number(p.leaveDays !== undefined ? p.leaveDays : 0);
        const totalWorkingDays = daysWorked + leaveDays > 0 ? daysWorked + leaveDays : 6;
        const totalSalary = Number(p.netPay !== undefined ? p.netPay : p.grossPay || 0);

        return {
          id: p._id || p.id || `rec_${idx}`,
          empNo: p.empId || emp.empId || `EMP-${String(idx + 1).padStart(4, '0')}`,
          name: p.employeeName || emp.name || 'Unnamed Employee',
          type: typeStr,
          workingDays: totalWorkingDays,
          presentDays: daysWorked,
          leaveDays: leaveDays,
          totalSalary: totalSalary
        };
      });

      // Sort by empNo
      employeeList.sort((a, b) => a.empNo.localeCompare(b.empNo));

      // Calculate totals from real records
      const totalSalary = employeeList.reduce((acc, curr) => acc + curr.totalSalary, 0);
      const totalWorkingDays = employeeList.reduce((acc, curr) => acc + curr.workingDays, 0);
      const totalPresentDays = employeeList.reduce((acc, curr) => acc + curr.presentDays, 0);
      const totalLeaveDays = employeeList.reduce((acc, curr) => acc + curr.leaveDays, 0);
      const avgWorkingDays = employeeList.length > 0 ? Math.round(totalWorkingDays / employeeList.length) : 0;
      const avgPresentDays = employeeList.length > 0 ? Math.round(totalPresentDays / employeeList.length) : 0;

      return {
        sno: wIdx + 1,
        date: wedDate,
        dateISO: wedISO,
        dateFormatted: formatWedShort(wedDate),
        headerFormatted: formatWedHeader(wedDate),
        totalSalary,
        totalEmployees: employeeList.length,
        avgWorkingDays,
        avgPresentDays,
        totalWorkingDays,
        totalPresentDays,
        totalLeaveDays,
        employees: employeeList
      };
    });
  }, [wednesdays, payrollRecords, employees]);

  // Set default active Wednesday: first Wednesday with real records, or first Wednesday
  useEffect(() => {
    if (wednesdayReports.length > 0 && !selectedWedDateISO) {
      const wedWithRecords = wednesdayReports.find(w => w.totalSalary > 0) || wednesdayReports[0];
      setSelectedWedDateISO(wedWithRecords.dateISO);
      setIsDrawerOpen(true);
    }
  }, [wednesdayReports, selectedWedDateISO]);

  // Active Wednesday report
  const activeReport = useMemo(() => {
    if (!selectedWedDateISO) return wednesdayReports[0] || null;
    return wednesdayReports.find(w => w.dateISO === selectedWedDateISO) || wednesdayReports[0] || null;
  }, [selectedWedDateISO, wednesdayReports]);

  // Filtered employees inside the active drawer based on search
  const filteredDrawerEmployees = useMemo(() => {
    if (!activeReport) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return activeReport.employees;
    return activeReport.employees.filter(
      e => e.name.toLowerCase().includes(q) || e.empNo.toLowerCase().includes(q) || e.type.toLowerCase().includes(q)
    );
  }, [activeReport, searchQuery]);

  // Drawer totals
  const drawerTotals = useMemo(() => {
    const list = filteredDrawerEmployees;
    return {
      count: list.length,
      workingDays: list.reduce((a, b) => a + b.workingDays, 0),
      presentDays: list.reduce((a, b) => a + b.presentDays, 0),
      leaveDays: list.reduce((a, b) => a + b.leaveDays, 0),
      totalSalary: list.reduce((a, b) => a + b.totalSalary, 0)
    };
  }, [filteredDrawerEmployees]);

  const handleSelectWednesday = (rep) => {
    setSelectedWedDateISO(rep.dateISO);
    setIsDrawerOpen(true);
    setSearchQuery('');
  };

  const handleExportCSV = () => {
    if (!activeReport) return;
    const rows = activeReport.employees.map((e, idx) => ({
      sno: idx + 1,
      empNo: e.empNo,
      name: e.name,
      typeOfSalary: e.type,
      totalWorkingDays: e.workingDays,
      presentDays: e.presentDays,
      leaveDays: e.leaveDays,
      totalSalary: e.totalSalary
    }));
    storageService.exportToCSV(`Weekly_Salary_Report_${activeReport.dateISO}`, rows);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* 1. Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
        <Home size={15} color="#64748b" />
        <span>Salary</span>
        <ChevronRight size={14} color="#94a3b8" />
        <span style={{ color: 'var(--primary-600)', fontWeight: 600 }}>Weekly Report</span>
      </div>

      {/* 2. Page Header & Month/Year Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Weekly Salary Report
          </h2>
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b' }}>
            Shows total salary for every Wednesday of the month.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Month Selector */}
          <select
            className="form-control"
            style={{ width: '140px', height: '36px', fontSize: '0.82rem', fontWeight: 600 }}
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setSelectedWedDateISO(null);
            }}
          >
            {MONTH_NAMES.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Year Selector */}
          <select
            className="form-control"
            style={{ width: '100px', height: '36px', fontSize: '0.82rem', fontWeight: 600 }}
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(Number(e.target.value));
              setSelectedWedDateISO(null);
            }}
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportCSV}
            style={{ height: '36px', fontSize: '0.8rem' }}
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => window.print()}
            style={{ height: '36px', fontSize: '0.8rem' }}
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* 3. Main Split View: Left Wednesday Table & Right Employee Details Drawer */}
      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', width: '100%' }}>
        {/* Left Side: Wednesday Summary Table */}
        <div
          className="erp-card"
          style={{
            flex: isDrawerOpen ? '0 0 360px' : '1 1 100%',
            maxWidth: isDrawerOpen ? '380px' : '100%',
            minWidth: 0,
            transition: 'all 0.25s ease',
            padding: 0,
            overflow: 'hidden',
            backgroundColor: '#ffffff'
          }}
        >
          <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ width: '52px', padding: '0.75rem 0.65rem', fontSize: '0.76rem', color: '#475569', fontWeight: 700, textAlign: 'center' }}>
                  S.No.
                </th>
                <th style={{ padding: '0.75rem 0.65rem', fontSize: '0.76rem', color: '#475569', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  Week Date (Wednesday)
                </th>
                <th style={{ padding: '0.75rem 0.65rem', fontSize: '0.76rem', color: '#475569', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  Total Salary (₹)
                </th>
                <th style={{ width: '115px', padding: '0.75rem 0.65rem', fontSize: '0.76rem', color: '#475569', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {wednesdayReports.map((row) => {
                const isSelected = isDrawerOpen && selectedWedDateISO === row.dateISO;

                return (
                  <tr
                    key={row.dateISO}
                    onClick={() => handleSelectWednesday(row)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    {/* S.No. */}
                    <td style={{ padding: '0.85rem 0.65rem', fontSize: '0.82rem', textAlign: 'center', color: isSelected ? '#1d4ed8' : '#334155', fontWeight: isSelected ? 700 : 500 }}>
                      {row.sno}
                    </td>

                    {/* Week Date (Wednesday) */}
                    <td style={{ padding: '0.85rem 0.65rem', fontSize: '0.82rem', color: isSelected ? '#1d4ed8' : '#1e293b', fontWeight: isSelected ? 700 : 500, whiteSpace: 'nowrap' }}>
                      {row.dateFormatted}
                    </td>

                    {/* Total Salary (₹) */}
                    <td style={{ padding: '0.85rem 0.65rem', fontSize: '0.88rem', fontWeight: 800, textAlign: 'right', color: isSelected ? '#1d4ed8' : '#0f172a', whiteSpace: 'nowrap' }}>
                      ₹ {row.totalSalary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Action Button */}
                    <td style={{ padding: '0.85rem 0.65rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectWednesday(row);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '5px 11px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          borderRadius: '6px',
                          border: isSelected ? '1px solid #1d4ed8' : '1px solid #bfdbfe',
                          backgroundColor: isSelected ? '#1d4ed8' : '#eff6ff',
                          color: isSelected ? '#ffffff' : '#2563eb',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Eye size={12} /> View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right Side: Employee Details Drawer Side Panel */}
        {isDrawerOpen && activeReport && (
          <div
            className="erp-card"
            style={{
              flex: '1 1 58%',
              minWidth: 0,
              padding: '1.25rem',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: '#ffffff',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.15rem'
            }}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
                  Weekly Salary Details
                </h3>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#1d4ed8' }}>
                  <CalendarDays size={15} color="#2563eb" />
                  <span>{activeReport.headerFormatted}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Close Details Panel"
              >
                <X size={20} />
              </button>
            </div>

            {/* KPI Cards Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '0.85rem' }}>
              {/* Big Total Salary Card */}
              <div
                style={{
                  backgroundColor: '#f0f7ff',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  border: '1px solid #dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem'
                }}
              >
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    backgroundColor: '#dbeafe',
                    color: '#1d4ed8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Coins size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Total Salary
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e3a8a', marginTop: '2px' }}>
                    ₹ {activeReport.totalSalary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* 4 Small KPI Cards in 2x2 Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                {/* Total Employees */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    padding: '0.6rem 0.75rem',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem'
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Users size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>Total Employees</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{activeReport.totalEmployees}</div>
                  </div>
                </div>

                {/* Total Working Days */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    padding: '0.6rem 0.75rem',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem'
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Calendar size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>Total Working Days</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{activeReport.avgWorkingDays}</div>
                  </div>
                </div>

                {/* Present Days */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    padding: '0.6rem 0.75rem',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem'
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      backgroundColor: '#ecfdf5',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <UserCheck size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>Present Days</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#059669' }}>{activeReport.avgPresentDays}</div>
                  </div>
                </div>

                {/* Leave Days */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    padding: '0.6rem 0.75rem',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem'
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <AlertCircle size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>Leave Days</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#dc2626' }}>{activeReport.totalLeaveDays}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Employee Table Section Header + Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem' }}>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Employee Salary Details
              </h4>

              <div className="search-box" style={{ width: '200px', height: '32px' }}>
                <Search size={13} />
                <input
                  type="text"
                  placeholder="Search employee..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ fontSize: '0.75rem' }}
                />
              </div>
            </div>

            {/* Detailed Employee Salary Table (Columns matching user prompt exactly) */}
            <div className="table-responsive" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflowX: 'auto' }}>
              <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ width: '38px', padding: '7px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>S.No.</th>
                    <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>Emp. No.</th>
                    <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>Emp. Name</th>
                    <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>Type of Salary</th>
                    <th style={{ padding: '7px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>Total Working Days</th>
                    <th style={{ padding: '7px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>Present Days</th>
                    <th style={{ padding: '7px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>Leave Days</th>
                    <th style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>Total Salary (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrawerEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
                        {activeReport.employees.length === 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
                            <span>No salary records found for this Wednesday week.</span>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => navigate('/salary/weekly')}
                              style={{ gap: '5px' }}
                            >
                              <Plus size={14} /> Add Weekly Salary
                            </button>
                          </div>
                        ) : (
                          'No employees match your search query.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredDrawerEmployees.map((emp, idx) => (
                      <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ textAlign: 'center', padding: '7px 6px', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>
                          <code style={{ fontSize: '0.74rem', color: '#0369a1', fontWeight: 600 }}>{emp.empNo}</code>
                        </td>
                        <td style={{ padding: '7px 8px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{emp.name}</td>
                        <td style={{ padding: '7px 8px', color: '#475569', whiteSpace: 'nowrap' }}>{emp.type}</td>
                        <td style={{ textAlign: 'center', padding: '7px 6px', color: '#334155' }}>{emp.workingDays}</td>
                        <td style={{ textAlign: 'center', padding: '7px 6px', color: '#16a34a', fontWeight: 600 }}>{emp.presentDays}</td>
                        <td style={{ textAlign: 'center', padding: '7px 6px', color: emp.leaveDays > 0 ? '#dc2626' : '#64748b' }}>
                          {emp.leaveDays}
                        </td>
                        <td style={{ textAlign: 'right', padding: '7px 8px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                          ₹ {emp.totalSalary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {/* Summary Total Row */}
                {filteredDrawerEmployees.length > 0 && (
                  <tfoot>
                    <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 800 }}>
                      <td style={{ padding: '8px 6px', fontWeight: 800, color: '#0f172a', textAlign: 'center' }}>Total</td>
                      <td style={{ padding: '8px 8px', fontWeight: 800, color: '#0f172a' }}>{drawerTotals.count}</td>
                      <td style={{ padding: '8px 8px' }} colSpan={2}></td>
                      <td style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 800, color: '#0f172a' }}>
                        {drawerTotals.workingDays}
                      </td>
                      <td style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 800, color: '#16a34a' }}>
                        {drawerTotals.presentDays}
                      </td>
                      <td style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 800, color: drawerTotals.leaveDays > 0 ? '#dc2626' : '#64748b' }}>
                        {drawerTotals.leaveDays}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 8px', fontWeight: 800, color: '#1e3a8a', fontSize: '0.86rem', whiteSpace: 'nowrap' }}>
                        ₹ {drawerTotals.totalSalary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Bottom Close Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsDrawerOpen(false)}
                style={{ padding: '6px 20px', fontWeight: 600, fontSize: '0.8rem' }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
