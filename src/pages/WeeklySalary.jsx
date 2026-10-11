import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  DollarSign,
  Users,
  Plus,
  Download,
  Printer,
  CheckCircle,
  Save,
  FileSpreadsheet,
  Search,
  CheckCheck,
  Eye,
  Edit2,
  Trash2,
  Lock,
  Layers,
  PackageCheck,
  FileText,
  Calculator,
  RotateCcw,
  Package,
  Clock,
  Sparkles
} from 'lucide-react';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Toast from '../components/common/Toast';
import StatusBadge from '../components/common/StatusBadge';
import { storageService } from '../services/storageService';
import { formatINR, formatDate, formatDateTime, isPaidLocked } from '../utils/formatters';

const defaultToday = new Date().toISOString().split('T')[0];

// Standard Towel Sizes & Fixed Rates as specified:
// Large: 30 × 60 — ₹5 per item
// Medium: 27 × 54 — ₹4 per item
// Small: 24 × 47 — ₹3 per item
const DEFAULT_SIZE_RATES = [
  { size: 'Large (30 × 60)', rate: 5 },
  { size: 'Medium (27 × 54)', rate: 4 },
  { size: 'Small (24 × 47)', rate: 3 }
];

const DEFAULT_SIZE_PRODUCTION = [
  { size: 'Large (30 × 60)', rate: 5, qty: 100, amount: 500 },
  { size: 'Medium (27 × 54)', rate: 4, qty: 50, amount: 200 },
  { size: 'Small (24 × 47)', rate: 3, qty: 80, amount: 240 }
];

const INITIAL_RECORD = {
  empId: '',
  employeeName: '',
  workType: 'Size Based Salary', // 'Size Based Salary' | 'Count Based Salary' | 'Day Salary'
  productName: 'Towel',
  workDate: defaultToday,

  // Size-Based Salary fields
  sizeRates: DEFAULT_SIZE_RATES,
  sizeProduction: DEFAULT_SIZE_PRODUCTION,

  // Count-Based Salary fields
  pricePerItem: 5,
  countQuantity: 200,

  // Day Salary fields
  dayRate: 600,
  daysWorked: 6,

  // Other Details
  workHours: 8,
  leaveDays: 0,
  deductions: 0,
  adjustments: 0,
  remarks: '',
  status: 'Pending'
};

export default function WeeklySalary() {
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [weekStart, setWeekStart] = useState('2026-10-08');
  const [weekEnd, setWeekEnd] = useState('2026-10-14');
  const [workTypeFilter, setWorkTypeFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [recordForm, setRecordForm] = useState(INITIAL_RECORD);
  const [editingId, setEditingId] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);
  const editorRef = useRef(null);

  const loadData = async () => {
    try {
      const payroll = await storageService.fetchLiveCollection('weeklyPayroll');
      const emps = await storageService.fetchLiveCollection('employees');
      setItems(payroll || []);
      setEmployees(emps || []);

      if (emps && emps.length > 0 && !recordForm.empId) {
        setRecordForm(prev => ({
          ...prev,
          empId: emps[0].empId,
          employeeName: emps[0].name
        }));
      }
    } catch {
      const payroll = storageService.getCollection('weeklyPayroll');
      const emps = storageService.getCollection('employees');
      setItems(payroll || []);
      setEmployees(emps || []);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // --- Real-Time Salary Calculations ---

  // Size-Based Salary: Sum of (Qty × Rate) across sizes
  // Formula: (Large Qty × ₹5) + (Medium Qty × ₹4) + (Small Qty × ₹3) + any additional sizes
  const sizeTotalQty = useMemo(() => {
    return (recordForm.sizeProduction || []).reduce(
      (sum, item) => sum + Math.max(0, Number(item.qty) || 0),
      0
    );
  }, [recordForm.sizeProduction]);

  const sizeTotalAmount = useMemo(() => {
    return (recordForm.sizeProduction || []).reduce(
      (sum, item) => {
        const qty = Math.max(0, Number(item.qty) || 0);
        const rate = Math.max(0, Number(item.rate) || 0);
        return sum + (qty * rate);
      },
      0
    );
  }, [recordForm.sizeProduction]);

  // Count-Based Salary: Quantity Produced × Price Per Item
  const countTotalQty = Math.max(0, Number(recordForm.countQuantity) || 0);
  const countPricePerItem = Math.max(0, Number(recordForm.pricePerItem) || 0);
  const countTotalAmount = countTotalQty * countPricePerItem;

  // Day Salary: Days Worked × Daily Rate
  const dayDaysWorked = Math.max(0, Number(recordForm.daysWorked) || 0);
  const dayDailyRate = Math.max(0, Number(recordForm.dayRate) || 0);
  const dayTotalAmount = dayDaysWorked * dayDailyRate;

  // Active Calculated Gross Salary
  const computedGrossSalary = useMemo(() => {
    if (recordForm.workType === 'Size Based Salary') return sizeTotalAmount;
    if (recordForm.workType === 'Count Based Salary') return countTotalAmount;
    return dayTotalAmount;
  }, [recordForm.workType, sizeTotalAmount, countTotalAmount, dayTotalAmount]);

  // Net Pay = Gross Salary - Deductions
  const computedNetSalary = Math.max(0, computedGrossSalary - (Number(recordForm.deductions) || 0));

  // Summary Metrics for Bottom Bar
  const summary = useMemo(() => {
    const totalEmployees = items.length;
    const totalGross = items.reduce((acc, curr) => acc + (Number(curr.grossPay) || 0), 0);
    const totalDeductions = items.reduce((acc, curr) => acc + (Number(curr.deductions) || 0), 0);
    const totalNet = items.reduce((acc, curr) => acc + (Number(curr.netPay) || 0), 0);
    return { totalEmployees, totalGross, totalDeductions, totalNet };
  }, [items]);

  // Filtered Items for Grid
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.empId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.productName?.toLowerCase().includes(searchQuery.toLowerCase());

      const itemType = item.workType || '';
      const matchesType =
        workTypeFilter === 'All' ||
        (workTypeFilter === 'Size Based Salary' && (itemType.includes('Size') || itemType === 'SIZE_SALARY')) ||
        (workTypeFilter === 'Count Based Salary' && (itemType.includes('Count') || itemType === 'COUNT_SALARY')) ||
        (workTypeFilter === 'Day Salary' && (itemType.includes('Day') || itemType === 'DAY_SALARY'));

      return matchesSearch && matchesType;
    });
  }, [items, searchQuery, workTypeFilter]);

  const sortedItems = useMemo(() => {
    return filteredItems.map((item, index) => ({
      ...item,
      sno: index + 1
    }));
  }, [filteredItems]);

  // --- Handlers for Size-Based Salary ---
  const handleSizeRateChange = (index, field, value) => {
    setRecordForm(prev => {
      const updatedRates = [...prev.sizeRates];
      const newRate = field === 'rate' ? Math.max(0, Number(value) || 0) : updatedRates[index].rate;
      const newSize = field === 'size' ? value : updatedRates[index].size;

      updatedRates[index] = {
        ...updatedRates[index],
        [field]: field === 'rate' ? newRate : newSize
      };

      const updatedProd = [...prev.sizeProduction];
      if (updatedProd[index]) {
        const currentQty = Math.max(0, Number(updatedProd[index].qty) || 0);
        updatedProd[index] = {
          ...updatedProd[index],
          size: newSize,
          rate: newRate,
          amount: currentQty * newRate
        };
      }

      return {
        ...prev,
        sizeRates: updatedRates,
        sizeProduction: updatedProd
      };
    });
  };

  const handleAddSizeRate = () => {
    setRecordForm(prev => {
      const newIndex = prev.sizeRates.length + 1;
      const newSizeName = `Custom Size ${newIndex}`;
      const newRate = 6;
      const newRates = [...prev.sizeRates, { size: newSizeName, rate: newRate }];
      const newProd = [...prev.sizeProduction, { size: newSizeName, rate: newRate, qty: 0, amount: 0 }];
      return {
        ...prev,
        sizeRates: newRates,
        sizeProduction: newProd
      };
    });
  };

  const handleDeleteSizeRate = (index) => {
    setRecordForm(prev => {
      if (prev.sizeRates.length <= 1) {
        showToast('At least one size is required.', 'error');
        return prev;
      }
      const newRates = prev.sizeRates.filter((_, i) => i !== index);
      const newProd = prev.sizeProduction.filter((_, i) => i !== index);
      return {
        ...prev,
        sizeRates: newRates,
        sizeProduction: newProd
      };
    });
  };

  const handleProductionQtyChange = (index, qtyVal) => {
    // Validate non-negative quantities
    const rawVal = qtyVal === '' ? '' : Math.max(0, Number(qtyVal) || 0);
    const qty = typeof rawVal === 'number' ? rawVal : 0;

    setRecordForm(prev => {
      const updatedProd = [...prev.sizeProduction];
      if (updatedProd[index]) {
        const rate = Math.max(0, Number(updatedProd[index].rate) || 0);
        updatedProd[index] = {
          ...updatedProd[index],
          qty: rawVal,
          amount: qty * rate
        };
      }
      return {
        ...prev,
        sizeProduction: updatedProd
      };
    });
  };

  // Select Employee
  const handleSelectEmployee = (empId) => {
    const emp = employees.find(e => e.empId === empId);
    if (emp) {
      setRecordForm(prev => ({
        ...prev,
        empId: emp.empId,
        employeeName: emp.name,
        dayRate: emp.dailyRate || prev.dayRate,
        pricePerItem: emp.pieceRate || prev.pricePerItem
      }));
    }
  };

  // Reset form
  const handleResetForm = () => {
    setEditingId(null);
    const firstEmp = employees[0];
    setRecordForm({
      ...INITIAL_RECORD,
      empId: firstEmp ? firstEmp.empId : '',
      employeeName: firstEmp ? firstEmp.name : '',
      sizeRates: [...DEFAULT_SIZE_RATES],
      sizeProduction: [...DEFAULT_SIZE_PRODUCTION]
    });
    showToast('Salary calculation form has been reset.', 'neutral');
  };

  // Save / Update Record
  const handleSaveRecord = async (e) => {
    if (e) e.preventDefault();

    if (!recordForm.employeeName || !recordForm.empId) {
      showToast('Please select a valid employee.', 'error');
      return;
    }

    const isSize = recordForm.workType === 'Size Based Salary';
    const isCount = recordForm.workType === 'Count Based Salary';
    const isDay = recordForm.workType === 'Day Salary';

    // Find quantities for Large, Medium, Small
    const getQtyForSize = (keyword) => {
      const found = (recordForm.sizeProduction || []).find(p => p.size?.toLowerCase().includes(keyword.toLowerCase()));
      return found ? Math.max(0, Number(found.qty) || 0) : 0;
    };
    const getRateForSize = (keyword, defaultRate) => {
      const found = (recordForm.sizeProduction || []).find(p => p.size?.toLowerCase().includes(keyword.toLowerCase()));
      return found ? Math.max(0, Number(found.rate) || 0) : defaultRate;
    };

    const lQty = getQtyForSize('large');
    const mQty = getQtyForSize('medium');
    const sQty = getQtyForSize('small');
    const lPrice = getRateForSize('large', 5);
    const mPrice = getRateForSize('medium', 4);
    const sPrice = getRateForSize('small', 3);

    let totalOutput = 0;
    let effectiveRate = 0;

    if (isSize) {
      totalOutput = sizeTotalQty;
      effectiveRate = sizeTotalQty > 0 ? Math.round((sizeTotalAmount / sizeTotalQty) * 100) / 100 : 0;
    } else if (isCount) {
      totalOutput = countTotalQty;
      effectiveRate = countPricePerItem;
    } else {
      totalOutput = dayDaysWorked;
      effectiveRate = dayDailyRate;
    }

    const payload = {
      empId: recordForm.empId,
      employeeName: recordForm.employeeName,
      workType: recordForm.workType,
      productName: recordForm.productName || 'Towel',
      workDate: recordForm.workDate || defaultToday,
      weekStart,
      weekEnd,

      // Size-Based Salary Dedicated Fields
      largeQuantity: isSize ? lQty : 0,
      largePrice: isSize ? lPrice : 5,
      mediumQuantity: isSize ? mQty : 0,
      mediumPrice: isSize ? mPrice : 4,
      smallQuantity: isSize ? sQty : 0,
      smallPrice: isSize ? sPrice : 3,
      sizeWiseRates: isSize ? recordForm.sizeRates : [],
      sizeWiseProduction: isSize ? recordForm.sizeProduction : [],

      // Count-Based Salary Dedicated Fields
      pricePerItem: isCount ? countPricePerItem : 0,
      countQuantity: isCount ? countTotalQty : 0,

      // Standard Output & Financials
      productsProduced: isDay ? 0 : totalOutput,
      daysWorked: isDay ? totalOutput : (Number(recordForm.daysWorked) || 6),
      hoursWorked: Number(recordForm.workHours) || 8,
      leaveDays: Number(recordForm.leaveDays) || 0,
      rate: effectiveRate,
      grossPay: computedGrossSalary,
      deductions: Number(recordForm.deductions) || 0,
      adjustments: Number(recordForm.adjustments) || 0,
      netPay: computedNetSalary,
      remarks: recordForm.remarks || '',
      status: recordForm.status || 'Pending',
      paymentDate: recordForm.status === 'Paid' ? defaultToday : ''
    };

    if (editingId) {
      await storageService.updateItem('weeklyPayroll', editingId, payload);
      showToast('Weekly salary record updated successfully.');
      setEditingId(null);
    } else {
      await storageService.addItem('weeklyPayroll', payload);
      showToast('Weekly salary record saved successfully.');
    }

    await loadData();
  };

  // Edit existing record
  const handleEdit = (item) => {
    if (isPaidLocked(item)) {
      showToast('This record was marked Paid over 24 hours ago and cannot be edited (View Only).', 'error');
      return;
    }

    setEditingId(item._id || item.id);

    let resolvedType = 'Size Based Salary';
    const typeStr = item.workType || '';
    if (typeStr.includes('Size') || typeStr === 'SIZE_SALARY') {
      resolvedType = 'Size Based Salary';
    } else if (typeStr.includes('Count') || typeStr === 'COUNT_SALARY') {
      resolvedType = 'Count Based Salary';
    } else if (typeStr.includes('Day') || typeStr === 'DAY_SALARY') {
      resolvedType = 'Day Salary';
    }

    // Build sizeProduction array from saved data
    let loadedSizeRates = item.sizeWiseRates && item.sizeWiseRates.length > 0 ? item.sizeWiseRates : DEFAULT_SIZE_RATES;
    let loadedSizeProd = item.sizeWiseProduction && item.sizeWiseProduction.length > 0 ? item.sizeWiseProduction : null;

    if (!loadedSizeProd && (item.largeQuantity || item.mediumQuantity || item.smallQuantity)) {
      loadedSizeProd = [
        { size: 'Large (30 × 60)', rate: item.largePrice || 5, qty: item.largeQuantity || 0, amount: (item.largeQuantity || 0) * (item.largePrice || 5) },
        { size: 'Medium (27 × 54)', rate: item.mediumPrice || 4, qty: item.mediumQuantity || 0, amount: (item.mediumQuantity || 0) * (item.mediumPrice || 4) },
        { size: 'Small (24 × 47)', rate: item.smallPrice || 3, qty: item.smallQuantity || 0, amount: (item.smallQuantity || 0) * (item.smallPrice || 3) }
      ];
    } else if (!loadedSizeProd) {
      loadedSizeProd = DEFAULT_SIZE_PRODUCTION;
    }

    setRecordForm({
      empId: item.empId || '',
      employeeName: item.employeeName || '',
      workType: resolvedType,
      productName: item.productName || 'Towel',
      workDate: item.workDate ? new Date(item.workDate).toISOString().split('T')[0] : defaultToday,
      sizeRates: loadedSizeRates,
      sizeProduction: loadedSizeProd,
      pricePerItem: item.pricePerItem !== undefined ? item.pricePerItem : (item.rate || 5),
      countQuantity: item.countQuantity !== undefined ? item.countQuantity : (item.productsProduced || 200),
      dayRate: item.rate || 600,
      daysWorked: item.daysWorked || 6,
      workHours: item.hoursWorked || 8,
      leaveDays: item.leaveDays || 0,
      deductions: item.deductions || 0,
      adjustments: item.adjustments || 0,
      remarks: item.remarks || item.notes || '',
      status: item.status || 'Pending'
    });

    if (editorRef.current) {
      editorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleDelete = async () => {
    if (deletingId) {
      const searchId = String(deletingId);
      const itemToDelete = items.find(x => String(x._id) === searchId || String(x.id) === searchId);
      if (itemToDelete && isPaidLocked(itemToDelete)) {
        showToast('This record was marked Paid over 24 hours ago and cannot be deleted.', 'error');
        setDeletingId(null);
        return;
      }

      await storageService.deleteItem('weeklyPayroll', deletingId);
      showToast('Payroll record deleted.', 'success');
      setDeletingId(null);
      await loadData();
    }
  };

  const handleStatusChange = async (row, newStatus) => {
    if (isPaidLocked(row)) {
      showToast('This record was marked Paid over 24 hours ago and cannot be changed back to Pending.', 'error');
      return;
    }

    try {
      const targetId = row._id || row.id;
      const updated = {
        ...row,
        status: newStatus,
        paymentDate: newStatus === 'Paid' ? defaultToday : ''
      };
      await storageService.updateItem('weeklyPayroll', targetId, updated);
      showToast(`Payment status changed to ${newStatus}.`, 'success');
      await loadData();
    } catch {
      showToast('Failed to update status.', 'error');
    }
  };

  // Table Columns
  const columns = [
    {
      key: 'sno',
      header: 'S. No',
      width: '65px',
      sortable: true,
      render: (val, row, idx, seq) => (
        <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{seq}</span>
      )
    },
    {
      key: 'workDate',
      header: 'Date',
      sortable: true,
      render: (val, row) => formatDate(row.workDate || row.weekStart)
    },
    {
      key: 'employeeName',
      header: 'Employee',
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{val}</div>
          <code style={{ fontSize: '0.72rem', color: '#64748b' }}>{row.empId}</code>
        </div>
      )
    },
    {
      key: 'workType',
      header: 'Work Type',
      render: (val) => {
        const isSize = val?.includes('Size');
        const isCount = val?.includes('Count');
        const bg = isSize ? '#e0f2fe' : isCount ? '#ecfdf5' : '#f3e8ff';
        const color = isSize ? '#0369a1' : isCount ? '#047857' : '#7e22ce';
        return (
          <span
            style={{
              padding: '0.2rem 0.55rem',
              borderRadius: '4px',
              fontSize: '0.72rem',
              fontWeight: 600,
              backgroundColor: bg,
              color: color,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {isSize && <Layers size={11} />}
            {isCount && <Package size={11} />}
            {!isSize && !isCount && <Calendar size={11} />}
            {val}
          </span>
        );
      }
    },
    {
      key: 'productName',
      header: 'Product / Work',
      render: (val) => val || 'Towel'
    },
    {
      key: 'production',
      header: 'Output Details',
      render: (val, row) => {
        if (row.workType?.includes('Size')) {
          const l = row.largeQuantity || 0;
          const m = row.mediumQuantity || 0;
          const s = row.smallQuantity || 0;
          if (l > 0 || m > 0 || s > 0) {
            return (
              <span style={{ fontSize: '0.75rem' }}>
                <strong>{row.productsProduced || (l + m + s)} pcs</strong> (L:{l}, M:{m}, S:{s})
              </span>
            );
          }
          const sizes = row.sizeWiseProduction?.length || 0;
          return <span><strong>{row.productsProduced || 0} pcs</strong> ({sizes} sizes)</span>;
        }
        if (row.workType?.includes('Count')) {
          const qty = row.countQuantity !== undefined ? row.countQuantity : row.productsProduced;
          return <span><strong>{qty || 0} pcs</strong></span>;
        }
        return <span><strong>{row.daysWorked || 0} days</strong> ({row.hoursWorked || 48} hrs)</span>;
      }
    },
    {
      key: 'rate',
      header: 'Rate / Price',
      render: (val, row) => {
        if (row.workType?.includes('Size')) {
          return <span style={{ color: '#0284c7', fontWeight: 600 }}>L:₹5 | M:₹4 | S:₹3</span>;
        }
        if (row.workType?.includes('Count')) {
          const price = row.pricePerItem !== undefined ? row.pricePerItem : row.rate;
          return <span>₹ {price}/pc</span>;
        }
        return <span>₹ {val}/day</span>;
      }
    },
    {
      key: 'grossPay',
      header: 'Gross Pay',
      render: (val) => formatINR(val)
    },
    {
      key: 'netPay',
      header: 'Calculated Salary',
      sortable: true,
      render: (val) => (
        <strong style={{ color: '#15803d', fontSize: '0.9rem' }}>
          {formatINR(val)}
        </strong>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (val, row) => {
        const locked = isPaidLocked(row);
        return <StatusBadge status={val} isLocked={locked} />;
      }
    }
  ];

  const handleExportCSV = () => {
    storageService.exportToCSV(`Weekly_Salary_${weekStart}_to_${weekEnd}`, sortedItems, columns);
    showToast('Weekly salary spreadsheet exported.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Page Title Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Weekly Salary Management</h2>
          <p className="page-subtitle">Calculate employee weekly salaries with Count-Based and Size-Based production methods</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
            <Download size={14} /> Export Excel
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <Printer size={14} /> Print Payslips
          </button>
        </div>
      </div>

      {/* --- SALARY CALCULATION BUILDER CARD (Matching Provided User Screenshot) --- */}
      <div ref={editorRef} className="salary-builder-card">
        {/* Top Control Bar */}
        <div className="salary-top-bar">
          {/* 1. Employee Selection */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 600 }}>
              Employee <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              className="form-control"
              value={recordForm.empId}
              onChange={(e) => handleSelectEmployee(e.target.value)}
              style={{ fontWeight: 600, height: '38px' }}
            >
              <option value="">-- Select Employee --</option>
              {employees.map((emp) => (
                <option key={emp.empId} value={emp.empId}>
                  {emp.empId} - {emp.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Salary Calculation Method Selector */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 600 }}>
              Work Type <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div className="salary-type-pills">
              <button
                type="button"
                className={`salary-type-pill ${recordForm.workType === 'Day Salary' ? 'active' : ''}`}
                onClick={() => setRecordForm(prev => ({ ...prev, workType: 'Day Salary' }))}
              >
                Day Salary
              </button>
              <button
                type="button"
                className={`salary-type-pill ${recordForm.workType === 'Count Based Salary' ? 'active' : ''}`}
                onClick={() => setRecordForm(prev => ({ ...prev, workType: 'Count Based Salary' }))}
              >
                Count Based Salary
              </button>
              <button
                type="button"
                className={`salary-type-pill ${recordForm.workType === 'Size Based Salary' ? 'active' : ''}`}
                onClick={() => setRecordForm(prev => ({ ...prev, workType: 'Size Based Salary' }))}
              >
                Size Based Salary
              </button>
            </div>
          </div>

          {/* 3. Product / Work */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 600 }}>
              Product / Work <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              className="form-control"
              value={recordForm.productName}
              onChange={(e) => setRecordForm(prev => ({ ...prev, productName: e.target.value }))}
              style={{ height: '38px' }}
            >
              <option value="Towel">Towel</option>
              <option value="Bath Towel">Bath Towel</option>
              <option value="Hand Towel">Hand Towel</option>
              <option value="Face Napkin">Face Napkin</option>
              <option value="Bed Sheet">Bed Sheet</option>
              <option value="Kitchen Linen">Kitchen Linen</option>
            </select>
          </div>

          {/* 4. Work Date */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 600 }}>
              Work Date <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="date"
              className="form-control"
              value={recordForm.workDate}
              onChange={(e) => setRecordForm(prev => ({ ...prev, workDate: e.target.value }))}
              style={{ height: '38px' }}
            />
          </div>
        </div>

        {/* --- MAIN CALCULATION INTERFACE --- */}

        {/* OPTION 1: SIZE-BASED SALARY */}
        {recordForm.workType === 'Size Based Salary' && (
          <div className="salary-panels-grid">
            {/* Panel 1: Size-Wise Rates (Large 30x60 @ ₹5, Medium 27x54 @ ₹4, Small 24x47 @ ₹3) */}
            <div className="salary-subpanel">
              <div className="salary-subpanel-header">
                <div className="salary-subpanel-icon" style={{ backgroundColor: '#e0f2fe' }}>
                  <Layers size={20} color="#0284c7" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                    Size Based Salary
                  </h4>
                  <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                    Salary will be calculated based on size wise rate.
                  </p>
                </div>
              </div>

              {/* Table of Sizes & Fixed Rates */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '0.45rem 0.5rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>
                        Size
                      </th>
                      <th style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                        Rate per Item (₹)
                      </th>
                      <th style={{ width: '32px', padding: '0.45rem 0.25rem' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recordForm.sizeRates.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.35rem 0.4rem' }}>
                          <input
                            type="text"
                            className="table-compact-input"
                            style={{ textAlign: 'left', fontWeight: 600 }}
                            value={row.size}
                            onChange={(e) => handleSizeRateChange(idx, 'size', e.target.value)}
                            placeholder="Size"
                          />
                        </td>
                        <td style={{ padding: '0.35rem 0.4rem' }}>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            className="table-compact-input"
                            value={row.rate}
                            onChange={(e) => handleSizeRateChange(idx, 'rate', e.target.value)}
                            placeholder="Rate"
                          />
                        </td>
                        <td style={{ padding: '0.35rem 0.25rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteSizeRate(idx)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'inline-flex'
                            }}
                            title="Delete this size"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Custom Size Rate Button */}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddSizeRate}
                style={{
                  borderStyle: 'dashed',
                  borderColor: '#0284c7',
                  color: '#0284c7',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  justifyContent: 'center',
                  padding: '0.4rem 0.75rem',
                  marginTop: 'auto'
                }}
              >
                <Plus size={14} /> Add Size Rate
              </button>
            </div>

            {/* Panel 2: Production Details (Size Wise) */}
            <div className="salary-subpanel">
              <div className="salary-subpanel-header">
                <div className="salary-subpanel-icon" style={{ backgroundColor: '#dcfce7' }}>
                  <PackageCheck size={20} color="#15803d" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                    Enter Production Details (Size Wise)
                  </h4>
                  <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                    Enter the number of items produced for each size.
                  </p>
                </div>
              </div>

              {/* Formula description banner */}
              <div style={{
                fontSize: '0.72rem',
                backgroundColor: '#f8fafc',
                padding: '0.4rem 0.6rem',
                borderRadius: '4px',
                border: '1px solid #e2e8f0',
                color: '#475569'
              }}>
                <strong>Formula:</strong> (Large Qty × ₹5) + (Medium Qty × ₹4) + (Small Qty × ₹3)
              </div>

              {/* Production Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '0.45rem 0.5rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>
                        Size
                      </th>
                      <th style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                        Rate (₹)
                      </th>
                      <th style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                        Quantity
                      </th>
                      <th style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                        Amount (₹)
                      </th>
                      <th style={{ width: '28px', padding: '0.45rem 0.2rem' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recordForm.sizeProduction.map((row, idx) => {
                      const lineQty = Math.max(0, Number(row.qty) || 0);
                      const lineRate = Math.max(0, Number(row.rate) || 0);
                      const lineAmount = lineQty * lineRate;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.35rem 0.4rem', fontWeight: 600 }}>
                            {row.size}
                          </td>
                          <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', color: '#64748b' }}>
                            {lineRate.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.35rem 0.4rem' }}>
                            <input
                              type="number"
                              min="0"
                              className="table-compact-input"
                              value={row.qty}
                              onChange={(e) => handleProductionQtyChange(idx, e.target.value)}
                              placeholder="0"
                            />
                          </td>
                          <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                            {lineAmount.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.35rem 0.2rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleDeleteSizeRate(idx)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'inline-flex'
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #e2e8f0', fontWeight: 700 }}>
                      <td style={{ padding: '0.5rem 0.5rem', color: '#0f172a' }}>Total</td>
                      <td></td>
                      <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', color: '#0f172a' }}>
                        {sizeTotalQty}
                      </td>
                      <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', color: '#15803d', fontSize: '0.875rem' }}>
                        {sizeTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Panel 3: Other Details & Calculated Total */}
            <div className="salary-subpanel">
              <div className="salary-subpanel-header">
                <div className="salary-subpanel-icon" style={{ backgroundColor: '#f3e8ff' }}>
                  <FileText size={20} color="#7e22ce" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                    Other Details
                  </h4>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.65rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Work Hours (Optional)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      value={recordForm.workHours}
                      onChange={(e) => setRecordForm(prev => ({ ...prev, workHours: Math.max(0, Number(e.target.value) || 0) }))}
                      style={{ height: '34px', fontSize: '0.8rem' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>hrs</span>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Leave Days</label>
                  <input
                    type="number"
                    min="0"
                    max="7"
                    className="form-control"
                    value={recordForm.leaveDays}
                    onChange={(e) => setRecordForm(prev => ({ ...prev, leaveDays: Math.max(0, Number(e.target.value) || 0) }))}
                    style={{ height: '34px', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Remarks</label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Enter remarks..."
                  value={recordForm.remarks}
                  onChange={(e) => setRecordForm(prev => ({ ...prev, remarks: e.target.value }))}
                  style={{ fontSize: '0.78rem', resize: 'none' }}
                />
              </div>

              {/* Calculated Salary Box */}
              <div className="salary-calc-box">
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Calculator size={20} color="#15803d" />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600 }}>
                    Calculated Salary
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#15803d' }}>
                    {formatINR(computedGrossSalary)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleResetForm}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <RotateCcw size={14} /> Reset
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveRecord}
                  style={{ flex: 1.5, justifyContent: 'center', backgroundColor: '#0284c7' }}
                >
                  <Save size={15} /> {editingId ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OPTION 2: COUNT-BASED SALARY */}
        {recordForm.workType === 'Count Based Salary' && (
          <div className="salary-panels-grid" style={{ gridTemplateColumns: '1.4fr 1.6fr 1.3fr' }}>
            {/* Panel 1: Count-Based Inputs (Price Per Item & Quantity Produced) */}
            <div className="salary-subpanel">
              <div className="salary-subpanel-header">
                <div className="salary-subpanel-icon" style={{ backgroundColor: '#ecfdf5' }}>
                  <Package size={20} color="#059669" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                    Count Based Salary
                  </h4>
                  <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                    Employee receives a fixed amount for each item or product produced.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    Price Per Item (₹) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    className="form-control"
                    placeholder="e.g. 5.00"
                    value={recordForm.pricePerItem}
                    onChange={(e) => setRecordForm(prev => ({
                      ...prev,
                      pricePerItem: Math.max(0, Number(e.target.value) || 0)
                    }))}
                    style={{ fontWeight: 600, fontSize: '0.9rem' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                    Fixed price paid for each towel / item produced
                  </span>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    Quantity Produced <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    placeholder="e.g. 200 items"
                    value={recordForm.countQuantity}
                    onChange={(e) => setRecordForm(prev => ({
                      ...prev,
                      countQuantity: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0)
                    }))}
                    style={{ fontWeight: 600, fontSize: '0.9rem' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                    Total number of items produced by the worker
                  </span>
                </div>
              </div>
            </div>

            {/* Panel 2: Live Calculation Preview & Formula */}
            <div className="salary-subpanel">
              <div className="salary-subpanel-header">
                <div className="salary-subpanel-icon" style={{ backgroundColor: '#eff6ff' }}>
                  <FileSpreadsheet size={20} color="#2563eb" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                    Salary Calculation Preview
                  </h4>
                  <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                    Formula: Quantity Produced × Price Per Item
                  </p>
                </div>
              </div>

              <div style={{
                padding: '1rem',
                backgroundColor: '#f8fafc',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                fontSize: '0.825rem',
                marginTop: '0.5rem',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Product:</span>
                  <strong>{recordForm.productName || 'Towel'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Price Per Item:</span>
                  <strong style={{ color: '#0284c7' }}>₹ {countPricePerItem.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Quantity Produced:</span>
                  <strong>{countTotalQty.toLocaleString('en-IN')} pieces</strong>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '0.65rem',
                  borderTop: '1px dashed #cbd5e1',
                  color: '#15803d',
                  fontWeight: 700,
                  fontSize: '0.9rem'
                }}>
                  <span>Total Calculated Salary:</span>
                  <span>{formatINR(countTotalAmount)}</span>
                </div>
              </div>

              <div style={{
                fontSize: '0.72rem',
                color: '#64748b',
                marginTop: 'auto',
                padding: '0.5rem',
                backgroundColor: '#f0fdf4',
                borderRadius: '4px',
                border: '1px solid #bbf7d0'
              }}>
                Calculation auto-updates whenever Quantity or Price changes.
              </div>
            </div>

            {/* Panel 3: Other Details & Save */}
            <div className="salary-subpanel">
              <div className="salary-subpanel-header">
                <div className="salary-subpanel-icon" style={{ backgroundColor: '#f3e8ff' }}>
                  <FileText size={20} color="#7e22ce" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                    Other Details
                  </h4>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.65rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Work Hours (Optional)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      value={recordForm.workHours}
                      onChange={(e) => setRecordForm(prev => ({ ...prev, workHours: Math.max(0, Number(e.target.value) || 0) }))}
                      style={{ height: '34px', fontSize: '0.8rem' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>hrs</span>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Leave Days</label>
                  <input
                    type="number"
                    min="0"
                    max="7"
                    className="form-control"
                    value={recordForm.leaveDays}
                    onChange={(e) => setRecordForm(prev => ({ ...prev, leaveDays: Math.max(0, Number(e.target.value) || 0) }))}
                    style={{ height: '34px', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Remarks</label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Enter remarks..."
                  value={recordForm.remarks}
                  onChange={(e) => setRecordForm(prev => ({ ...prev, remarks: e.target.value }))}
                  style={{ fontSize: '0.78rem', resize: 'none' }}
                />
              </div>

              {/* Calculated Salary Box */}
              <div className="salary-calc-box">
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Calculator size={20} color="#15803d" />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600 }}>
                    Calculated Salary
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#15803d' }}>
                    {formatINR(computedGrossSalary)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleResetForm}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <RotateCcw size={14} /> Reset
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveRecord}
                  style={{ flex: 1.5, justifyContent: 'center', backgroundColor: '#0284c7' }}
                >
                  <Save size={15} /> {editingId ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OPTION 3: DAY SALARY */}
        {recordForm.workType === 'Day Salary' && (
          <div className="salary-panels-grid" style={{ gridTemplateColumns: '1.4fr 1.6fr 1.3fr' }}>
            <div className="salary-subpanel">
              <div className="salary-subpanel-header">
                <div className="salary-subpanel-icon" style={{ backgroundColor: '#f3e8ff' }}>
                  <Calendar size={20} color="#7e22ce" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                    Day Salary Details
                  </h4>
                  <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                    Salary calculated based on daily wage and days worked.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Daily Wage Rate (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={recordForm.dayRate}
                    onChange={(e) => setRecordForm(prev => ({ ...prev, dayRate: Math.max(0, Number(e.target.value) || 0) }))}
                    style={{ fontWeight: 600 }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Days Worked</label>
                  <input
                    type="number"
                    min="0"
                    max="7"
                    className="form-control"
                    value={recordForm.daysWorked}
                    onChange={(e) => setRecordForm(prev => ({ ...prev, daysWorked: Math.max(0, Number(e.target.value) || 0) }))}
                    style={{ fontWeight: 600 }}
                  />
                </div>
              </div>
            </div>

            <div className="salary-subpanel">
              <div className="salary-subpanel-header">
                <div className="salary-subpanel-icon" style={{ backgroundColor: '#eff6ff' }}>
                  <FileSpreadsheet size={20} color="#2563eb" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                    Attendance & Wage Summary
                  </h4>
                  <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                    Formula: Days Worked × Daily Wage Rate
                  </p>
                </div>
              </div>

              <div style={{
                padding: '1rem',
                backgroundColor: '#f8fafc',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                fontSize: '0.825rem',
                marginTop: '0.5rem',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Daily Rate:</span>
                  <strong>₹ {dayDailyRate.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Days Worked:</span>
                  <strong>{dayDaysWorked} days</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Standard Hours:</span>
                  <strong>{dayDaysWorked * 8} hrs</strong>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '0.5rem',
                  borderTop: '1px dashed #cbd5e1',
                  color: '#15803d',
                  fontWeight: 700
                }}>
                  <span>Gross Calculated:</span>
                  <span>{formatINR(dayTotalAmount)}</span>
                </div>
              </div>
            </div>

            <div className="salary-subpanel">
              <div className="salary-subpanel-header">
                <div className="salary-subpanel-icon" style={{ backgroundColor: '#f3e8ff' }}>
                  <FileText size={20} color="#7e22ce" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                    Other Details
                  </h4>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.65rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Work Hours (Optional)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      value={recordForm.workHours}
                      onChange={(e) => setRecordForm(prev => ({ ...prev, workHours: Math.max(0, Number(e.target.value) || 0) }))}
                      style={{ height: '34px', fontSize: '0.8rem' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>hrs</span>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Leave Days</label>
                  <input
                    type="number"
                    min="0"
                    max="7"
                    className="form-control"
                    value={recordForm.leaveDays}
                    onChange={(e) => setRecordForm(prev => ({ ...prev, leaveDays: Math.max(0, Number(e.target.value) || 0) }))}
                    style={{ height: '34px', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Remarks</label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Enter remarks..."
                  value={recordForm.remarks}
                  onChange={(e) => setRecordForm(prev => ({ ...prev, remarks: e.target.value }))}
                  style={{ fontSize: '0.78rem', resize: 'none' }}
                />
              </div>

              <div className="salary-calc-box">
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Calculator size={20} color="#15803d" />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600 }}>
                    Calculated Salary
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#15803d' }}>
                    {formatINR(computedGrossSalary)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleResetForm}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <RotateCcw size={14} /> Reset
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveRecord}
                  style={{ flex: 1.5, justifyContent: 'center', backgroundColor: '#0284c7' }}
                >
                  <Save size={15} /> {editingId ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- WEEKLY PAYROLL HISTORY GRID --- */}
      <div className="erp-card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="card-title-group">
            <Calendar size={18} color="var(--primary-600)" />
            <h3 className="card-title">Employee Weekly Work & Payroll Grid</h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <div className="search-box" style={{ width: '190px', height: '34px' }}>
              <Search size={14} />
              <input
                type="text"
                placeholder="Search payroll..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="form-control"
              style={{ width: '180px', height: '34px', fontSize: '0.78rem' }}
              value={workTypeFilter}
              onChange={(e) => setWorkTypeFilter(e.target.value)}
            >
              <option value="All">All Salary Types</option>
              <option value="Size Based Salary">Size Based Salary</option>
              <option value="Count Based Salary">Count Based Salary</option>
              <option value="Day Salary">Day Salary</option>
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={sortedItems}
          onView={(row) => setViewingItem(row)}
          onEdit={(row) => handleEdit(row)}
          onDelete={(row) => setDeletingId(row._id || row.id)}
          onStatusChange={handleStatusChange}
          page={1}
          totalPages={1}
          totalItems={sortedItems.length}
        />
      </div>

      {/* Summary KPI Strip */}
      <div
        className="erp-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: '#ffffff'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Total Records</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {summary.totalEmployees}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Total Gross Earnings</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#059669' }}>
              {formatINR(summary.totalGross)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Total Deductions</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>
              {formatINR(summary.totalDeductions)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Net Payroll Payable</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-600)' }}>
              {formatINR(summary.totalNet)}
            </div>
          </div>
        </div>
      </div>

      {/* View Details Modal with Complete Size-Wise & Count Breakdown */}
      <Modal isOpen={!!viewingItem} onClose={() => setViewingItem(null)} title="Weekly Work Record Details">
        {viewingItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div><strong style={{ color: 'var(--text-muted)' }}>Employee:</strong> {viewingItem.employeeName} ({viewingItem.empId})</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Work Type:</strong> {viewingItem.workType}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Work Date:</strong> {formatDate(viewingItem.workDate || viewingItem.weekStart)}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Product:</strong> {viewingItem.productName || 'Towel'}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Work Hours:</strong> {viewingItem.hoursWorked || 8} hrs</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Leave Days:</strong> {viewingItem.leaveDays || 0}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Gross Pay:</strong> {formatINR(viewingItem.grossPay)}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Calculated Salary:</strong> <strong style={{ color: '#15803d' }}>{formatINR(viewingItem.netPay || viewingItem.grossPay)}</strong></div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Payment Status:</strong> <StatusBadge status={viewingItem.status} /></div>
            </div>

            {/* Size Breakdown Table if Size-Based Salary */}
            {viewingItem.workType?.includes('Size') && (
              <div style={{ marginTop: '0.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                  Size-Wise Production Breakdown (Formula: L×₹5 + M×₹4 + S×₹3)
                </h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', border: '1px solid var(--border-color)' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '0.4rem', textAlign: 'left' }}>Size</th>
                      <th style={{ padding: '0.4rem', textAlign: 'right' }}>Fixed Rate (₹)</th>
                      <th style={{ padding: '0.4rem', textAlign: 'right' }}>Quantity</th>
                      <th style={{ padding: '0.4rem', textAlign: 'right' }}>Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Render saved sizeWiseProduction or reconstructed L, M, S */}
                    {viewingItem.sizeWiseProduction && viewingItem.sizeWiseProduction.length > 0 ? (
                      viewingItem.sizeWiseProduction.map((p, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.35rem', fontWeight: 600 }}>{p.size}</td>
                          <td style={{ padding: '0.35rem', textAlign: 'right' }}>₹ {Number(p.rate || 0).toFixed(2)}</td>
                          <td style={{ padding: '0.35rem', textAlign: 'right', fontWeight: 600 }}>{p.qty}</td>
                          <td style={{ padding: '0.35rem', textAlign: 'right', color: '#15803d', fontWeight: 600 }}>
                            ₹ {Number(p.amount || ((Number(p.qty) || 0) * (Number(p.rate) || 0))).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <>
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.35rem', fontWeight: 600 }}>Large (30 × 60)</td>
                          <td style={{ padding: '0.35rem', textAlign: 'right' }}>₹ 5.00</td>
                          <td style={{ padding: '0.35rem', textAlign: 'right', fontWeight: 600 }}>{viewingItem.largeQuantity || 0}</td>
                          <td style={{ padding: '0.35rem', textAlign: 'right', color: '#15803d', fontWeight: 600 }}>
                            ₹ {((Number(viewingItem.largeQuantity) || 0) * 5).toFixed(2)}
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.35rem', fontWeight: 600 }}>Medium (27 × 54)</td>
                          <td style={{ padding: '0.35rem', textAlign: 'right' }}>₹ 4.00</td>
                          <td style={{ padding: '0.35rem', textAlign: 'right', fontWeight: 600 }}>{viewingItem.mediumQuantity || 0}</td>
                          <td style={{ padding: '0.35rem', textAlign: 'right', color: '#15803d', fontWeight: 600 }}>
                            ₹ {((Number(viewingItem.mediumQuantity) || 0) * 4).toFixed(2)}
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.35rem', fontWeight: 600 }}>Small (24 × 47)</td>
                          <td style={{ padding: '0.35rem', textAlign: 'right' }}>₹ 3.00</td>
                          <td style={{ padding: '0.35rem', textAlign: 'right', fontWeight: 600 }}>{viewingItem.smallQuantity || 0}</td>
                          <td style={{ padding: '0.35rem', textAlign: 'right', color: '#15803d', fontWeight: 600 }}>
                            ₹ {((Number(viewingItem.smallQuantity) || 0) * 3).toFixed(2)}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#f0fdf4', fontWeight: 700, borderTop: '2px solid #bbf7d0' }}>
                      <td style={{ padding: '0.4rem' }}>Total</td>
                      <td></td>
                      <td style={{ padding: '0.4rem', textAlign: 'right' }}>{viewingItem.productsProduced}</td>
                      <td style={{ padding: '0.4rem', textAlign: 'right', color: '#15803d' }}>{formatINR(viewingItem.grossPay)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Count Breakdown if Count-Based Salary */}
            {viewingItem.workType?.includes('Count') && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                backgroundColor: '#f8fafc',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #e2e8f0'
              }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                  Count-Based Production Details
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Price Per Item:</span>{' '}
                    <strong>₹ {Number(viewingItem.pricePerItem !== undefined ? viewingItem.pricePerItem : viewingItem.rate || 0).toFixed(2)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Quantity Produced:</span>{' '}
                    <strong>{viewingItem.countQuantity !== undefined ? viewingItem.countQuantity : viewingItem.productsProduced} pcs</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Total Calculated:</span>{' '}
                    <strong style={{ color: '#15803d' }}>{formatINR(viewingItem.grossPay)}</strong>
                  </div>
                </div>
              </div>
            )}

            {viewingItem.remarks && (
              <div style={{ marginTop: '0.5rem', padding: '0.65rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)' }}>
                <strong style={{ color: 'var(--text-muted)' }}>Remarks:</strong> {viewingItem.remarks}
              </div>
            )}

            {isPaidLocked(viewingItem) && (
              <div style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.75rem',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Lock size={14} color="#64748b" />
                <span><strong>Audit Protected:</strong> This record was marked Paid over 24 hours ago and is permanently locked (View Only).</span>
              </div>
            )}

            <div style={{
              marginTop: '0.5rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.75rem',
              color: 'var(--text-muted)'
            }}>
              <div><strong>Created:</strong> {formatDateTime(viewingItem.createdAt || viewingItem.workDate)}</div>
              <div><strong>Updated:</strong> {formatDateTime(viewingItem.updatedAt || viewingItem.createdAt || viewingItem.workDate)}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={() => setViewingItem(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete Weekly Payroll Record"
        message="Are you sure you want to delete this weekly attendance and pay record?"
      />
    </div>
  );
}
