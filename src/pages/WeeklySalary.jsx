import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Users,
  Plus,
  Download,
  Printer,
  FileSpreadsheet,
  Search,
  Eye,
  Edit2,
  Trash2,
  Layers,
  Package,
  Calculator,
  RotateCcw,
  Sparkles,
  Save,
  FileText,
  Filter,
  CalendarDays
} from 'lucide-react';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Toast from '../components/common/Toast';
import DateRangePicker from '../components/common/DateRangePicker';
import { storageService } from '../services/storageService';
import { formatINR, formatDate, formatDateTime } from '../utils/formatters';

const defaultToday = new Date().toISOString().split('T')[0];

// Standard Towel Sizes & Fixed Rates:
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
  workType: '', // Assigned automatically once employee is selected
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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateFilter, setDateFilter] = useState('All Time'); // 'All Time' | 'Today' | 'This Week' | 'This Month' | 'This Year' | 'Custom Day' | 'Custom Range'
  const [customSingleDate, setCustomSingleDate] = useState(new Date().toISOString().split('T')[0]);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('sno');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal box state for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recordForm, setRecordForm] = useState(INITIAL_RECORD);
  const [editingId, setEditingId] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);

  const loadData = async () => {
    try {
      const payroll = await storageService.fetchLiveCollection('weeklyPayroll');
      const emps = await storageService.fetchLiveCollection('employees');
      setItems(payroll || []);
      setEmployees(emps || []);
      // Do not default employee show: recordForm stays with empId: '' until user picks
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

  // Filtered Items for Grid
  const filteredItems = useMemo(() => {
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();

    // Start of week (Monday 00:00:00) to end of week (Sunday 23:59:59)
    const dayOfWeek = (now.getDay() + 6) % 7;
    const startOfWeek = new Date(todayYear, todayMonth, todayDate - dayOfWeek, 0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return items.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (item.employeeName || '').toLowerCase().includes(q) ||
        (item.empId || '').toLowerCase().includes(q) ||
        (item.productName || '').toLowerCase().includes(q) ||
        (item.workType || '').toLowerCase().includes(q);

      const matchesType =
        workTypeFilter === 'All' ||
        (item.workType || '').toLowerCase() === workTypeFilter.toLowerCase();

      if (!matchesSearch || !matchesType) return false;

      // Date Filtering
      const recDateStr = (item.workDate ? item.workDate.split('T')[0] : '') ||
                         (item.weekEnd ? item.weekEnd.split('T')[0] : '') ||
                         (item.weekStart ? item.weekStart.split('T')[0] : '') ||
                         (item.date ? item.date.split('T')[0] : '') ||
                         (item.createdAt ? item.createdAt.split('T')[0] : '') || '';

      if (startDate && recDateStr && recDateStr < startDate) return false;
      if (endDate && recDateStr && recDateStr > endDate) return false;

      return true;
    });
  }, [items, searchQuery, workTypeFilter, startDate, endDate]);

  // Summary Metrics for Bottom Bar (dynamically matches active filters)
  const summary = useMemo(() => {
    const totalEmployees = filteredItems.length;
    const totalGross = filteredItems.reduce((acc, curr) => acc + (Number(curr.grossPay) || 0), 0);
    const totalDeductions = filteredItems.reduce((acc, curr) => acc + (Number(curr.deductions) || 0), 0);
    const totalNet = filteredItems.reduce((acc, curr) => acc + (Number(curr.netPay) || 0), 0);
    return { totalEmployees, totalGross, totalDeductions, totalNet };
  }, [filteredItems]);

  const sortedItems = useMemo(() => {
    const indexed = filteredItems.map((item, index) => ({
      ...item,
      sno: index + 1
    }));

    if (sortField === 'sno') {
      if (sortOrder === 'desc') indexed.reverse();
      return indexed;
    }

    indexed.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (sortField === 'netPay' || sortField === 'grossPay') {
        aVal = Number(aVal || 0);
        bVal = Number(bVal || 0);
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return indexed;
  }, [filteredItems, sortField, sortOrder]);

  const totalPages = Math.ceil(sortedItems.length / itemsPerPage) || 1;
  const paginatedItems = useMemo(() => {
    return sortedItems.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  }, [sortedItems, page, itemsPerPage]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // --- Handlers for Rates & Production ---

  const handleRateChange = (index, newRate) => {
    const validRate = Math.max(0, Number(newRate) || 0);
    setRecordForm(prev => {
      const updatedRates = [...prev.sizeRates];
      const updatedProd = [...prev.sizeProduction];
      if (updatedRates[index]) {
        updatedRates[index] = { ...updatedRates[index], rate: validRate };
      }
      if (updatedProd[index]) {
        const qty = Math.max(0, Number(updatedProd[index].qty) || 0);
        updatedProd[index] = {
          ...updatedProd[index],
          rate: validRate,
          amount: qty * validRate
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
      const newSizeName = `Custom ${prev.sizeRates.length + 1}`;
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

  // Current selected employee object
  const selectedEmployee = useMemo(() => {
    if (!recordForm.empId) return null;
    return employees.find(e => e.empId === recordForm.empId) || null;
  }, [recordForm.empId, employees]);

  // Allowed salary calculation methods based on employee's configured salary types
  const allowedSalaryTypes = useMemo(() => {
    if (!selectedEmployee) {
      return [];
    }

    const assigned = [];
    const empTypes = Array.isArray(selectedEmployee.workTypes) && selectedEmployee.workTypes.length > 0
      ? selectedEmployee.workTypes
      : [selectedEmployee.workType || selectedEmployee.type || 'Day Salary'];

    const combinedStr = `${selectedEmployee.workType || ''} ${selectedEmployee.type || ''} ${empTypes.join(' ')}`.toLowerCase();

    if (combinedStr.includes('day')) {
      assigned.push('Day Salary');
    }
    if (combinedStr.includes('count')) {
      assigned.push('Count Based Salary');
    }
    if (combinedStr.includes('size')) {
      assigned.push('Size Based Salary');
    }

    return assigned.length > 0 ? assigned : ['Day Salary', 'Count Based Salary', 'Size Based Salary'];
  }, [selectedEmployee]);

  // Select Employee: Once selected, detect employee work type(s) (Count, Size, Day)
  // and switch calculation method automatically to only what is assigned
  const handleSelectEmployee = (empId) => {
    if (!empId) {
      setRecordForm(prev => ({
        ...prev,
        empId: '',
        employeeName: '',
        workType: ''
      }));
      return;
    }

    const emp = employees.find(e => e.empId === empId);
    if (emp) {
      const empTypes = Array.isArray(emp.workTypes) && emp.workTypes.length > 0
        ? emp.workTypes
        : [emp.workType || emp.type || 'Day Salary'];

      const combinedStr = `${emp.workType || ''} ${emp.type || ''} ${empTypes.join(' ')}`.toLowerCase();

      const available = [];
      if (combinedStr.includes('day')) available.push('Day Salary');
      if (combinedStr.includes('count')) available.push('Count Based Salary');
      if (combinedStr.includes('size')) available.push('Size Based Salary');

      const targetTypes = available.length > 0 ? available : ['Day Salary'];

      // If current workType is in the employee's allowed types, keep it; otherwise switch to first allowed type
      const newWorkType = targetTypes.includes(recordForm.workType)
        ? recordForm.workType
        : targetTypes[0];

      // Restore custom size rates if configured for this employee
      let nextSizeRates = recordForm.sizeRates;
      let nextSizeProd = recordForm.sizeProduction;
      if (Array.isArray(emp.sizeRates) && emp.sizeRates.length > 0) {
        nextSizeRates = emp.sizeRates;
        nextSizeProd = emp.sizeRates.map(sr => {
          const existing = (recordForm.sizeProduction || []).find(p => p.size === sr.size);
          const qty = existing ? Number(existing.qty) || 0 : 0;
          return {
            size: sr.size,
            rate: sr.rate,
            qty: qty,
            amount: qty * sr.rate
          };
        });
      }

      setRecordForm(prev => ({
        ...prev,
        empId: emp.empId,
        employeeName: emp.name,
        workType: newWorkType,
        productName: emp.productType || prev.productName || 'Towel',
        dayRate: emp.dailyRate !== undefined && Number(emp.dailyRate) > 0 ? Number(emp.dailyRate) : prev.dayRate,
        pricePerItem: emp.pieceRate !== undefined && Number(emp.pieceRate) > 0 ? Number(emp.pieceRate) : prev.pricePerItem,
        sizeRates: nextSizeRates,
        sizeProduction: nextSizeProd
      }));
    }
  };

  // Open Add Modal with clean state and no pre-selected employee
  const handleOpenAddModal = () => {
    setEditingId(null);
    setRecordForm({
      ...INITIAL_RECORD,
      empId: '',
      employeeName: '',
      workType: '',
      sizeRates: [...DEFAULT_SIZE_RATES],
      sizeProduction: [...DEFAULT_SIZE_PRODUCTION]
    });
    setIsModalOpen(true);
  };

  // Reset form inside modal
  const handleResetForm = () => {
    setRecordForm({
      ...INITIAL_RECORD,
      empId: '',
      employeeName: '',
      workType: '',
      sizeRates: [...DEFAULT_SIZE_RATES],
      sizeProduction: [...DEFAULT_SIZE_PRODUCTION]
    });
    showToast('Calculation form has been reset.', 'neutral');
  };

  // Save / Update Record (No Pay / Pending prompt required)
  const handleSaveRecord = async (e) => {
    if (e) e.preventDefault();

    if (!recordForm.employeeName || !recordForm.empId) {
      showToast('Please select an employee.', 'error');
      return;
    }

    const isSize = recordForm.workType === 'Size Based Salary';
    const isCount = recordForm.workType === 'Count Based Salary';
    const isDay = recordForm.workType === 'Day Salary';

    // Extract quantities for Large, Medium, Small
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
      status: 'Pending'
    };

    if (editingId) {
      await storageService.updateItem('weeklyPayroll', editingId, payload);
      showToast('Weekly salary record updated successfully.');
      setEditingId(null);
    } else {
      await storageService.addItem('weeklyPayroll', payload);
      showToast('Weekly salary record saved successfully.');
    }

    setIsModalOpen(false);
    handleResetForm();
    await loadData();
  };

  // Edit existing record -> Opens Modal Box
  const handleEdit = (item) => {
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

    // Restore sizeProduction from saved data
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
      pricePerItem: Number(item.pricePerItem !== undefined ? item.pricePerItem : item.rate || 5),
      countQuantity: item.countQuantity !== undefined ? item.countQuantity : (item.productsProduced || 0),
      dayRate: Number(item.rate || 600),
      daysWorked: Number(item.daysWorked || 6),
      workHours: Number(item.hoursWorked || 8),
      leaveDays: Number(item.leaveDays || 0),
      deductions: Number(item.deductions || 0),
      adjustments: Number(item.adjustments || 0),
      remarks: item.remarks || '',
      status: 'Pending'
    });

    setIsModalOpen(true);
  };

  // Delete record
  const handleDelete = async () => {
    if (deletingId) {
      await storageService.deleteItem('weeklyPayroll', deletingId);
      showToast('Payroll record deleted.', 'success');
      setDeletingId(null);
      await loadData();
    }
  };

  // Table Columns - Pay and Pending (Status) is NOT shown in table lister
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
    }
  ];

  const handleExportCSV = () => {
    storageService.exportToCSV(`Weekly_Salary_${weekStart}_to_${weekEnd}`, sortedItems, columns);
    showToast('Weekly salary spreadsheet exported.');
  };

  const handleExportPDF = () => {
    storageService.exportToPDF(`Weekly_Salary_${weekStart}_to_${weekEnd}`, sortedItems, columns);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Page Header with Add Modal Trigger */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Weekly Salary Management</h2>
          <p className="page-subtitle">Calculate and record employee salaries with Count-Based and Size-Based methods</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-primary btn-sm" onClick={handleOpenAddModal}>
            <Plus size={15} /> Add Weekly Salary
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
            <Download size={14} /> Export Excel
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExportPDF}>
            <Printer size={14} /> Export PDF
          </button>
        </div>
      </div>

      {/* --- WEEKLY PAYROLL HISTORY GRID (Lister) --- */}
      <div className="erp-card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="card-title-group" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Calendar size={18} color="var(--primary-600)" />
            <h3 className="card-title">Employee Weekly Work & Payroll Grid</h3>
            {startDate && (
              <span
                onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
                style={{
                  fontSize: '0.725rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '9999px',
                  backgroundColor: '#ccfbf1',
                  color: '#0f766e',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
                title="Click to clear date filter"
              >
                Date: {startDate}{endDate ? ` to ${endDate}` : ''} ✕
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <div className="search-box" style={{ width: '180px', height: '34px' }}>
              <Search size={14} />
              <input
                type="text"
                placeholder="Search payroll..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <select
              className="form-control"
              style={{ width: '160px', height: '34px', fontSize: '0.78rem' }}
              value={workTypeFilter}
              onChange={(e) => {
                setWorkTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All">All Salary Types</option>
              <option value="Size Based Salary">Size Based Salary</option>
              <option value="Count Based Salary">Count Based Salary</option>
              <option value="Day Salary">Day Salary</option>
            </select>

            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={({ startDate: s, endDate: e }) => {
                setStartDate(s);
                setEndDate(e);
                setPage(1);
              }}
              onReset={() => {
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={paginatedItems}
          onView={(row) => setViewingItem(row)}
          onEdit={(row) => handleEdit(row)}
          onDelete={(row) => setDeletingId(row._id || row.id)}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
          page={page}
          totalPages={totalPages}
          totalItems={sortedItems.length}
          itemsPerPage={itemsPerPage}
          onPageChange={(p) => setPage(p)}
          onItemsPerPageChange={(sz) => {
            setItemsPerPage(sz);
            setPage(1);
          }}
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

      {/* --- ADD / EDIT MODAL BOX (Modules Box) --- */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingId(null);
        }}
        title={editingId ? 'Edit Weekly Salary Record' : 'Add Weekly Salary Calculation'}
        maxWidth="1080px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {/* Top Control Bar */}
          <div
            className="salary-top-bar"
            style={{
              backgroundColor: '#f8fafc',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #e2e8f0',
              gridTemplateColumns: recordForm.empId ? '1.3fr 1.8fr 1.1fr 1fr' : '1.5fr 1.1fr 1fr'
            }}
          >
            {/* 1. Employee Selection - User picks employee */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                Employee <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                className="form-control"
                value={recordForm.empId}
                onChange={(e) => handleSelectEmployee(e.target.value)}
                style={{ fontWeight: 600, height: '38px', backgroundColor: '#ffffff' }}
              >
                <option value="">-- Select Employee --</option>
                {employees.map((emp) => {
                  const empTypes = Array.isArray(emp.workTypes) && emp.workTypes.length > 0
                    ? emp.workTypes.join(', ')
                    : (emp.workType || emp.type || 'Day Salary');
                  return (
                    <option key={emp.empId} value={emp.empId}>
                      {emp.empId} - {emp.name} ({empTypes})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 2. Salary Calculation Method Selector - Once employee selected then only show for the work type */}
            {recordForm.empId && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
                    Work Type / Method <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  {selectedEmployee && (
                    <span style={{ fontSize: '0.68rem', color: '#0369a1', fontWeight: 600, backgroundColor: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                      Assigned for {selectedEmployee.name.split(' ')[0]}
                    </span>
                  )}
                </div>
                <div className="salary-type-pills">
                  {allowedSalaryTypes.includes('Day Salary') && (
                    <button
                      type="button"
                      className={`salary-type-pill ${recordForm.workType === 'Day Salary' ? 'active' : ''}`}
                      onClick={() => setRecordForm(prev => ({ ...prev, workType: 'Day Salary' }))}
                    >
                      Day
                    </button>
                  )}
                  {allowedSalaryTypes.includes('Count Based Salary') && (
                    <button
                      type="button"
                      className={`salary-type-pill ${recordForm.workType === 'Count Based Salary' ? 'active' : ''}`}
                      onClick={() => setRecordForm(prev => ({ ...prev, workType: 'Count Based Salary' }))}
                    >
                      Count
                    </button>
                  )}
                  {allowedSalaryTypes.includes('Size Based Salary') && (
                    <button
                      type="button"
                      className={`salary-type-pill ${recordForm.workType === 'Size Based Salary' ? 'active' : ''}`}
                      onClick={() => setRecordForm(prev => ({ ...prev, workType: 'Size Based Salary' }))}
                    >
                      Size
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 3. Product / Work */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                Product / Work <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                className="form-control"
                value={recordForm.productName}
                onChange={(e) => setRecordForm(prev => ({ ...prev, productName: e.target.value }))}
                style={{ height: '38px', backgroundColor: '#ffffff' }}
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
                style={{ height: '38px', backgroundColor: '#ffffff' }}
              />
            </div>
          </div>

          {/* --- MAIN CALCULATION INTERFACE --- */}

          {!recordForm.empId ? (
            <div
              style={{
                padding: '3rem 1.5rem',
                backgroundColor: '#f8fafc',
                border: '2px dashed #cbd5e1',
                borderRadius: 'var(--radius-lg)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem'
              }}
            >
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: '#e0f2fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0284c7'
                }}
              >
                <Users size={26} />
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                Please Select an Employee First
              </h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, maxWidth: '420px', lineHeight: 1.5 }}>
                Choose an employee from the dropdown above. The assigned work type (Day, Count, or Size-based salary) and calculation details will appear automatically.
              </p>
            </div>
          ) : (
            <>

          {/* OPTION 1: SIZE-BASED SALARY */}
          {recordForm.workType === 'Size Based Salary' && (
            <div className="salary-panels-grid">
              {/* Panel 1: Standard Towel Sizes & Rates */}
              <div className="salary-subpanel">
                <div className="salary-subpanel-header">
                  <div className="salary-subpanel-icon" style={{ backgroundColor: '#e0f2fe' }}>
                    <Layers size={20} color="#0284c7" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                      Size-Wise Rates (₹)
                    </h4>
                    <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                      Large ₹5 | Medium ₹4 | Small ₹3
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {recordForm.sizeRates.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.45rem 0.65rem',
                        backgroundColor: '#f8fafc',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                        {item.size}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          className="table-compact-input"
                          style={{ width: '68px', height: '30px' }}
                          value={item.rate}
                          onChange={(e) => handleRateChange(idx, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddSizeRate}
                  style={{ alignSelf: 'flex-start', marginTop: '0.25rem', fontSize: '0.75rem', gap: '4px' }}
                >
                  <Plus size={12} /> Add Size Rate
                </button>
              </div>

              {/* Panel 2: Enter Production Quantities */}
              <div className="salary-subpanel">
                <div className="salary-subpanel-header">
                  <div className="salary-subpanel-icon" style={{ backgroundColor: '#ecfdf5' }}>
                    <Package size={20} color="#059669" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                      Output Quantities (pcs)
                    </h4>
                    <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                      Formula: (Large × ₹5) + (Medium × ₹4) + (Small × ₹3)
                    </p>
                  </div>
                </div>

                <div style={{ overflowX: 'auto', marginTop: '0.35rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '0.45rem 0.5rem', textAlign: 'left', fontWeight: 600 }}>Towel Size</th>
                        <th style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>Rate</th>
                        <th style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>Quantity</th>
                        <th style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>Total (₹)</th>
                        <th style={{ width: '30px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {recordForm.sizeProduction.map((item, idx) => {
                        const qty = Math.max(0, Number(item.qty) || 0);
                        const rate = Math.max(0, Number(item.rate) || 0);
                        const lineAmount = qty * rate;

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.35rem 0.5rem', fontWeight: 500 }}>
                              {item.size}
                            </td>
                            <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', color: '#64748b' }}>
                              ₹ {rate.toFixed(2)}
                            </td>
                            <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                              <input
                                type="number"
                                min="0"
                                className="table-compact-input"
                                placeholder="0"
                                value={item.qty}
                                onChange={(e) => handleProductionQtyChange(idx, e.target.value)}
                                style={{ width: '80px', height: '30px' }}
                              />
                            </td>
                            <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600, color: '#15803d' }}>
                              {lineAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '0.35rem 0.25rem', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleDeleteSizeRate(idx)}
                                title="Remove size"
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
              {/* Panel 1: Count-Based Inputs */}
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
                      Fixed amount for each item or product produced.
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
                      Calculation Formula Preview
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b' }}>Price Per Item:</span>
                    <strong>₹ {countPricePerItem.toFixed(2)} / pc</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b' }}>Quantity Produced:</span>
                    <strong>{countTotalQty} items</strong>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '0.5rem',
                    borderTop: '1px dashed #cbd5e1',
                    color: '#15803d',
                    fontWeight: 700
                  }}>
                    <span>Formula Total:</span>
                    <span>{countTotalQty} × ₹{countPricePerItem.toFixed(2)} = {formatINR(countTotalAmount)}</span>
                  </div>
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
            </>
          )}
        </div>
      </Modal>

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
