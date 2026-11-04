import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Layers,
  Package,
  Users,
  Plus,
  Download,
  Printer,
  Search,
  RotateCcw,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  Eye,
  Edit2,
  Trash2,
  ChevronDown,
  Check
} from 'lucide-react';
import MetricCard from '../components/common/MetricCard';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Toast from '../components/common/Toast';
import StatusBadge from '../components/common/StatusBadge';
import DateRangePicker from '../components/common/DateRangePicker';
import DynamicTypeSelect from '../components/common/DynamicTypeSelect';
import { storageService, cleanAccidentalDuplicates } from '../services/storageService';
import {
  formatINR,
  formatDate,
  formatDateTime,
  isPaidLocked,
  getPaymentStatus,
  calculateDefaultDueDate,
  getItemDueDate,
  isOverdue,
  getDaysOverdue,
  isDueDateCrossed
} from '../utils/formatters';

const defaultToday = new Date().toISOString().split('T')[0];
const INITIAL_FORM = {
  date: defaultToday,
  dueDate: calculateDefaultDueDate(defaultToday, 45),
  supplier: '',
  towelType: '',
  qty: '',
  unit: 'Pcs',
  rate: '',
  invoiceNo: '',
  paidAmount: '',
  status: 'Pending',
  notes: ''
};

const DEFAULT_TOWEL_ITEMS = [];

const AVAILABLE_TOWEL_OPTIONS = [
  'Bath Towel (30 × 60)',
  'Hand Towel (16 × 24)',
  'Face Towel (12 × 12)',
  'Pool Towel (36 × 72)',
  'Large Towel (30 × 60)',
  'Medium Towel (27 × 54)',
  'Small Towel (24 × 47)',
  'Kitchen Towel',
  'Gym Towel',
  'Cotton Terry Towel',
  'White Bath Towel',
  'Color Bath Towel'
];

const getVarietyBadgeStyle = (name, index) => {
  const lower = (name || '').toLowerCase();
  if (lower.includes('white')) return { bg: '#f1f5f9', color: '#334155' };
  if (lower.includes('bath') || lower.includes('large')) return { bg: '#eff6ff', color: '#1d4ed8' };
  if (lower.includes('hand') || lower.includes('medium')) return { bg: '#ecfdf5', color: '#047857' };
  if (lower.includes('face') || lower.includes('small')) return { bg: '#fef3c7', color: '#b45309' };
  if (lower.includes('pool')) return { bg: '#e0f2fe', color: '#0369a1' };
  if (lower.includes('gym')) return { bg: '#f3e8ff', color: '#7e22ce' };
  if (lower.includes('kitchen')) return { bg: '#ffedd5', color: '#c2410c' };

  const palette = [
    { bg: '#fee2e2', color: '#dc2626' },
    { bg: '#ecfdf5', color: '#059669' },
    { bg: '#eff6ff', color: '#2563eb' },
    { bg: '#fef3c7', color: '#d97706' },
    { bg: '#f3e8ff', color: '#7c3aed' },
    { bg: '#f1f5f9', color: '#334155' }
  ];
  return palette[index % palette.length];
};

export default function TowelPurchaseNoGST() {
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [towelItems, setTowelItems] = useState(DEFAULT_TOWEL_ITEMS);
  const [availableVarieties, setAvailableVarieties] = useState(AVAILABLE_TOWEL_OPTIONS);
  const [selectedVarietyToAdd, setSelectedVarietyToAdd] = useState('');
  const [isTowelDropdownOpen, setIsTowelDropdownOpen] = useState(false);
  const [showAddVariety, setShowAddVariety] = useState(false);
  const [newVarietyName, setNewVarietyName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('All Suppliers');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Sorting
  const [sortField, setSortField] = useState('sno');
  const [sortOrder, setSortOrder] = useState('asc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  // Load items with auto-deduplication
  const loadData = async (notifyOverdue = true) => {
    const data = await storageService.fetchLiveCollection('towelNoGST');
    const cleaned = cleanAccidentalDuplicates(data || []);
    setItems(cleaned);

    if (notifyOverdue) {
      const overdues = cleaned.filter(x => isOverdue(x));
      if (overdues.length > 0) {
        showToast(`⚠️ Payment Alert: ${overdues.length} non-GST towel purchase(s) have passed their 45-day due date!`, 'error');
      }
    }
  };

  useEffect(() => {
    loadData(true);
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleTowelItemChange = (index, field, value) => {
    setTowelItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSelectVariety = (varietyName) => {
    if (!varietyName) return;
    setTowelItems(prev => {
      if (prev.some(it => it.name.toLowerCase() === varietyName.toLowerCase())) {
        return prev;
      }
      return [
        ...prev,
        {
          id: `t_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: varietyName,
          qty: '',
          rate: '',
          unit: formData.unit || 'Pcs'
        }
      ];
    });
    setSelectedVarietyToAdd('');
    setIsTowelDropdownOpen(true);
  };

  const handleAddCustomVariety = () => {
    const trimmed = (newVarietyName || '').trim();
    if (!trimmed) return;

    setAvailableVarieties(prev => {
      if (!prev.some(v => v.toLowerCase() === trimmed.toLowerCase())) {
        return [...prev, trimmed];
      }
      return prev;
    });

    setTowelItems(prev => {
      if (prev.some(it => it.name.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      return [
        ...prev,
        {
          id: `t_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: trimmed,
          qty: '',
          rate: '',
          unit: formData.unit || 'Pcs'
        }
      ];
    });

    setNewVarietyName('');
    setShowAddVariety(false);
    setIsTowelDropdownOpen(true);
  };

  const handleRemoveTowelItem = (index) => {
    setTowelItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Live Auto-Calculations
  const totalQty = useMemo(() => {
    return towelItems.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
  }, [towelItems]);

  const subtotal = useMemo(() => {
    return towelItems.reduce((acc, it) => acc + ((Number(it.qty) || 0) * (Number(it.rate) || 0)), 0);
  }, [towelItems]);

  const avgRate = totalQty > 0 ? Math.round((subtotal / totalQty) * 100) / 100 : 0;
  const activeTowelItemsCount = useMemo(() => {
    return towelItems.filter(it => (Number(it.qty) > 0 || Number(it.rate) > 0)).length;
  }, [towelItems]);
  const totalAmount = subtotal; // No GST for this module

  const currentPaid = formData.paidAmount !== '' && formData.paidAmount !== undefined
    ? Number(formData.paidAmount)
    : 0;
  const currentBalance = Math.max(0, totalAmount - currentPaid);
  const autoStatus = totalAmount > 0 && currentBalance === 0 ? 'Paid' : 'Pending';

  // KPI Metrics
  const metrics = useMemo(() => {
    const totalCost = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const totalQuantity = items.reduce((acc, curr) => acc + (Number(curr.qty) || 0), 0);

    const paidCount = items.filter(x => getPaymentStatus(x) === 'Paid').length;
    const pendingItems = items.filter(x => getPaymentStatus(x) === 'Pending');
    const overdueItems = items.filter(x => isOverdue(x));
    const overdueBalance = overdueItems.reduce((acc, curr) => {
      const bal = curr.balanceAmount !== undefined ? Number(curr.balanceAmount) : Math.max(0, (curr.total || 0) - (curr.paidAmount || 0));
      return acc + bal;
    }, 0);

    return {
      totalCost,
      totalQuantity,
      paidCount,
      pendingCount: pendingItems.length,
      overdueCount: overdueItems.length,
      overdueBalance
    };
  }, [items]);

  // Unique suppliers list
  const uniqueSuppliers = useMemo(() => {
    const set = new Set();
    items.forEach(item => {
      if (item.supplier) set.add(item.supplier.trim());
    });
    return Array.from(set).sort();
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (item.invoiceNo && item.invoiceNo.toLowerCase().includes(q)) ||
        (item.supplier && item.supplier.toLowerCase().includes(q)) ||
        (item.towelType && item.towelType.toLowerCase().includes(q)) ||
        (item.threadType && item.threadType.toLowerCase().includes(q));

      const matchesSupplier =
        supplierFilter === 'All Suppliers' || item.supplier === supplierFilter;

      const itemStatus = getPaymentStatus(item);
      const matchesStatus =
        statusFilter === 'All'
          ? true
          : statusFilter === 'Overdue'
          ? isOverdue(item)
          : itemStatus === statusFilter;

      let matchesDate = true;
      if (startDate) {
        matchesDate = matchesDate && item.date >= startDate;
      }
      if (endDate) {
        matchesDate = matchesDate && item.date <= endDate;
      }

      return matchesSearch && matchesSupplier && matchesStatus && matchesDate;
    });
  }, [items, searchQuery, supplierFilter, statusFilter, startDate, endDate]);

  // Sort items
  const sortedItems = useMemo(() => {
    const indexed = filteredItems.map((item, index) => ({
      ...item,
      sno: index + 1
    }));

    if (sortField === 'sno') {
      if (sortOrder === 'desc') {
        indexed.reverse();
      }
      return indexed;
    }

    indexed.sort((a, b) => {
      let aVal, bVal;
      if (sortField === 'dueDate') {
        aVal = getItemDueDate(a) || '';
        bVal = getItemDueDate(b) || '';
      } else if (sortField === 'total' || sortField === 'amount') {
        aVal = Number(a.total || 0);
        bVal = Number(b.total || 0);
      } else if (sortField === 'date') {
        aVal = a.date || '';
        bVal = b.date || '';
      } else {
        aVal = a[sortField] || '';
        bVal = b[sortField] || '';
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return indexed;
  }, [filteredItems, sortField, sortOrder]);

  const totalPages = Math.ceil(sortedItems.length / itemsPerPage) || 1;
  const paginatedItems = sortedItems.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handlePaidAmountChange = (val) => {
    setFormData(prev => ({
      ...prev,
      paidAmount: val
    }));
  };

  // Form Submit (Create / Update)
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.supplier) {
      showToast('Please enter the supplier name.', 'error');
      return;
    }

    const activeItems = towelItems.filter(it => (Number(it.qty) > 0 || Number(it.rate) > 0) && String(it.name || '').trim());
    if (activeItems.length === 0) {
      showToast('Please enter quantity and rate for at least one towel variety.', 'error');
      setIsTowelDropdownOpen(true);
      return;
    }

    const effectivePaid = formData.paidAmount !== '' && formData.paidAmount !== undefined
      ? Number(formData.paidAmount)
      : 0;
    const effectiveBalance = Math.max(0, totalAmount - effectivePaid);
    const effectiveStatus = totalAmount > 0 && effectiveBalance === 0 ? 'Paid' : 'Pending';

    const existingRecord = editingId ? items.find(x => (x._id || x.id) === editingId) : null;
    const paidAt = effectiveStatus === 'Paid'
      ? (existingRecord?.paidAt || new Date().toISOString())
      : null;

    const effectiveDueDate = formData.dueDate || calculateDefaultDueDate(formData.date, 45);
    const towelTypeName = activeItems.map(it => it.name).join(', ');

    const payload = {
      ...formData,
      dueDate: effectiveDueDate,
      towelType: towelTypeName,
      threadType: towelTypeName,
      qty: totalQty,
      rate: avgRate,
      unit: formData.unit || 'Pcs',
      gstMode: 'WITHOUT_GST',
      gstRate: 0,
      subtotal,
      gstAmount: 0,
      total: totalAmount,
      paidAmount: effectivePaid,
      balanceAmount: effectiveBalance,
      status: effectiveStatus,
      paidAt,
      items: activeItems.map(it => ({
        id: it.id,
        name: it.name,
        towelType: it.name,
        qty: Number(it.qty) || 0,
        rate: Number(it.rate) || 0,
        unit: formData.unit || it.unit || 'Pcs',
        subtotal: (Number(it.qty) || 0) * (Number(it.rate) || 0)
      })),
      invoiceNo: formData.invoiceNo || `REC-TWL-${String(Math.floor(1000 + Math.random() * 9000))}`
    };

    if (editingId) {
      await storageService.updateItem('towelNoGST', editingId, payload);
      showToast('Non-GST towel purchase record updated.');
      setEditingId(null);
    } else {
      await storageService.addItem('towelNoGST', payload);
      showToast('New towel purchase (without GST) added.');
    }

    setIsModalOpen(false);
    setFormData(INITIAL_FORM);
    setTowelItems(DEFAULT_TOWEL_ITEMS);
    setIsTowelDropdownOpen(false);
    setShowAddVariety(false);
    setNewVarietyName('');
    await loadData(false);
  };

  const handleEdit = (item) => {
    if (isPaidLocked(item)) {
      showToast('This record was marked Paid over 24 hours ago and cannot be edited (View Only).', 'error');
      return;
    }

    const targetId = item._id || item.id || (item.invoiceNo ? `inv_${item.invoiceNo}` : null);
    setEditingId(targetId);

    const calcDueDate = getItemDueDate(item);

    setFormData({
      date: item.date ? String(item.date).split('T')[0] : defaultToday,
      dueDate: calcDueDate,
      supplier: item.supplier || '',
      towelType: item.towelType || item.threadType || '',
      qty: item.qty || '',
      unit: item.unit || 'Pcs',
      rate: item.rate || '',
      invoiceNo: item.invoiceNo || '',
      paidAmount: item.paidAmount !== undefined ? item.paidAmount : (item.status === 'Paid' ? item.total : 0),
      status: item.status || 'Pending',
      notes: item.notes || ''
    });

    if (Array.isArray(item.items) && item.items.length > 0) {
      const parsedItems = item.items.map((it, idx) => ({
        id: it.id || `t_${idx}_${Date.now()}`,
        name: it.name || it.towelType || it.threadType || 'Towel',
        qty: it.qty || '',
        rate: it.rate || '',
        unit: it.unit || item.unit || 'Pcs'
      }));
      setTowelItems(parsedItems);
      setIsTowelDropdownOpen(true);
    } else {
      const singleName = item.towelType || item.threadType || 'Bath Towel (30 × 60)';
      setTowelItems([
        {
          id: `t_single_${Date.now()}`,
          name: singleName,
          qty: item.qty || '',
          rate: item.rate || '',
          unit: item.unit || 'Pcs'
        }
      ]);
      setIsTowelDropdownOpen(true);
    }

    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await storageService.deleteItem('towelNoGST', deletingId);
    showToast('Towel purchase record deleted.');
    setDeletingId(null);
    await loadData(false);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSupplierFilter('All Suppliers');
    setStatusFilter('All');
    setStartDate('');
    setEndDate('');
    setPage(1);
    setSortField('sno');
    setSortOrder('asc');
  };

  // CSV Export
  const handleExportCSV = () => {
    if (sortedItems.length === 0) {
      showToast('No towel purchase data to export.', 'error');
      return;
    }

    const headers = [
      'S.No',
      'Slip / Bill No',
      'Date',
      'Due Date (45 Days)',
      'Supplier',
      'Towel Type / Varieties',
      'Quantity',
      'Unit',
      'Avg Rate',
      'Total Amount',
      'Paid Amount',
      'Balance Due',
      'Payment Status'
    ];

    const rows = sortedItems.map((item, index) => [
      index + 1,
      `"${item.invoiceNo || ''}"`,
      item.date || '',
      getItemDueDate(item),
      `"${(item.supplier || '').replace(/"/g, '""')}"`,
      `"${(item.towelType || item.threadType || '').replace(/"/g, '""')}"`,
      item.qty || 0,
      item.unit || 'Pcs',
      item.rate || 0,
      item.total || 0,
      item.paidAmount || 0,
      item.balanceAmount || 0,
      getPaymentStatus(item)
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NSS_TEX_Towel_Purchase_NoGST_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Non-GST towel purchase report exported.');
  };

  const handlePrintSummary = () => {
    window.print();
  };

  return (
    <div className="page-container animate-fade-in">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2 className="page-title">Towel Purchase (Without GST)</h2>
          <p className="page-subtitle">Manage towel purchases without GST for your manufacturing and wholesale unit</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCSV}
            title="Export CSV"
          >
            <Download size={16} /> Export
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handlePrintSummary}
            title="Print Summary"
          >
            <Printer size={16} /> Print
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingId(null);
              setFormData({
                ...INITIAL_FORM,
                dueDate: calculateDefaultDueDate(defaultToday, 45)
              });
              setTowelItems(DEFAULT_TOWEL_ITEMS);
              setIsTowelDropdownOpen(false);
              setShowAddVariety(false);
              setNewVarietyName('');
              setIsModalOpen(true);
            }}
          >
            <Plus size={16} /> Add Towel Purchase
          </button>
        </div>
      </div>

      {/* Overdue Notification Banner */}
      {metrics.overdueCount > 0 && (
        <div className="overdue-notification-banner" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: '#ffe4e6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#e11d48',
              flexShrink: 0
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#9f1239', fontSize: '0.925rem' }}>
                Payment Overdue Alert: {metrics.overdueCount} {metrics.overdueCount === 1 ? 'purchase has' : 'purchases have'} crossed the 45-day due date!
              </div>
              <div style={{ fontSize: '0.82rem', color: '#be123c', marginTop: '2px' }}>
                Total overdue pending balance: <strong>{formatINR(metrics.overdueBalance)}</strong>. Prompt supplier settlement is recommended.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              backgroundColor: statusFilter === 'Overdue' ? '#9f1239' : '#e11d48',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              padding: '0.45rem 0.95rem',
              cursor: 'pointer',
              borderRadius: 'var(--radius-md)'
            }}
            onClick={() => {
              setStatusFilter(prev => prev === 'Overdue' ? 'All' : 'Overdue');
              setPage(1);
            }}
          >
            {statusFilter === 'Overdue' ? 'Show All Purchases' : `View ${metrics.overdueCount} Overdue Purchases`}
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '1.25rem' }}>
        <MetricCard
          title="Total Purchase Cost"
          value={formatINR(metrics.totalCost)}
          trend="Live"
          trendType="neutral"
          icon={DollarSign}
          iconBg="#ecfdf5"
          iconColor="#059669"
        />
        <MetricCard
          title="Paid Count"
          value={metrics.paidCount}
          trend={statusFilter === 'Paid' ? 'Active Filter (Click to reset)' : 'Click to filter'}
          trendType={statusFilter === 'Paid' ? 'up' : 'neutral'}
          trendText=""
          icon={CheckCircle2}
          iconBg="#ecfdf5"
          iconColor="#16a34a"
          onClick={() => {
            setStatusFilter(prev => prev === 'Paid' ? 'All' : 'Paid');
            setPage(1);
          }}
          isActive={statusFilter === 'Paid'}
          activeVariant="paid"
          badge={statusFilter === 'Paid' ? 'Filtered' : undefined}
        />
        <MetricCard
          title="Pending Count"
          value={metrics.pendingCount}
          trend={statusFilter === 'Pending' ? 'Active Filter (Click to reset)' : 'Click to filter'}
          trendType={statusFilter === 'Pending' ? 'down' : 'neutral'}
          trendText=""
          icon={Clock}
          iconBg="#fff7ed"
          iconColor="#ea580c"
          onClick={() => {
            setStatusFilter(prev => prev === 'Pending' ? 'All' : 'Pending');
            setPage(1);
          }}
          isActive={statusFilter === 'Pending'}
          activeVariant="pending"
          badge={statusFilter === 'Pending' ? 'Filtered' : undefined}
        />
        <MetricCard
          title="Overdue Count"
          value={metrics.overdueCount}
          trend={statusFilter === 'Overdue' ? 'Active Filter (Click to reset)' : (metrics.overdueCount > 0 ? `${metrics.overdueCount} Overdue` : 'All clear')}
          trendType={metrics.overdueCount > 0 ? 'down' : 'up'}
          trendText=""
          icon={AlertTriangle}
          iconBg="#fee2e2"
          iconColor="#dc2626"
          onClick={() => {
            setStatusFilter(prev => prev === 'Overdue' ? 'All' : 'Overdue');
            setPage(1);
          }}
          isActive={statusFilter === 'Overdue'}
          activeVariant="overdue"
          badge={statusFilter === 'Overdue' ? 'Filtered' : (metrics.overdueCount > 0 ? 'Action Req.' : undefined)}
        />
      </div>

      {/* Table Filter Controls */}
      <div className="filter-card card" style={{ marginBottom: '1.25rem', padding: '0.85rem 1rem' }}>
        <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1, minWidth: '300px' }}>
            <div className="search-input-wrapper" style={{ position: 'relative', minWidth: '220px', flex: 1 }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search Bill #, Supplier, Variety..."
                style={{ paddingLeft: '2.1rem' }}
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              />
            </div>

            <select
              className="form-input"
              style={{ width: 'auto', minWidth: '160px' }}
              value={supplierFilter}
              onChange={e => { setSupplierFilter(e.target.value); setPage(1); }}
            >
              <option value="All Suppliers">All Suppliers</option>
              {uniqueSuppliers.map(sup => (
                <option key={sup} value={sup}>{sup}</option>
              ))}
            </select>

            <select
              className="form-input"
              style={{ width: 'auto', minWidth: '140px' }}
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="All">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue (45+ Days)</option>
            </select>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={resetFilters}
            style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
          >
            <RotateCcw size={14} /> Reset Filters
          </button>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)' }}>
                <th
                  style={{ width: '50px', textAlign: 'center', cursor: 'pointer', padding: '0.75rem 0.5rem' }}
                  onClick={() => handleSort('sno')}
                >
                  S.No {sortField === 'sno' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th style={{ padding: '0.75rem 0.75rem' }}>Bill / Slip #</th>
                <th
                  style={{ cursor: 'pointer', padding: '0.75rem 0.75rem' }}
                  onClick={() => handleSort('date')}
                >
                  Date {sortField === 'date' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  style={{ cursor: 'pointer', padding: '0.75rem 0.75rem' }}
                  onClick={() => handleSort('dueDate')}
                >
                  Due Date (45d) {sortField === 'dueDate' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th style={{ padding: '0.75rem 0.75rem' }}>Supplier</th>
                <th style={{ padding: '0.75rem 0.75rem' }}>Towel Varieties</th>
                <th style={{ textAlign: 'right', padding: '0.75rem 0.75rem' }}>Quantity</th>
                <th style={{ textAlign: 'right', padding: '0.75rem 0.75rem' }}>Avg Rate</th>
                <th
                  style={{ textAlign: 'right', cursor: 'pointer', padding: '0.75rem 0.75rem', fontWeight: 700 }}
                  onClick={() => handleSort('total')}
                >
                  Total Amount {sortField === 'total' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th style={{ textAlign: 'right', padding: '0.75rem 0.75rem' }}>Paid</th>
                <th style={{ textAlign: 'right', padding: '0.75rem 0.75rem' }}>Balance</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.75rem' }}>Status</th>
                <th style={{ textAlign: 'center', width: '90px', padding: '0.75rem 0.5rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan="13" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No non-GST towel purchases found.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => {
                  const effectiveStatus = getPaymentStatus(item);
                  const isLocked = isPaidLocked(item);
                  const itemDue = getItemDueDate(item);
                  const itemOverdue = isOverdue(item);
                  const daysOverdue = getDaysOverdue(item);

                  const varietyList = Array.isArray(item.items) && item.items.length > 0
                    ? item.items
                    : [{ name: item.towelType || item.threadType || 'Towel', qty: item.qty, rate: item.rate }];

                  return (
                    <tr
                      key={item._id || item.id || idx}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        backgroundColor: itemOverdue ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {item.sno}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        <button
                          type="button"
                          className="link-button"
                          style={{ color: 'var(--primary-400)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                          onClick={() => setViewingItem(item)}
                          title="View Details"
                        >
                          {item.invoiceNo || `REC-TWL-${String(item._id || item.id || '').slice(-4)}`}
                        </button>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {formatDate(item.date)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ color: itemOverdue ? '#ef4444' : 'var(--text-secondary)', fontWeight: itemOverdue ? 700 : 500 }}>
                            {formatDate(itemDue)}
                          </span>
                          {itemOverdue && (
                            <span style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 600 }}>
                              ⚠️ {daysOverdue}d overdue
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.supplier}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', maxWidth: '240px' }}>
                          {varietyList.map((v, vIdx) => {
                            const badge = getVarietyBadgeStyle(v.name, vIdx);
                            return (
                              <span
                                key={vIdx}
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  backgroundColor: badge.bg,
                                  color: badge.color,
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                {v.name}
                                {v.qty ? <span style={{ opacity: 0.8 }}>({v.qty})</span> : null}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {Number(item.qty || 0).toLocaleString('en-IN')} {item.unit || 'Pcs'}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                        {formatINR(item.rate || 0)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatINR(item.total || (Number(item.qty || 0) * Number(item.rate || 0)))}
                      </td>
                      <td style={{ textAlign: 'right', color: '#10b981' }}>
                        {formatINR(item.paidAmount !== undefined ? item.paidAmount : (item.status === 'Paid' ? item.total : 0))}
                      </td>
                      <td style={{ textAlign: 'right', color: Number(item.balanceAmount) > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                        {formatINR(item.balanceAmount !== undefined ? item.balanceAmount : Math.max(0, (item.total || 0) - (item.paidAmount || 0)))}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <StatusBadge status={itemOverdue ? 'Overdue' : effectiveStatus} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                          <button
                            type="button"
                            className="btn-icon"
                            title="View Record"
                            onClick={() => setViewingItem(item)}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            title={isLocked ? 'Paid over 24h ago — Locked (View Only)' : 'Edit Record'}
                            disabled={isLocked}
                            onClick={() => handleEdit(item)}
                            style={{ opacity: isLocked ? 0.35 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
                          >
                            {isLocked ? <Lock size={14} color="#94a3b8" /> : <Edit2 size={15} />}
                          </button>
                          <button
                            type="button"
                            className="btn-icon delete"
                            title="Delete Record"
                            onClick={() => setDeletingId(item._id || item.id)}
                          >
                            <Trash2 size={15} color="#ef4444" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
            <span>Rows per page:</span>
            <select
              className="form-input"
              style={{ width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.78rem' }}
              value={itemsPerPage}
              onChange={e => { setItemsPerPage(Number(e.target.value)); setPage(1); }}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <span>
              Showing {sortedItems.length === 0 ? 0 : (page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, sortedItems.length)} of {sortedItems.length} entries
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Page {page} of {totalPages}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Purchase Modal */}
      {/* Modal Dialog Box for Add & Edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setIsTowelDropdownOpen(false);
          setShowAddVariety(false);
          setNewVarietyName('');
          setEditingId(null);
        }}
        title={editingId ? 'Edit Towel Purchase (Without GST)' : 'Add Towel Purchase (Without GST)'}
        maxWidth="1120px"
      >
        <form onSubmit={handleSubmit} style={{ width: '100%', boxSizing: 'border-box' }}>
          <div className="erp-form-grid">
            <div className="form-group">
              <label className="form-label">Purchase Date <span className="required">*</span></label>
              <input
                type="date"
                className="form-control"
                value={formData.date}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setFormData(prev => {
                    const wasDefault = !prev.dueDate || prev.dueDate === calculateDefaultDueDate(prev.date, 45);
                    return {
                      ...prev,
                      date: newDate,
                      dueDate: wasDefault ? calculateDefaultDueDate(newDate, 45) : prev.dueDate
                    };
                  });
                }}
                required
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Payment Due Date <span className="required">*</span></label>
                <span style={{ fontSize: '0.72rem', color: 'var(--primary-600)', fontWeight: 600 }}>Default: 45 Days</span>
              </div>
              <input
                type="date"
                className="form-control"
                style={
                  formData.dueDate && isDueDateCrossed(formData.dueDate)
                    ? { borderColor: '#ef4444', color: '#dc2626', fontWeight: 600, backgroundColor: '#fef2f2' }
                    : {}
                }
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                required
              />
              {formData.dueDate && isDueDateCrossed(formData.dueDate) && (
                <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  <AlertTriangle size={12} /> Due date crossed today's date (Overdue)
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Presets:</span>
                <button
                  type="button"
                  className="btn btn-xs"
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.68rem',
                    backgroundColor: formData.dueDate === (formData.date || defaultToday) ? 'var(--primary-50)' : '#f1f5f9',
                    color: formData.dueDate === (formData.date || defaultToday) ? 'var(--primary-700)' : 'inherit',
                    borderColor: formData.dueDate === (formData.date || defaultToday) ? 'var(--primary-300)' : 'transparent',
                    fontWeight: formData.dueDate === (formData.date || defaultToday) ? 600 : 400
                  }}
                  onClick={() => setFormData(p => ({ ...p, dueDate: p.date || defaultToday }))}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="btn btn-xs"
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.68rem',
                    backgroundColor: formData.dueDate === calculateDefaultDueDate(formData.date || defaultToday, 15) ? 'var(--primary-50)' : '#f1f5f9',
                    color: formData.dueDate === calculateDefaultDueDate(formData.date || defaultToday, 15) ? 'var(--primary-700)' : 'inherit',
                    borderColor: formData.dueDate === calculateDefaultDueDate(formData.date || defaultToday, 15) ? 'var(--primary-300)' : 'transparent',
                    fontWeight: formData.dueDate === calculateDefaultDueDate(formData.date || defaultToday, 15) ? 600 : 400
                  }}
                  onClick={() => setFormData(p => ({ ...p, dueDate: calculateDefaultDueDate(p.date || defaultToday, 15) }))}
                >
                  +15 Days
                </button>
                <button
                  type="button"
                  className="btn btn-xs"
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.68rem',
                    backgroundColor: formData.dueDate === calculateDefaultDueDate(formData.date || defaultToday, 30) ? 'var(--primary-50)' : '#f1f5f9',
                    color: formData.dueDate === calculateDefaultDueDate(formData.date || defaultToday, 30) ? 'var(--primary-700)' : 'inherit',
                    borderColor: formData.dueDate === calculateDefaultDueDate(formData.date || defaultToday, 30) ? 'var(--primary-300)' : 'transparent',
                    fontWeight: formData.dueDate === calculateDefaultDueDate(formData.date || defaultToday, 30) ? 600 : 400
                  }}
                  onClick={() => setFormData(p => ({ ...p, dueDate: calculateDefaultDueDate(p.date || defaultToday, 30) }))}
                >
                  30 Days
                </button>
                <button
                  type="button"
                  className="btn btn-xs"
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.68rem',
                    backgroundColor: formData.dueDate === calculateDefaultDueDate(formData.date || defaultToday, 45) ? 'var(--primary-50)' : '#f1f5f9',
                    color: formData.dueDate === calculateDefaultDueDate(formData.date || defaultToday, 45) ? 'var(--primary-700)' : 'inherit',
                    borderColor: formData.dueDate === calculateDefaultDueDate(formData.date || defaultToday, 45) ? 'var(--primary-300)' : 'transparent',
                    fontWeight: formData.dueDate === calculateDefaultDueDate(formData.date || defaultToday, 45) ? 600 : 400
                  }}
                  onClick={() => setFormData(p => ({ ...p, dueDate: calculateDefaultDueDate(p.date || defaultToday, 45) }))}
                >
                  45 Days (Default)
                </button>
                <button
                  type="button"
                  className="btn btn-xs"
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.68rem',
                    backgroundColor: formData.dueDate === calculateDefaultDueDate(formData.date || defaultToday, 60) ? 'var(--primary-50)' : '#f1f5f9',
                    color: formData.dueDate === calculateDefaultDueDate(formData.date || defaultToday, 60) ? 'var(--primary-700)' : 'inherit',
                    borderColor: formData.dueDate === calculateDefaultDueDate(formData.date || defaultToday, 60) ? 'var(--primary-300)' : 'transparent',
                    fontWeight: formData.dueDate === calculateDefaultDueDate(formData.date || defaultToday, 60) ? 600 : 400
                  }}
                  onClick={() => setFormData(p => ({ ...p, dueDate: calculateDefaultDueDate(p.date || defaultToday, 60) }))}
                >
                  60 Days
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Slip / Ref Number</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. REC-TWL-1024"
                value={formData.invoiceNo}
                onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Supplier / Weaver Name <span className="required">*</span></label>
              <input
                type="text"
                list="towel-nogst-supplier-list"
                className="form-control"
                placeholder="Enter supplier or weaver name"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                required
              />
              <datalist id="towel-nogst-supplier-list">
                {uniqueSuppliers.map((sup) => (
                  <option key={sup} value={sup} />
                ))}
              </datalist>
            </div>

            <div className="form-group">
              <label className="form-label">Unit <span className="required">*</span></label>
              <select
                className="form-control"
                value={formData.unit || 'Pcs'}
                onChange={(e) => {
                  const newUnit = e.target.value;
                  setFormData({ ...formData, unit: newUnit });
                  setTowelItems(prev => prev.map(it => ({ ...it, unit: newUnit })));
                }}
              >
                <option value="Pcs">Pcs (Pieces)</option>
                <option value="Dzn">Dzn (Dozens)</option>
                <option value="Bundles">Bundles</option>
                <option value="Kg">Kg</option>
                <option value="Mtrs">Mtrs</option>
              </select>
            </div>

            {/* Towel Rate Details as Dropdown Container */}
            <div className="form-group col-span-full" style={{ marginTop: '0.4rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>
                  Towel Rate Details <span className="required">*</span>
                </label>
                {activeTowelItemsCount > 0 && (
                  <span style={{
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    color: '#0369a1',
                    backgroundColor: '#e0f2fe',
                    padding: '2px 8px',
                    borderRadius: '12px'
                  }}>
                    {activeTowelItemsCount} active {activeTowelItemsCount === 1 ? 'variety' : 'varieties'} • {totalQty} {formData.unit || 'Pcs'} • {formatINR(totalAmount)}
                  </span>
                )}
              </div>

              {/* Dropdown Box trigger - click to open/close */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setIsTowelDropdownOpen(prev => !prev)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsTowelDropdownOpen(prev => !prev);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1.15rem',
                  backgroundColor: isTowelDropdownOpen ? '#f8fafc' : '#ffffff',
                  border: isTowelDropdownOpen ? '1.5px solid var(--primary-600, #2563eb)' : '1px solid #cbd5e1',
                  borderRadius: isTowelDropdownOpen ? '12px 12px 0 0' : '12px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.15s ease',
                  boxShadow: isTowelDropdownOpen ? '0 2px 4px rgba(37,99,235,0.08)' : '0 1px 2px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '9px',
                    backgroundColor: activeTowelItemsCount > 0 ? '#eff6ff' : '#f1f5f9',
                    color: activeTowelItemsCount > 0 ? 'var(--primary-600, #2563eb)' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Package size={20} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>
                        {activeTowelItemsCount > 0
                          ? `${activeTowelItemsCount} Towel ${activeTowelItemsCount === 1 ? 'Variety' : 'Varieties'} Configured`
                          : 'Select / Enter Towel Rate Details'}
                      </span>
                      {activeTowelItemsCount > 0 && (
                        <span style={{ fontSize: '0.85rem', color: 'var(--primary-600, #2563eb)', fontWeight: 700 }}>
                          ({formatINR(totalAmount)})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isTowelDropdownOpen
                        ? 'Click to collapse rate details'
                        : (activeTowelItemsCount > 0
                            ? towelItems
                                .filter(it => Number(it.qty) > 0 || Number(it.rate) > 0)
                                .map(it => `${it.name}: ${it.qty} ${formData.unit || 'Pcs'} @ ₹${it.rate}`)
                                .join(' • ')
                            : (towelItems.length > 0
                                ? towelItems.map(it => it.name).join(' • ')
                                : 'Click this dropdown to select varieties (Bath Towel, Hand Towel, Face Towel...)'))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: isTowelDropdownOpen ? 'var(--primary-600, #2563eb)' : '#64748b'
                  }}>
                    {isTowelDropdownOpen ? 'Hide Details' : 'Show Details'}
                  </span>
                  <ChevronDown
                    size={18}
                    style={{
                      color: isTowelDropdownOpen ? 'var(--primary-600, #2563eb)' : '#64748b',
                      transform: isTowelDropdownOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                </div>
              </div>

              {/* Dropdown Content */}
              {isTowelDropdownOpen && (
                <div style={{
                  border: '1.5px solid var(--primary-600, #2563eb)',
                  borderTop: 'none',
                  borderRadius: '0 0 12px 12px',
                  padding: '1.25rem',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}>
                  {/* Select Towel Variety Dropdown */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '1rem',
                    padding: '0.85rem 1rem',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ flex: '1 1 280px' }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                        Select Towel Variety to Add:
                      </label>
                      <select
                        className="form-control"
                        value={selectedVarietyToAdd}
                        onChange={(e) => handleSelectVariety(e.target.value)}
                        style={{
                          fontWeight: 500,
                          backgroundColor: '#ffffff',
                          borderColor: '#cbd5e1',
                          cursor: 'pointer',
                          fontSize: '0.88rem'
                        }}
                      >
                        <option value="">-- Choose Towel Variety (e.g. Bath Towel 30×60, Hand Towel...) --</option>
                        {availableVarieties.map((v) => {
                          const isAlreadyAdded = towelItems.some(it => it.name.toLowerCase() === v.toLowerCase());
                          return (
                            <option key={v} value={v} disabled={isAlreadyAdded}>
                              {v} {isAlreadyAdded ? '✓ (Already on screen)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Towel Varieties List */}
                  {towelItems.length === 0 ? (
                    <div style={{
                      padding: '1.75rem 1rem',
                      textAlign: 'center',
                      backgroundColor: '#f8fafc',
                      border: '1.5px dashed #cbd5e1',
                      borderRadius: '10px',
                      color: '#64748b',
                      margin: '0.5rem 0 1rem 0'
                    }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        backgroundColor: '#eff6ff',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 8px auto'
                      }}>
                        <Package size={22} />
                      </div>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.92rem' }}>
                        No Towel Varieties Selected Yet
                      </div>
                      <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                        Choose a variety from the dropdown above (e.g. <strong>Bath Towel (30 × 60)</strong>, <strong>Hand Towel (16 × 24)</strong>) to enter quantity & rate, or click <strong>Add Towel Variety (+)</strong>.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {towelItems.map((item, idx) => {
                        const badge = getVarietyBadgeStyle(item.name, idx);
                        const lineSubtotal = (Number(item.qty) || 0) * (Number(item.rate) || 0);
                        return (
                          <div
                            key={item.id || idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.75rem 0.5rem',
                              borderBottom: idx < towelItems.length - 1 ? '1px solid #f1f5f9' : 'none',
                              flexWrap: 'wrap',
                              gap: '1rem'
                            }}
                          >
                            {/* Left: Icon Badge & Name */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '220px' }}>
                              <div style={{
                                width: '46px',
                                height: '46px',
                                borderRadius: '10px',
                                backgroundColor: badge.bg,
                                color: badge.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                <Package size={22} color={badge.color} />
                              </div>
                              <div>
                                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
                                  {item.name}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                                  Quantity and rate per unit ({formData.unit || 'Pcs'}) • Subtotal: {formatINR(lineSubtotal)}
                                </div>
                              </div>
                            </div>

                            {/* Right: Qty Box, Rate Box & Remove Button */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                              {/* Qty Card */}
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                padding: '6px 14px',
                                minWidth: '110px',
                                backgroundColor: '#ffffff',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                              }}>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500, marginBottom: '2px' }}>
                                  Qty ({formData.unit || 'Pcs'})
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={item.qty}
                                  onChange={(e) => handleTowelItemChange(idx, 'qty', e.target.value)}
                                  placeholder="0"
                                  style={{
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                    fontSize: '1rem',
                                    fontWeight: 500,
                                    color: '#0f172a',
                                    padding: 0,
                                    width: '100%'
                                  }}
                                />
                              </div>

                              {/* Rate Card */}
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                padding: '6px 14px',
                                minWidth: '130px',
                                backgroundColor: '#ffffff',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                              }}>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500, marginBottom: '2px' }}>
                                  Rate (₹)
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={item.rate}
                                  onChange={(e) => handleTowelItemChange(idx, 'rate', e.target.value)}
                                  placeholder="0"
                                  style={{
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                    fontSize: '1rem',
                                    fontWeight: 500,
                                    color: '#0f172a',
                                    padding: 0,
                                    width: '100%'
                                  }}
                                />
                              </div>

                              {/* Delete / Remove Action */}
                              <button
                                type="button"
                                onClick={() => handleRemoveTowelItem(idx)}
                                title={`Remove ${item.name}`}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#94a3b8',
                                  cursor: 'pointer',
                                  padding: '8px',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#dc2626';
                                  e.currentTarget.style.backgroundColor = '#fee2e2';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#94a3b8';
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Summary footer */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '0.85rem',
                    marginTop: '0.75rem',
                    borderTop: '1px solid #f1f5f9',
                    fontSize: '0.825rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      Active Varieties: <strong>{activeTowelItemsCount}</strong> | Total Quantity:{' '}
                      <strong style={{ color: '#0f172a' }}>{totalQty} {formData.unit || 'Pcs'}</strong>
                    </span>
                    <span style={{ color: '#0f172a', fontWeight: 600 }}>
                      Towel Total:{' '}
                      <strong style={{ color: 'var(--primary-600)', fontSize: '0.95rem' }}>
                        {formatINR(totalAmount)}
                      </strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Under the drop down add customized button to add towel variety */}
              <div style={{ marginTop: '0.65rem' }}>
                {!showAddVariety ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsTowelDropdownOpen(true);
                      setShowAddVariety(true);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 18px',
                      backgroundColor: '#eff6ff',
                      border: '1.5px dashed var(--primary-500, #3b82f6)',
                      borderRadius: '8px',
                      color: 'var(--primary-700, #1d4ed8)',
                      fontWeight: 600,
                      fontSize: '0.83rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#dbeafe';
                      e.currentTarget.style.borderColor = 'var(--primary-600, #2563eb)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#eff6ff';
                      e.currentTarget.style.borderColor = 'var(--primary-500, #3b82f6)';
                    }}
                  >
                    <Plus size={16} color="var(--primary-600, #2563eb)" />
                    <span>Add Towel Variety (+)</span>
                  </button>
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.85rem 1rem',
                    backgroundColor: '#f8fafc',
                    border: '1.5px dashed var(--primary-500, #3b82f6)',
                    borderRadius: '10px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                  }}>
                    <input
                      type="text"
                      list="towel-variety-custom-list-nogst"
                      className="form-control"
                      placeholder="Enter towel variety name (e.g. Terry Bath Towel 30x60)..."
                      value={newVarietyName}
                      onChange={(e) => setNewVarietyName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomVariety();
                        }
                      }}
                      autoFocus
                      style={{ flex: 1, backgroundColor: '#ffffff' }}
                    />
                    <datalist id="towel-variety-custom-list-nogst">
                      {AVAILABLE_TOWEL_OPTIONS.map(opt => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleAddCustomVariety}
                      disabled={!newVarietyName.trim()}
                      style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Check size={14} /> Add Variety
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setShowAddVariety(false);
                        setNewVarietyName('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Total Amount (₹)</label>
              <input
                type="text"
                className="form-control"
                readOnly
                style={{ fontWeight: 700, color: 'var(--primary-600)', backgroundColor: '#f8fafc' }}
                value={formatINR(totalAmount)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Amount Paid (₹)</label>
              <input
                type="number"
                min="0"
                step="any"
                className="form-control"
                placeholder="Enter paid amount"
                value={formData.paidAmount}
                onChange={(e) => handlePaidAmountChange(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Balance Amount (₹)</label>
              <input
                type="text"
                className="form-control"
                readOnly
                style={{ fontWeight: 600, color: currentBalance > 0 ? '#d97706' : '#15803d' }}
                value={formatINR(currentBalance)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Payment Status <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Automatic)</span></label>
              <div style={{ display: 'flex', alignItems: 'center', height: '40px', gap: '0.6rem' }}>
                <StatusBadge status={autoStatus} />
                <span style={{ fontSize: '0.75rem', color: autoStatus === 'Paid' ? '#059669' : '#d97706', fontWeight: 600 }}>
                  {autoStatus === 'Paid' ? 'Paid in Full' : `Pending (Balance ₹ ${formatINR(currentBalance)})`}
                </span>
              </div>
            </div>

            <div className="form-group col-span-full">
              <label className="form-label">Notes & Remarks</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Enter additional non-GST towel purchase notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsModalOpen(false);
                setFormData(INITIAL_FORM);
                setTowelItems(DEFAULT_TOWEL_ITEMS);
                setIsTowelDropdownOpen(false);
                setShowAddVariety(false);
                setNewVarietyName('');
                setEditingId(null);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Update Towel Purchase' : 'Save Towel Purchase'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Details Modal */}
      <Modal isOpen={!!viewingItem} onClose={() => setViewingItem(null)} title="Non-GST Towel Purchase Details" maxWidth="1120px">
        {viewingItem && (() => {
          const vTotal = Number(viewingItem.total || 0);
          const vPaid = viewingItem.paidAmount !== undefined && viewingItem.paidAmount !== null && viewingItem.paidAmount !== ''
            ? Number(viewingItem.paidAmount)
            : (getPaymentStatus(viewingItem) === 'Paid' ? vTotal : 0);
          const vBalance = Math.max(0, vTotal - vPaid);
          const vDue = getItemDueDate(viewingItem);
          const vOverdue = isOverdue(viewingItem);
          const vDays = getDaysOverdue(viewingItem);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div><strong style={{ color: 'var(--text-muted)' }}>Slip / Ref No:</strong> {viewingItem.invoiceNo}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Purchase Date:</strong> {formatDate(viewingItem.date)}</div>
                <div>
                  <strong style={{ color: 'var(--text-muted)' }}>Due Date:</strong>{' '}
                  <span style={{
                    color: vOverdue ? '#dc2626' : 'var(--text-main)',
                    fontWeight: vOverdue ? 700 : 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {vOverdue && <AlertTriangle size={13} color="#dc2626" />}
                    {formatDate(vDue)}
                  </span>{' '}
                  {vOverdue && (
                    <span className="overdue-tag" style={{ marginLeft: '4px' }}>
                      Overdue ({vDays}d)
                    </span>
                  )}
                </div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Supplier / Weaver:</strong> {viewingItem.supplier}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Towel Varieties:</strong> {viewingItem.towelType || viewingItem.threadType}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Total Quantity:</strong> {viewingItem.qty} {viewingItem.unit || 'Pcs'}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Average Rate:</strong> ₹ {viewingItem.rate}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Total Amount:</strong> <strong style={{ color: 'var(--primary-600)' }}>{formatINR(viewingItem.total)}</strong></div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Amount Paid:</strong> <strong style={{ color: '#059669' }}>{formatINR(vPaid)}</strong></div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Balance Amount:</strong> <strong style={{ color: vBalance > 0 ? '#d97706' : '#64748b' }}>{formatINR(vBalance)}</strong></div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Payment Status:</strong> <StatusBadge status={getPaymentStatus(viewingItem)} isLocked={isPaidLocked(viewingItem)} /></div>
              </div>

              {/* Towel Varieties Breakdown Table */}
              {Array.isArray(viewingItem.items) && viewingItem.items.length > 0 && (
                <div style={{ marginTop: '0.25rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    Towel Varieties Breakdown ({viewingItem.items.length})
                  </h4>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px', color: 'var(--text-muted)', width: '45px' }}>#</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Towel Variety / Name</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-muted)', textAlign: 'right' }}>Quantity</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-muted)', textAlign: 'right' }}>Rate (₹)</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-muted)', textAlign: 'right' }}>Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingItem.items.map((it, idx) => (
                          <tr key={it.id || idx} style={{ borderBottom: idx < viewingItem.items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                            <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-main)' }}>{it.name || it.towelType || it.threadType}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>{it.qty} {it.unit || viewingItem.unit || 'Pcs'}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>₹ {it.rate}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--primary-600)' }}>
                              {formatINR(it.subtotal || ((Number(it.qty) || 0) * (Number(it.rate) || 0)))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot style={{ backgroundColor: '#f8fafc', borderTop: '1px solid var(--border-color)', fontWeight: 600 }}>
                        <tr>
                          <td colSpan={2} style={{ padding: '8px 12px' }}>Total</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            {viewingItem.items.reduce((s, x) => s + (Number(x.qty) || 0), 0)} {viewingItem.unit || 'Pcs'}
                          </td>
                          <td></td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--primary-600)' }}>
                            {formatINR(viewingItem.total)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {viewingItem.notes && (
                <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)' }}>
                  <strong style={{ color: 'var(--text-muted)' }}>Notes:</strong> {viewingItem.notes}
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

              {/* Created & Updated Timestamps */}
              <div style={{
                marginTop: '0.5rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                fontSize: '0.75rem',
                color: 'var(--text-muted)'
              }}>
                <div>
                  <strong style={{ color: 'var(--text-main)' }}>Created At:</strong> {formatDateTime(viewingItem.createdAt || viewingItem.date)}
                </div>
                <div>
                  <strong style={{ color: 'var(--text-main)' }}>Updated At:</strong> {formatDateTime(viewingItem.updatedAt || viewingItem.createdAt || viewingItem.date)}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
                  <Printer size={15} /> Print
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setViewingItem(null)}>Close</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete Towel Purchase (Without GST)"
        message="Are you sure you want to delete this non-GST towel purchase entry?"
        confirmText="Delete Record"
        type="danger"
      />
    </div>
  );
}
