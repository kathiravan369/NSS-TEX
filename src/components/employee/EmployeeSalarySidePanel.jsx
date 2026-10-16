import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Layers,
  Box,
  Users,
  CheckCircle2,
  AlertCircle,
  Download,
  Filter,
  ArrowUpRight,
  FileText,
  Phone,
  UserCheck,
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Sparkles,
  Award
} from 'lucide-react';
import { formatINR, formatDate, formatDateTime } from '../../utils/formatters';
import { storageService } from '../../services/storageService';
import StatusBadge from '../common/StatusBadge';

export default function EmployeeSalarySidePanel({
  isOpen,
  onClose,
  employee,
  onEditEmployee,
  onRecordSalary
}) {
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [periodFilter, setPeriodFilter] = useState('All Time'); // 'All Time' | 'Today' | 'This Week' | 'This Month' | 'This Year' | 'Custom Day' | 'Custom Range'
  const [customSingleDate, setCustomSingleDate] = useState(new Date().toISOString().split('T')[0]);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [workTypeFilter, setWorkTypeFilter] = useState('All'); // 'All' | 'Day Salary' | 'Count Based Salary' | 'Size Based Salary'
  const [expandedRecordId, setExpandedRecordId] = useState(null);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'breakdowns' | 'history'

  // Load employee's payroll records whenever panel opens or employee changes
  useEffect(() => {
    if (!isOpen || !employee) return;

    const loadRecords = async () => {
      setLoading(true);
      try {
        const livePayrolls = await storageService.fetchLiveCollection('weeklyPayroll');
        const list = Array.isArray(livePayrolls) ? livePayrolls : storageService.getCollection('weeklyPayroll') || [];
        setPayrollRecords(list);
      } catch (e) {
        const cached = storageService.getCollection('weeklyPayroll') || [];
        setPayrollRecords(cached);
      } finally {
        setLoading(false);
      }
    };

    loadRecords();
  }, [isOpen, employee]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Filter records belonging to this specific employee
  const employeePayrolls = useMemo(() => {
    if (!employee) return [];
    const empIdUpper = String(employee.empId || '').toUpperCase().trim();
    const empNameLower = String(employee.name || '').toLowerCase().trim();

    return payrollRecords.filter((p) => {
      const pId = String(p.empId || '').toUpperCase().trim();
      const pName = String(p.employeeName || '').toLowerCase().trim();
      return (empIdUpper && pId === empIdUpper) || (empNameLower && pName === empNameLower);
    });
  }, [payrollRecords, employee]);

  // Safe Date parsing helper to handle YYYY-MM-DD local timezone consistently
  const parseDateSafe = (dStr) => {
    if (!dStr) return null;
    if (typeof dStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dStr)) {
      const parts = dStr.split('T')[0].split('-');
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? null : d;
  };

  // Apply Date and Work Type filters
  const filteredRecords = useMemo(() => {
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();

    // Start of week (Monday 00:00:00) to end of week (Sunday 23:59:59)
    const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    const startOfWeek = new Date(todayYear, todayMonth, todayDate - dayOfWeek, 0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return employeePayrolls.filter((rec) => {
      // 1. Date Filter
      const recDate = parseDateSafe(rec.workDate || rec.weekEnd || rec.weekStart || rec.createdAt || rec.date);

      if (periodFilter === 'Today') {
        if (!recDate) return false;
        if (
          recDate.getFullYear() !== todayYear ||
          recDate.getMonth() !== todayMonth ||
          recDate.getDate() !== todayDate
        ) {
          return false;
        }
      } else if (periodFilter === 'This Week') {
        if (!recDate || recDate < startOfWeek || recDate > endOfWeek) {
          return false;
        }
      } else if (periodFilter === 'This Month') {
        if (!recDate || recDate.getMonth() !== todayMonth || recDate.getFullYear() !== todayYear) {
          return false;
        }
      } else if (periodFilter === 'This Year') {
        if (!recDate || recDate.getFullYear() !== todayYear) {
          return false;
        }
      } else if (periodFilter === 'Custom Day') {
        if (customSingleDate) {
          const [cy, cm, cd] = customSingleDate.split('-').map(Number);
          if (
            !recDate ||
            recDate.getFullYear() !== cy ||
            recDate.getMonth() !== cm - 1 ||
            recDate.getDate() !== cd
          ) {
            return false;
          }
        }
      } else if (periodFilter === 'Custom Range' || periodFilter === 'Custom') {
        if (customStartDate) {
          const [sy, sm, sd] = customStartDate.split('-').map(Number);
          const startD = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
          if (!recDate || recDate < startD) return false;
        }
        if (customEndDate) {
          const [ey, em, ed] = customEndDate.split('-').map(Number);
          const endD = new Date(ey, em - 1, ed, 23, 59, 59, 999);
          if (!recDate || recDate > endD) return false;
        }
      }

      // 2. Work Type Filter
      if (workTypeFilter !== 'All') {
        const wType = String(rec.workType || '').toLowerCase();
        if (workTypeFilter === 'Day Salary' && !wType.includes('day')) return false;
        if (workTypeFilter === 'Count Based Salary' && !wType.includes('count')) return false;
        if (workTypeFilter === 'Size Based Salary' && !wType.includes('size')) return false;
      }

      return true;
    });
  }, [employeePayrolls, periodFilter, customSingleDate, customStartDate, customEndDate, workTypeFilter]);

  // Overall Financial Statistics
  const financialStats = useMemo(() => {
    const totalGross = filteredRecords.reduce((sum, r) => sum + (Number(r.grossPay) || 0), 0);
    const totalDeductions = filteredRecords.reduce((sum, r) => sum + (Number(r.deductions) || 0), 0);
    const totalNet = filteredRecords.reduce(
      (sum, r) => sum + (Number(r.netPay !== undefined ? r.netPay : r.grossPay) || 0),
      0
    );
    const paidCount = filteredRecords.filter((r) => String(r.status || '').toLowerCase() === 'paid').length;
    const pendingCount = filteredRecords.filter((r) => String(r.status || '').toLowerCase() !== 'paid').length;

    return {
      totalGross,
      totalDeductions,
      totalNet,
      totalRecords: filteredRecords.length,
      paidCount,
      pendingCount
    };
  }, [filteredRecords]);

  // Formatted Label for Active Period Filter
  const periodLabel = useMemo(() => {
    if (periodFilter === 'Today') return `Today (${formatDate(new Date())})`;
    if (periodFilter === 'This Week') return 'This Week';
    if (periodFilter === 'This Month') return 'This Month';
    if (periodFilter === 'This Year') return 'This Year';
    if (periodFilter === 'Custom Day') return customSingleDate ? `Day: ${formatDate(customSingleDate)}` : 'Custom Day';
    if (periodFilter === 'Custom Range' || periodFilter === 'Custom') {
      if (customStartDate && customEndDate) return `${formatDate(customStartDate)} – ${formatDate(customEndDate)}`;
      if (customStartDate) return `From ${formatDate(customStartDate)}`;
      if (customEndDate) return `Up to ${formatDate(customEndDate)}`;
      return 'Custom Range';
    }
    return 'All Time';
  }, [periodFilter, customSingleDate, customStartDate, customEndDate]);

  // Day Salary Breakdown
  const daySalaryStats = useMemo(() => {
    const dayRecords = filteredRecords.filter((r) => String(r.workType || '').toLowerCase().includes('day'));
    const totalDaysWorked = dayRecords.reduce((sum, r) => sum + (Number(r.daysWorked) || 0), 0);
    const totalLeaveDays = dayRecords.reduce((sum, r) => sum + (Number(r.leaveDays) || 0), 0);
    const defaultRate = Number(employee?.dailyRate || 600);
    const totalDayGross = dayRecords.reduce(
      (sum, r) => sum + (Number(r.grossPay) || (Number(r.daysWorked || 0) * (Number(r.rate || defaultRate)))),
      0
    );
    const totalDayNet = dayRecords.reduce(
      (sum, r) => sum + (Number(r.netPay !== undefined ? r.netPay : r.grossPay) || 0),
      0
    );
    const totalHoursWorked = dayRecords.reduce((sum, r) => sum + (Number(r.hoursWorked || r.workHours || 8) * (Number(r.daysWorked) || 0)), 0);

    const totalDaysLogged = totalDaysWorked + totalLeaveDays;
    const attendanceRate = totalDaysLogged > 0 ? Math.round((totalDaysWorked / totalDaysLogged) * 100) : 100;

    return {
      recordCount: dayRecords.length,
      totalDaysWorked,
      totalLeaveDays,
      dailyRate: defaultRate,
      totalDayGross,
      totalDayNet,
      totalHoursWorked,
      attendanceRate
    };
  }, [filteredRecords, employee]);

  // Size-Based Salary Breakdown
  const sizeSalaryStats = useMemo(() => {
    const sizeRecords = filteredRecords.filter((r) => String(r.workType || '').toLowerCase().includes('size'));
    const sizeMap = new Map(); // sizeKey -> { size, rate, qty, amount }

    let totalPieces = 0;
    let totalSizeGross = 0;

    sizeRecords.forEach((rec) => {
      // 1. Process array breakdown (sizeWiseProduction / sizeProduction)
      const list = Array.isArray(rec.sizeWiseProduction) && rec.sizeWiseProduction.length > 0
        ? rec.sizeWiseProduction
        : Array.isArray(rec.sizeProduction) && rec.sizeProduction.length > 0
        ? rec.sizeProduction
        : null;

      if (list) {
        list.forEach((item) => {
          const sizeName = item.size || 'Standard Towel';
          const qty = Math.max(0, Number(item.qty) || 0);
          const rate = Math.max(0, Number(item.rate) || 0);
          const amt = Number(item.amount !== undefined ? item.amount : qty * rate) || 0;

          if (!sizeMap.has(sizeName)) {
            sizeMap.set(sizeName, { size: sizeName, rate, qty: 0, amount: 0 });
          }
          const curr = sizeMap.get(sizeName);
          curr.qty += qty;
          curr.amount += amt;
          if (rate > 0) curr.rate = rate;

          totalPieces += qty;
          totalSizeGross += amt;
        });
      } else {
        // 2. Legacy/flat fields
        const lQty = Math.max(0, Number(rec.largeQuantity) || 0);
        const lPrice = Number(rec.largePrice || 5);
        if (lQty > 0) {
          const k = 'Large (30 × 60)';
          if (!sizeMap.has(k)) sizeMap.set(k, { size: k, rate: lPrice, qty: 0, amount: 0 });
          sizeMap.get(k).qty += lQty;
          sizeMap.get(k).amount += lQty * lPrice;
          totalPieces += lQty;
          totalSizeGross += lQty * lPrice;
        }

        const mQty = Math.max(0, Number(rec.mediumQuantity) || 0);
        const mPrice = Number(rec.mediumPrice || 4);
        if (mQty > 0) {
          const k = 'Medium (27 × 54)';
          if (!sizeMap.has(k)) sizeMap.set(k, { size: k, rate: mPrice, qty: 0, amount: 0 });
          sizeMap.get(k).qty += mQty;
          sizeMap.get(k).amount += mQty * mPrice;
          totalPieces += mQty;
          totalSizeGross += mQty * mPrice;
        }

        const sQty = Math.max(0, Number(rec.smallQuantity) || 0);
        const sPrice = Number(rec.smallPrice || 3);
        if (sQty > 0) {
          const k = 'Small (24 × 47)';
          if (!sizeMap.has(k)) sizeMap.set(k, { size: k, rate: sPrice, qty: 0, amount: 0 });
          sizeMap.get(k).qty += sQty;
          sizeMap.get(k).amount += sQty * sPrice;
          totalPieces += sQty;
          totalSizeGross += sQty * sPrice;
        }
      }
    });

    const breakdownList = Array.from(sizeMap.values()).map((s) => ({
      ...s,
      percentage: totalPieces > 0 ? Math.round((s.qty / totalPieces) * 100) : 0
    }));

    // Sort: highest quantity first
    breakdownList.sort((a, b) => b.qty - a.qty);

    return {
      recordCount: sizeRecords.length,
      totalPieces,
      totalSizeGross,
      breakdownList
    };
  }, [filteredRecords]);

  // Count-Based Salary Breakdown
  const countSalaryStats = useMemo(() => {
    const countRecords = filteredRecords.filter((r) => String(r.workType || '').toLowerCase().includes('count'));

    const totalQty = countRecords.reduce(
      (sum, r) => sum + (Number(r.countQuantity !== undefined ? r.countQuantity : r.productsProduced) || 0),
      0
    );
    const totalCountGross = countRecords.reduce((sum, r) => sum + (Number(r.grossPay) || 0), 0);
    const totalCountNet = countRecords.reduce(
      (sum, r) => sum + (Number(r.netPay !== undefined ? r.netPay : r.grossPay) || 0),
      0
    );
    const pieceRate = Number(employee?.pieceRate || countRecords[0]?.pricePerItem || countRecords[0]?.rate || 12);

    const productSet = new Set();
    countRecords.forEach((r) => {
      if (r.productName) productSet.add(r.productName);
    });

    return {
      recordCount: countRecords.length,
      totalQty,
      totalCountGross,
      totalCountNet,
      pieceRate,
      products: Array.from(productSet).length > 0 ? Array.from(productSet).join(', ') : 'Towels'
    };
  }, [filteredRecords, employee]);

  // Export salary report for this specific employee
  const handleExportStatement = () => {
    if (!filteredRecords.length) return;

    const rows = filteredRecords.map((r, idx) => ({
      sno: idx + 1,
      empId: r.empId || employee.empId,
      name: r.employeeName || employee.name,
      workType: r.workType,
      date: formatDate(r.workDate || r.weekEnd || r.createdAt),
      daysWorked: r.daysWorked || 0,
      leaveDays: r.leaveDays || 0,
      productsProduced: r.productsProduced || r.countQuantity || 0,
      grossPay: r.grossPay || 0,
      deductions: r.deductions || 0,
      netPay: r.netPay !== undefined ? r.netPay : r.grossPay,
      status: r.status || 'Paid'
    }));

    storageService.exportToCSV(`Salary_Statement_${employee.empId}_${periodFilter.replace(/\s+/g, '_')}`, rows);
  };

  if (!isOpen || !employee) return null;

  const empTypes = Array.isArray(employee.workTypes) && employee.workTypes.length > 0
    ? employee.workTypes
    : [employee.workType || employee.type || 'Day Salary'];

  return (
    <>
      {/* Dimmed Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(3px)',
          zIndex: 9998,
          transition: 'opacity 0.25s ease'
        }}
      />

      {/* Slide-over Sidepanel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '580px',
          maxWidth: '95vw',
          backgroundColor: '#ffffff',
          boxShadow: '-8px 0 30px rgba(0, 0, 0, 0.18)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          animation: 'slideInRight 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        {/* 1. Header with Employee Profile */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#eff6ff',
                color: 'var(--primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                fontWeight: 800,
                border: '2px solid #bfdbfe',
                flexShrink: 0
              }}
            >
              {employee.name ? employee.name.charAt(0).toUpperCase() : 'E'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  {employee.name}
                </h3>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569'
                  }}
                >
                  {employee.empId}
                </span>
                <StatusBadge status={employee.status || 'Active'} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <Phone size={12} /> {employee.phone || 'No phone'}
                </span>
                <span>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <Calendar size={12} /> Joined {formatDate(employee.joinDate)}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
              flexShrink: 0
            }}
            title="Close Panel (Esc)"
          >
            <X size={17} />
          </button>
        </div>

        {/* 2. Assigned Work Types Pill Ribbon */}
        <div
          style={{
            padding: '0.65rem 1.5rem',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            flexShrink: 0,
            fontSize: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Assigned Methods:</span>
            {empTypes.map((t) => {
              const isDay = t.toLowerCase().includes('day');
              const isCount = t.toLowerCase().includes('count');
              const isSize = t.toLowerCase().includes('size');
              return (
                <span
                  key={t}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    backgroundColor: isDay ? '#eff6ff' : isCount ? '#f5f3ff' : '#e0f2fe',
                    color: isDay ? '#1d4ed8' : isCount ? '#6d28d9' : '#0369a1',
                    border: `1px solid ${isDay ? '#bfdbfe' : isCount ? '#ddd6fe' : '#bae6fd'}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {isDay && <Calendar size={11} />}
                  {isCount && <Box size={11} />}
                  {isSize && <Layers size={11} />}
                  {t}
                </span>
              );
            })}
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportStatement}
            style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem', gap: '4px' }}
            title="Export this employee's salary statement"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>

        {/* 3. Date / Day Filter Bar */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Filter size={13} color="var(--primary-600)" /> Filter Salary By Day / Period:
            </span>

            {/* Quick Period Selector */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {[
                { id: 'Today', label: 'Today' },
                { id: 'This Week', label: 'This Week' },
                { id: 'This Month', label: 'This Month' },
                { id: 'This Year', label: 'This Year' },
                { id: 'Custom Day', label: 'Custom Day' },
                { id: 'Custom Range', label: 'Custom Range' },
                { id: 'All Time', label: 'All Time' }
              ].map((p) => {
                const isActive = periodFilter === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPeriodFilter(p.id)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: isActive ? 700 : 500,
                      border: isActive ? '1px solid var(--primary-600)' : '1px solid #e2e8f0',
                      backgroundColor: isActive ? 'var(--primary-50)' : '#ffffff',
                      color: isActive ? 'var(--primary-600)' : '#475569',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Day (Single Date Picker) */}
          {periodFilter === 'Custom Day' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.65rem',
                backgroundColor: '#f0f9ff',
                padding: '0.55rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid #bae6fd'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CalendarDays size={15} color="#0284c7" />
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', margin: 0 }}>
                  Select Specific Day:
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <input
                  type="date"
                  className="form-control"
                  style={{ height: '32px', fontSize: '0.78rem', width: '150px', backgroundColor: '#ffffff' }}
                  value={customSingleDate}
                  onChange={(e) => setCustomSingleDate(e.target.value)}
                />
                {customSingleDate && (
                  <span style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 600 }}>
                    Viewing: {formatDate(customSingleDate)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Custom Date Range Pickers */}
          {(periodFilter === 'Custom Range' || periodFilter === 'Custom') && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.65rem',
                backgroundColor: '#f8fafc',
                padding: '0.55rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid #e2e8f0'
              }}
            >
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>
                  From Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  style={{ height: '30px', fontSize: '0.75rem' }}
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>
                  To Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  style={{ height: '30px', fontSize: '0.75rem' }}
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* 4. Tab Navigation Bar */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: '#ffffff',
            flexShrink: 0
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            style={{
              flex: 1,
              padding: '0.75rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              border: 'none',
              borderBottom: activeTab === 'summary' ? '2px solid var(--primary-600)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'summary' ? 'var(--primary-600)' : '#64748b',
              cursor: 'pointer'
            }}
          >
            💰 Salary Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('breakdowns')}
            style={{
              flex: 1,
              padding: '0.75rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              border: 'none',
              borderBottom: activeTab === 'breakdowns' ? '2px solid var(--primary-600)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'breakdowns' ? 'var(--primary-600)' : '#64748b',
              cursor: 'pointer'
            }}
          >
            📊 Work Breakdown
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1,
              padding: '0.75rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              border: 'none',
              borderBottom: activeTab === 'history' ? '2px solid var(--primary-600)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'history' ? 'var(--primary-600)' : '#64748b',
              cursor: 'pointer'
            }}
          >
            📋 Records ({filteredRecords.length})
          </button>
        </div>

        {/* 5. Scrollable Body Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* TAB 1: SALARY OVERVIEW */}
          {activeTab === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              {/* Primary Net Salary Card */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem',
                  color: '#ffffff',
                  boxShadow: '0 8px 16px -4px rgba(37, 99, 235, 0.35)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.9 }}>
                      Total Net Salary Earned ({periodLabel})
                    </span>
                    <h2 style={{ fontSize: '1.85rem', fontWeight: 800, margin: '6px 0 2px' }}>
                      {formatINR(financialStats.totalNet)}
                    </h2>
                    <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                      Calculated across {financialStats.totalRecords} payroll record{financialStats.totalRecords === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      borderRadius: 'var(--radius-md)',
                      padding: '6px 12px',
                      textAlign: 'right',
                      fontSize: '0.72rem'
                    }}
                  >
                    <div>Paid: <strong>{financialStats.paidCount}</strong></div>
                    <div>Pending: <strong>{financialStats.pendingCount}</strong></div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    marginTop: '1rem',
                    paddingTop: '0.85rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                    fontSize: '0.8rem'
                  }}
                >
                  <div>
                    <span style={{ opacity: 0.8 }}>Gross Salary:</span>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{formatINR(financialStats.totalGross)}</div>
                  </div>
                  <div>
                    <span style={{ opacity: 0.8 }}>Total Deductions:</span>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{formatINR(financialStats.totalDeductions)}</div>
                  </div>
                </div>
              </div>

              {/* Quick Summary Highlights for Day, Size, and Count */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {/* Day Salary Quick Box */}
                <div
                  style={{
                    padding: '0.85rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} /> Day Salary
                    </span>
                    <span style={{ fontSize: '0.68rem', backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>
                      {daySalaryStats.attendanceRate}% Attendance
                    </span>
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    {daySalaryStats.totalDaysWorked} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>days worked</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Leave: <strong style={{ color: '#dc2626' }}>{daySalaryStats.totalLeaveDays} days</strong></span>
                    <span>Wage: <strong>{formatINR(daySalaryStats.totalDayNet)}</strong></span>
                  </div>
                </div>

                {/* Size-wise Towel Output Quick Box */}
                <div
                  style={{
                    padding: '0.85rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Layers size={13} /> Size Production
                    </span>
                    <span style={{ fontSize: '0.68rem', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>
                      {sizeSalaryStats.breakdownList.length} Sizes
                    </span>
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    {sizeSalaryStats.totalPieces.toLocaleString('en-IN')} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>pcs recorded</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total Output</span>
                    <span>Earned: <strong>{formatINR(sizeSalaryStats.totalSizeGross)}</strong></span>
                  </div>
                </div>
              </div>

              {/* Count Salary Quick Box */}
              <div
                style={{
                  padding: '0.85rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#f5f3ff',
                      color: '#7c3aed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Box size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4c1d95' }}>Count-Based Salary Output</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Rate: ₹{countSalaryStats.pieceRate} / pc • Product: {countSalaryStats.products}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                    {countSalaryStats.totalQty.toLocaleString('en-IN')} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>items</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d' }}>{formatINR(countSalaryStats.totalCountGross)}</div>
                </div>
              </div>

              {/* Switch to Detailed Breakdowns Prompt */}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveTab('breakdowns')}
                style={{ width: '100%', justifyContent: 'center', gap: '6px', fontSize: '0.8rem', padding: '0.6rem' }}
              >
                <TrendingUp size={14} color="var(--primary-600)" /> View Full Size-Wise & Day Attendance Breakdowns →
              </button>
            </div>
          )}

          {/* TAB 2: DETAILED WORK BREAKDOWNS (DAY, SIZE & COUNT) */}
          {activeTab === 'breakdowns' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* SECTION A: DAY SALARY & ATTENDANCE BREAKDOWN */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#ffffff',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    backgroundColor: '#eff6ff',
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={16} color="#1d4ed8" />
                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1e3a8a' }}>
                      Day Salary & Attendance Details
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1d4ed8', backgroundColor: '#dbeafe', padding: '2px 7px', borderRadius: '4px' }}>
                    ₹ {daySalaryStats.dailyRate} / day
                  </span>
                </div>

                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
                    <div style={{ padding: '0.65rem', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: '#15803d', fontWeight: 600 }}>Days Worked</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d' }}>{daySalaryStats.totalDaysWorked}</div>
                      <div style={{ fontSize: '0.65rem', color: '#166534' }}>Working Days</div>
                    </div>

                    <div style={{ padding: '0.65rem', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: '#dc2626', fontWeight: 600 }}>Leave Days</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>{daySalaryStats.totalLeaveDays}</div>
                      <div style={{ fontSize: '0.65rem', color: '#991b1b' }}>Recorded Off</div>
                    </div>

                    <div style={{ padding: '0.65rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 600 }}>Total Day Earnings</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{formatINR(daySalaryStats.totalDayNet)}</div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Net Earned</div>
                    </div>
                  </div>

                  {/* Attendance Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', marginBottom: '4px' }}>
                      <span>Attendance Consistency ({daySalaryStats.attendanceRate}%)</span>
                      <span>{daySalaryStats.totalDaysWorked} Worked / {daySalaryStats.totalDaysWorked + daySalaryStats.totalLeaveDays} Total</span>
                    </div>
                    <div style={{ height: '7px', backgroundColor: '#fee2e2', borderRadius: '999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${daySalaryStats.attendanceRate}%`,
                          backgroundColor: '#16a34a',
                          borderRadius: '999px'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION B: SIZE-BASED PRODUCTION & ITEM DETAILS */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#ffffff',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    backgroundColor: '#f0f9ff',
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #bae6fd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Layers size={16} color="#0284c7" />
                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0369a1' }}>
                      Size-Wise Recorded Towel Production
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '2px 7px', borderRadius: '4px' }}>
                    {sizeSalaryStats.totalPieces.toLocaleString('en-IN')} Pcs Total
                  </span>
                </div>

                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {sizeSalaryStats.breakdownList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      No size-based towel records found for the selected period.
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {sizeSalaryStats.breakdownList.map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '0.75rem',
                              backgroundColor: '#f8fafc',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1e293b' }}>
                                {item.size}
                              </span>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#15803d' }}>
                                  {formatINR(item.amount)}
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
                              <span>Rate: <strong>₹ {item.rate.toFixed(2)}</strong> / item</span>
                              <span>Recorded Qty: <strong>{item.qty.toLocaleString('en-IN')} pcs</strong> ({item.percentage}%)</span>
                            </div>

                            {/* Share of output progress bar */}
                            <div style={{ height: '5px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${item.percentage}%`,
                                  backgroundColor: idx === 0 ? '#0284c7' : idx === 1 ? '#3b82f6' : '#8b5cf6',
                                  borderRadius: '999px'
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div
                        style={{
                          padding: '0.65rem 0.85rem',
                          backgroundColor: '#ecfdf5',
                          borderRadius: '6px',
                          border: '1px solid #a7f3d0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: '#065f46'
                        }}
                      >
                        <span>Total Size Earnings:</span>
                        <span style={{ fontSize: '0.95rem' }}>{formatINR(sizeSalaryStats.totalSizeGross)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* SECTION C: COUNT-BASED PRODUCTION BREAKDOWN */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#ffffff',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    backgroundColor: '#faf5ff',
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #e9d5ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Box size={16} color="#7c3aed" />
                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#581c87' }}>
                      Count-Based Salary Production
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b21a8', backgroundColor: '#f3e8ff', padding: '2px 7px', borderRadius: '4px' }}>
                    ₹ {countSalaryStats.pieceRate} / item
                  </span>
                </div>

                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Total Items Produced</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                        {countSalaryStats.totalQty.toLocaleString('en-IN')} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>pcs</span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#7c3aed' }}>{countSalaryStats.products}</div>
                    </div>

                    <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Total Count Wages</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d' }}>
                        {formatINR(countSalaryStats.totalCountGross)}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#15803d' }}>Net: {formatINR(countSalaryStats.totalCountNet)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COMPLETE SALARY RECORDS LIST */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                  Recorded Payroll Entries ({filteredRecords.length})
                </span>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Click row to expand details
                </span>
              </div>

              {filteredRecords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px dashed #cbd5e1' }}>
                  <CalendarDays size={32} color="#94a3b8" style={{ margin: '0 auto 0.5rem' }} />
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>No salary records found</p>
                  <span style={{ fontSize: '0.75rem' }}>No payroll entries match the selected period filter ({periodFilter}).</span>
                </div>
              ) : (
                filteredRecords.map((rec) => {
                  const isExpanded = expandedRecordId === (rec._id || rec.id);
                  const isDay = String(rec.workType || '').toLowerCase().includes('day');
                  const isCount = String(rec.workType || '').toLowerCase().includes('count');
                  const isSize = String(rec.workType || '').toLowerCase().includes('size');
                  const dateStr = formatDate(rec.workDate || rec.weekEnd || rec.createdAt);

                  return (
                    <div
                      key={rec._id || rec.id || Math.random()}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        transition: 'border-color 0.2s ease'
                      }}
                    >
                      {/* Record Summary Row */}
                      <div
                        onClick={() => setExpandedRecordId(isExpanded ? null : (rec._id || rec.id))}
                        style={{
                          padding: '0.75rem 1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          backgroundColor: isExpanded ? '#f8fafc' : '#ffffff'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span
                            style={{
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              backgroundColor: isDay ? '#eff6ff' : isCount ? '#f5f3ff' : '#e0f2fe',
                              color: isDay ? '#1d4ed8' : isCount ? '#6d28d9' : '#0369a1'
                            }}
                          >
                            {rec.workType || 'Salary'}
                          </span>

                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
                              {dateStr}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              {isDay && `${rec.daysWorked || 0} days worked • ${rec.leaveDays || 0} leave`}
                              {isSize && `${rec.productsProduced || 0} pcs towels produced`}
                              {isCount && `${rec.countQuantity || rec.productsProduced || 0} pcs produced`}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#15803d' }}>
                              {formatINR(rec.netPay !== undefined ? rec.netPay : rec.grossPay)}
                            </div>
                            <StatusBadge status={rec.status || 'Paid'} />
                          </div>
                          {isExpanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                        </div>
                      </div>

                      {/* Expandable Breakdown Accordion */}
                      {isExpanded && (
                        <div
                          style={{
                            padding: '0.85rem 1rem',
                            borderTop: '1px solid #f1f5f9',
                            backgroundColor: '#f8fafc',
                            fontSize: '0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem'
                          }}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                            <div>
                              <span style={{ color: '#64748b' }}>Gross Pay:</span>
                              <div style={{ fontWeight: 700, color: '#1e293b' }}>{formatINR(rec.grossPay || 0)}</div>
                            </div>
                            <div>
                              <span style={{ color: '#64748b' }}>Deductions:</span>
                              <div style={{ fontWeight: 700, color: '#dc2626' }}>{formatINR(rec.deductions || 0)}</div>
                            </div>
                            <div>
                              <span style={{ color: '#64748b' }}>Net Salary:</span>
                              <div style={{ fontWeight: 800, color: '#15803d' }}>{formatINR(rec.netPay !== undefined ? rec.netPay : rec.grossPay)}</div>
                            </div>
                          </div>

                          {/* Size-wise table inside record */}
                          {isSize && Array.isArray(rec.sizeWiseProduction || rec.sizeProduction) && (
                            <div style={{ marginTop: '4px' }}>
                              <strong style={{ color: '#475569', fontSize: '0.72rem' }}>Size Production Breakdown:</strong>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '3px' }}>
                                {(rec.sizeWiseProduction || rec.sizeProduction).map((s, sIdx) => (
                                  <span
                                    key={sIdx}
                                    style={{
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      backgroundColor: '#ffffff',
                                      border: '1px solid #e2e8f0',
                                      fontSize: '0.7rem'
                                    }}
                                  >
                                    <strong>{s.size}:</strong> {s.qty} pcs @ ₹{s.rate} = ₹{s.amount || (s.qty * s.rate)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {rec.remarks && (
                            <div style={{ fontStyle: 'italic', color: '#64748b' }}>
                              Remarks: {rec.remarks}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* 6. Footer Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexShrink: 0
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
          >
            Close
          </button>

          <div style={{ display: 'flex', gap: '0.65rem' }}>
            {onEditEmployee && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  onClose();
                  onEditEmployee(employee);
                }}
                style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}
              >
                Edit Profile
              </button>
            )}

            {onRecordSalary && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onClose();
                  onRecordSalary(employee);
                }}
                style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', gap: '6px' }}
              >
                Record Salary
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
