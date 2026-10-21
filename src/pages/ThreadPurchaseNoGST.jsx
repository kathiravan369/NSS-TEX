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
  threadType: '',
  qty: '',
  unit: 'Kg',
  rate: '',
  invoiceNo: '',
  paidAmount: '',
  status: 'Pending',
  notes: ''
};

const DEFAULT_COTTON_ITEMS = [];

const AVAILABLE_COTTON_OPTIONS = [
  'White Cotton',
  'Red Cotton',
  'Blue Cotton',
  'Green Cotton',
  'Yellow Cotton',
  'Black Cotton',
  'Grey Melange',
  'Organic Cotton',
  '40s Combed Cotton'
];

const getVarietyBadgeStyle = (name, index) => {
  const lower = (name || '').toLowerCase();
  if (lower.includes('white')) return { bg: '#f1f5f9', color: '#334155' };
  if (lower.includes('red') || lower.includes('rose') || lower.includes('pink') || lower.includes('crimson')) return { bg: '#fee2e2', color: '#dc2626' };
  if (lower.includes('blue') || lower.includes('navy') || lower.includes('indigo')) return { bg: '#eff6ff', color: '#2563eb' };
  if (lower.includes('green') || lower.includes('emerald') || lower.includes('mint')) return { bg: '#ecfdf5', color: '#059669' };
  if (lower.includes('yellow') || lower.includes('amber') || lower.includes('gold')) return { bg: '#fef3c7', color: '#d97706' };
  if (lower.includes('purple') || lower.includes('violet')) return { bg: '#f3e8ff', color: '#7c3aed' };
  if (lower.includes('black') || lower.includes('charcoal')) return { bg: '#1e293b', color: '#f8fafc' };
  if (lower.includes('grey') || lower.includes('gray')) return { bg: '#f1f5f9', color: '#475569' };
  if (lower.includes('orange') || lower.includes('coral')) return { bg: '#ffedd5', color: '#ea580c' };

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

export default function ThreadPurchaseNoGST() {
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [cottonItems, setCottonItems] = useState(DEFAULT_COTTON_ITEMS);
  const [availableVarieties, setAvailableVarieties] = useState(AVAILABLE_COTTON_OPTIONS);
  const [selectedVarietyToAdd, setSelectedVarietyToAdd] = useState('');
  const [isCottonDropdownOpen, setIsCottonDropdownOpen] = useState(false);
  const [showAddVariety, setShowAddVariety] = useState(false);
  const [newVarietyName, setNewVarietyName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('All Suppliers');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Sorting State for S.No, Due Date, and Amount
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

  const loadData = async (notifyOverdue = true) => {
    const data = await storageService.fetchLiveCollection('threadNoGST');
    const cleaned = cleanAccidentalDuplicates(data || []);
    setItems(cleaned);

    if (notifyOverdue) {
      const overdues = cleaned.filter(x => isOverdue(x));
      if (overdues.length > 0) {
        showToast(`⚠️ Payment Alert: ${overdues.length} purchase(s) have crossed their 45-day due date!`, 'error');
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

  const handleCottonItemChange = (index, field, value) => {
    setCottonItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSelectVariety = (varietyName) => {
    if (!varietyName) return;
    setCottonItems(prev => {
      if (prev.some(it => it.name.toLowerCase() === varietyName.toLowerCase())) {
        return prev;
      }
      return [
        ...prev,
        {
          id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: varietyName,
          qty: '',
          rate: '',
          unit: formData.unit || 'Kg'
        }
      ];
    });
    setSelectedVarietyToAdd('');
    setIsCottonDropdownOpen(true);
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

    setCottonItems(prev => {
      if (prev.some(it => it.name.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      return [
        ...prev,
        {
          id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: trimmed,
          qty: '',
          rate: '',
          unit: formData.unit || 'Kg'
        }
      ];
    });

    setNewVarietyName('');
    setShowAddVariety(false);
    setIsCottonDropdownOpen(true);
  };

  const handleRemoveCottonItem = (index) => {
    setCottonItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Live Auto-Calculations based on Cotton Items
  const totalQty = useMemo(() => {
    return cottonItems.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
  }, [cottonItems]);

  const subtotal = useMemo(() => {
    return cottonItems.reduce((acc, it) => acc + ((Number(it.qty) || 0) * (Number(it.rate) || 0)), 0);
  }, [cottonItems]);

  const avgRate = totalQty > 0 ? Math.round((subtotal / totalQty) * 100) / 100 : 0;
  const activeCottonItemsCount = useMemo(() => {
    return cottonItems.filter(it => (Number(it.qty) > 0 || Number(it.rate) > 0)).length;
  }, [cottonItems]);

  const totalAmount = subtotal;

  const currentPaid = formData.paidAmount !== '' && formData.paidAmount !== undefined
    ? Number(formData.paidAmount)
    : 0;
  const currentBalance = Math.max(0, totalAmount - currentPaid);
  const autoStatus = totalAmount > 0 && currentBalance === 0 ? 'Paid' : 'Pending';

  // KPI Metrics (dynamically calculated based on total & balance)
  const metrics = useMemo(() => {
    const totalCost = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const totalQty = items.reduce((acc, curr) => acc + (Number(curr.qty) || 0), 0);
    const uniqueSuppliers = new Set(items.map(x => x.supplier)).size;
    const paidCount = items.filter(x => getPaymentStatus(x) === 'Paid').length;
    const pendingCount = items.filter(x => getPaymentStatus(x) === 'Pending').length;
    const overdueItems = items.filter(x => isOverdue(x));
    const overdueCount = overdueItems.length;
    const overdueBalance = overdueItems.reduce((acc, curr) => {
      const total = Number(curr.total || 0);
      const paid = curr.paidAmount !== undefined && curr.paidAmount !== null && curr.paidAmount !== ''
        ? Number(curr.paidAmount)
        : 0;
      return acc + Math.max(0, total - paid);
    }, 0);

    return {
      totalCost,
      totalQty,
      totalRecords: items.length,
      totalSuppliers: uniqueSuppliers,
      paidCount,
      pendingCount,
      overdueCount,
      overdueBalance
    };
  }, [items]);

  // Dynamic unique list of all suppliers actually present in user data
  const supplierOptions = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      const name = item.supplier?.trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Filtered & Paginated items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.invoiceNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.supplier?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.threadType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.notes?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSupplier =
        supplierFilter === 'All Suppliers' ||
        item.supplier?.trim().toLowerCase() === supplierFilter.trim().toLowerCase();

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

  // Sort items by S.No, Due Date, or Amount
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.supplier) {
      showToast('Please enter the supplier name.', 'error');
      return;
    }

    const activeItems = cottonItems.filter(it => (Number(it.qty) > 0 || Number(it.rate) > 0) && String(it.name || '').trim());
    if (activeItems.length === 0) {
      showToast('Please enter quantity and rate for at least one cotton variety.', 'error');
      setIsCottonDropdownOpen(true);
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
    const threadTypeName = activeItems.map(it => it.name).join(', ');

    const payload = {
      ...formData,
      dueDate: effectiveDueDate,
      threadType: threadTypeName,
      qty: totalQty,
      rate: avgRate,
      unit: formData.unit || 'Kg',
      subtotal,
      total: totalAmount,
      paidAmount: effectivePaid,
      balanceAmount: effectiveBalance,
      status: effectiveStatus,
      paidAt,
      items: activeItems.map(it => ({
        id: it.id,
        name: it.name,
        cottonType: it.name,
        threadType: it.name,
        qty: Number(it.qty) || 0,
        rate: Number(it.rate) || 0,
        unit: formData.unit || it.unit || 'Kg',
        subtotal: (Number(it.qty) || 0) * (Number(it.rate) || 0)
      })),
      invoiceNo: formData.invoiceNo || `INV-0036-${String(Math.floor(100 + Math.random() * 900))}`
    };

    if (editingId) {
      await storageService.updateItem('threadNoGST', editingId, payload);
      showToast('Purchase record updated successfully.');
      setEditingId(null);
    } else {
      await storageService.addItem('threadNoGST', payload);
      showToast('New thread purchase (without GST) added.');
    }

    setIsModalOpen(false);
    setFormData(INITIAL_FORM);
    setCottonItems(DEFAULT_COTTON_ITEMS);
    setIsCottonDropdownOpen(false);
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
    const total = Number(item.total || 0);
    const paid = item.paidAmount !== undefined && item.paidAmount !== null && item.paidAmount !== ''
      ? item.paidAmount
      : (getPaymentStatus(item) === 'Paid' ? total : 0);

    const itemDate = item.date ? (String(item.date).includes('T') ? item.date.split('T')[0] : item.date) : defaultToday;
    const itemDueDate = getItemDueDate(item);

    setFormData({
      date: itemDate,
      dueDate: itemDueDate,
      supplier: item.supplier || '',
      threadType: item.threadType || '',
      qty: item.qty || '',
      unit: item.unit || 'Kg',
      rate: item.rate || '',
      invoiceNo: item.invoiceNo || '',
      paidAmount: paid,
      notes: item.notes || ''
    });

    if (Array.isArray(item.items) && item.items.length > 0) {
      setCottonItems(item.items.map((x, i) => ({
        id: x.id || `c_${i}_${Date.now()}`,
        name: x.name || x.cottonType || x.threadType || `Variety ${i + 1}`,
        qty: x.qty !== undefined && x.qty !== null ? x.qty : '',
        rate: x.rate !== undefined && x.rate !== null ? x.rate : '',
        unit: x.unit || item.unit || 'Kg'
      })));
    } else if (item.threadType) {
      setCottonItems([{
        id: 'c_legacy',
        name: item.threadType,
        qty: item.qty || '',
        rate: item.rate || '',
        unit: item.unit || 'Kg'
      }]);
    } else {
      setCottonItems(DEFAULT_COTTON_ITEMS);
    }

    setShowAddVariety(false);
    setNewVarietyName('');
    setIsCottonDropdownOpen(false);
    setIsModalOpen(true);
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

      await storageService.deleteItem('threadNoGST', deletingId);
      showToast('Record deleted successfully.', 'success');
      setDeletingId(null);
      await loadData(false);
    }
  };

  // Columns for Purchase History (Invoice number and thread type are hidden here and shown on View)
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
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (val) => formatDate(val)
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      sortable: true,
      render: (val, row) => {
        const effectiveDue = getItemDueDate(row);
        const overdue = isOverdue(row);
        const days = getDaysOverdue(row);
        const status = getPaymentStatus(row);
        const termDays = (() => {
          if (row.date && effectiveDue) {
            const d1 = new Date(String(row.date).split('T')[0]);
            const d2 = new Date(String(effectiveDue).split('T')[0]);
            const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
            if (diff > 0) return `${diff}d terms`;
          }
          return '45d terms';
        })();

        return (
          <div className={overdue ? 'overdue-date-box' : undefined} style={!overdue ? { display: 'flex', flexDirection: 'column', gap: '3px' } : undefined}>
            <span style={{
              fontWeight: overdue ? 700 : 500,
              color: overdue ? '#dc2626' : 'var(--text-main)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {overdue && <AlertTriangle size={12} color="#dc2626" />}
              {formatDate(effectiveDue)}
            </span>
            {overdue && (
              <span className="overdue-tag">
                Overdue ({days}d)
              </span>
            )}
            {!overdue && status === 'Pending' && (
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                {termDays}
              </span>
            )}
          </div>
        );
      }
    },
    { key: 'supplier', header: 'Supplier' },
    { key: 'qty', header: 'Qty', render: (val, row) => `${val} ${row.unit || 'Kg'}` },
    { key: 'rate', header: 'Rate (₹)', render: (val) => `₹ ${val}` },
    {
      key: 'total',
      header: 'Amount',
      sortable: true,
      render: (val) => <strong style={{ color: 'var(--primary-600)' }}>{formatINR(val)}</strong>
    },
    {
      key: 'paidAmount',
      header: 'Paid',
      render: (val, row) => {
        const total = Number(row.total || 0);
        const paid = val !== undefined && val !== null && val !== ''
          ? Number(val)
          : (row.status === 'Paid' ? total : 0);
        return <span style={{ color: '#059669', fontWeight: 600 }}>{formatINR(paid)}</span>;
      }
    },
    {
      key: 'balanceAmount',
      header: 'Balance',
      render: (val, row) => {
        const total = Number(row.total || 0);
        const paid = row.paidAmount !== undefined && row.paidAmount !== null && row.paidAmount !== ''
          ? Number(row.paidAmount)
          : (row.status === 'Paid' ? total : 0);
        const balance = Math.max(0, total - paid);
        return (
          <span style={{ color: balance > 0 ? '#d97706' : '#64748b', fontWeight: balance > 0 ? 600 : 500 }}>
            {formatINR(balance)}
          </span>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      render: (val, row) => {
        const status = isOverdue(row) ? 'Overdue' : getPaymentStatus(row);
        const locked = isPaidLocked(row);
        return <StatusBadge status={status} isLocked={locked} />;
      }
    }
  ];

  const handleExportCSV = () => {
    storageService.exportToCSV('Thread_Purchases_Without_GST', sortedItems, columns);
    showToast('Exported Excel file successfully.');
  };

  const handleExportPDF = () => {
    storageService.exportToPDF('Thread_Purchases_Without_GST', sortedItems, columns);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Thread Purchase (Without GST)</h2>
          <p className="page-subtitle">Manage thread purchases without GST for your manufacturing unit</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingId(null);
              setFormData(INITIAL_FORM);
              setCottonItems(DEFAULT_COTTON_ITEMS);
              setShowAddVariety(false);
              setNewVarietyName('');
              setIsCottonDropdownOpen(false);
              setIsModalOpen(true);
            }}
          >
            <Plus size={16} /> Add Thread Purchase
          </button>
        </div>
      </div>

      {/* Overdue Notification Banner */}
      {metrics.overdueCount > 0 && (
        <div className="overdue-notification-banner">
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
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
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
        <MetricCard
          title="Total Quantity"
          value={`${metrics.totalQty.toLocaleString('en-IN')} Kg`}
          trend="Live"
          trendType="neutral"
          icon={Layers}
          iconBg="#eff6ff"
          iconColor="#2563eb"
        />
        <MetricCard
          title="Total Records"
          value={metrics.totalRecords}
          trend="Live"
          trendType="neutral"
          icon={Package}
          iconBg="#f5f3ff"
          iconColor="#7c3aed"
        />
        <MetricCard
          title="Total Suppliers"
          value={metrics.totalSuppliers}
          trend="Live"
          trendType="neutral"
          icon={Users}
          iconBg="#fffbeb"
          iconColor="#d97706"
        />
      </div>

      {/* Modal Dialog Box for Add & Edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setIsCottonDropdownOpen(false);
          setShowAddVariety(false);
          setNewVarietyName('');
          setEditingId(null);
        }}
        title={editingId ? 'Edit Thread Purchase (Without GST)' : 'Add Thread Purchase (Without GST)'}
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
              <label className="form-label">Supplier Name <span className="required">*</span></label>
              <input
                type="text"
                list="nogst-supplier-list"
                className="form-control"
                placeholder="Enter supplier name"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                required
              />
              <datalist id="nogst-supplier-list">
                {supplierOptions.map((sup) => (
                  <option key={sup} value={sup} />
                ))}
              </datalist>
            </div>

            <div className="form-group">
              <label className="form-label">Unit <span className="required">*</span></label>
              <select
                className="form-control"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              >
                <option value="Kg">Kg</option>
                <option value="Bags">Bags</option>
                <option value="Cones">Cones</option>
              </select>
            </div>

            {/* Cotton Rate Details as Dropdown */}
            <div className="form-group col-span-full" style={{ marginTop: '0.4rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>
                  Cotton Rate Details <span className="required">*</span>
                </label>
                {activeCottonItemsCount > 0 && (
                  <span style={{
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    color: '#0369a1',
                    backgroundColor: '#e0f2fe',
                    padding: '2px 8px',
                    borderRadius: '12px'
                  }}>
                    {activeCottonItemsCount} active {activeCottonItemsCount === 1 ? 'variety' : 'varieties'} • {totalQty} {formData.unit || 'Kg'} • {formatINR(subtotal)}
                  </span>
                )}
              </div>

              {/* Dropdown Box trigger - click to open/close */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setIsCottonDropdownOpen(prev => !prev)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsCottonDropdownOpen(prev => !prev);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1.15rem',
                  backgroundColor: isCottonDropdownOpen ? '#f8fafc' : '#ffffff',
                  border: isCottonDropdownOpen ? '1.5px solid var(--primary-600, #2563eb)' : '1px solid #cbd5e1',
                  borderRadius: isCottonDropdownOpen ? '12px 12px 0 0' : '12px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.15s ease',
                  boxShadow: isCottonDropdownOpen ? '0 2px 4px rgba(37,99,235,0.08)' : '0 1px 2px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '9px',
                    backgroundColor: activeCottonItemsCount > 0 ? '#eff6ff' : '#f1f5f9',
                    color: activeCottonItemsCount > 0 ? 'var(--primary-600, #2563eb)' : '#64748b',
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
                        {activeCottonItemsCount > 0
                          ? `${activeCottonItemsCount} Cotton ${activeCottonItemsCount === 1 ? 'Variety' : 'Varieties'} Configured`
                          : 'Select / Enter Cotton Rate Details'}
                      </span>
                      {activeCottonItemsCount > 0 && (
                        <span style={{ fontSize: '0.85rem', color: 'var(--primary-600, #2563eb)', fontWeight: 700 }}>
                          ({formatINR(subtotal)})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isCottonDropdownOpen
                        ? 'Click to collapse rate details'
                        : (activeCottonItemsCount > 0
                            ? cottonItems
                                .filter(it => Number(it.qty) > 0 || Number(it.rate) > 0)
                                .map(it => `${it.name}: ${it.qty} ${formData.unit || 'Kg'} @ ₹${it.rate}`)
                                .join(' • ')
                            : (cottonItems.length > 0
                                ? cottonItems.map(it => it.name).join(' • ')
                                : 'Click this dropdown to select varieties (Red, Green, White...)'))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: isCottonDropdownOpen ? 'var(--primary-600, #2563eb)' : '#64748b'
                  }}>
                    {isCottonDropdownOpen ? 'Hide Details' : 'Show Details'}
                  </span>
                  <ChevronDown
                    size={18}
                    style={{
                      color: isCottonDropdownOpen ? 'var(--primary-600, #2563eb)' : '#64748b',
                      transform: isCottonDropdownOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                </div>
              </div>

              {/* Dropdown Content - NOT shown on screen until the dropdown box is clicked */}
              {isCottonDropdownOpen && (
                <div style={{
                  border: '1.5px solid var(--primary-600, #2563eb)',
                  borderTop: 'none',
                  borderRadius: '0 0 12px 12px',
                  padding: '1.25rem',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}>
                  {/* Extra Dropdown: Select Cotton Variety / Color */}
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
                        Select Cotton Variety / Color to Add:
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
                        <option value="">-- Choose Cotton Variety (e.g. Red, Green, White...) --</option>
                        {availableVarieties.map((v) => {
                          const isAlreadyAdded = cottonItems.some(it => it.name.toLowerCase() === v.toLowerCase());
                          return (
                            <option key={v} value={v} disabled={isAlreadyAdded}>
                              {v} {isAlreadyAdded ? '✓ (Already on screen)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Cotton Varieties List - only show selected ones, NO default data */}
                  {cottonItems.length === 0 ? (
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
                        No Cotton Varieties Selected Yet
                      </div>
                      <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                        Choose a variety from the dropdown above (e.g. <strong>Red Cotton</strong>, <strong>Green Cotton</strong>) to enter quantity & rate, or click <strong>Add Cotton Variety (+)</strong>.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {cottonItems.map((item, idx) => {
                        const badge = getVarietyBadgeStyle(item.name, idx);
                        return (
                          <div
                            key={item.id || idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.75rem 0.5rem',
                              borderBottom: idx < cottonItems.length - 1 ? '1px solid #f1f5f9' : 'none',
                              flexWrap: 'wrap',
                              gap: '1rem'
                            }}
                          >
                            {/* Left: Icon Badge & Name / Subtitle */}
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
                                  Quantity and rate per unit ({formData.unit || 'Kg'})
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
                                  Qty ({formData.unit || 'Kg'})
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={item.qty}
                                  onChange={(e) => handleCottonItemChange(idx, 'qty', e.target.value)}
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
                                  onChange={(e) => handleCottonItemChange(idx, 'rate', e.target.value)}
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

                              {/* Delete / Remove Action - can remove any item */}
                              <button
                                type="button"
                                onClick={() => handleRemoveCottonItem(idx)}
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
                      Active Varieties: <strong>{activeCottonItemsCount}</strong> | Total Quantity:{' '}
                      <strong style={{ color: '#0f172a' }}>{totalQty} {formData.unit || 'Kg'}</strong>
                    </span>
                    <span style={{ color: '#0f172a', fontWeight: 600 }}>
                      Cotton Subtotal:{' '}
                      <strong style={{ color: 'var(--primary-600)', fontSize: '0.95rem' }}>
                        {formatINR(subtotal)}
                      </strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Under the drop down add customized button to add cotton variety */}
              <div style={{ marginTop: '0.65rem' }}>
                {!showAddVariety ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCottonDropdownOpen(true);
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
                    <span>Add Cotton Variety (+)</span>
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
                      list="cotton-variety-list-nogst"
                      className="form-control"
                      placeholder="Enter cotton variety name (e.g. Green Cotton, Grey Melange, 40s Combed)..."
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
                    <datalist id="cotton-variety-list-nogst">
                      <option value="White Cotton" />
                      <option value="Red Cotton" />
                      <option value="Blue Cotton" />
                      <option value="Green Cotton" />
                      <option value="Yellow Cotton" />
                      <option value="Grey Melange" />
                      <option value="40s Combed" />
                      <option value="Organic Cotton" />
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
                placeholder="Enter amount paid"
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
              <label className="form-label">Invoice / Ref Number</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. INV-0036-078"
                value={formData.invoiceNo}
                onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Payment Status <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Automatic)</span></label>
              <div style={{ display: 'flex', alignItems: 'center', height: '38px', gap: '0.6rem' }}>
                <StatusBadge status={autoStatus} />
                <span style={{ fontSize: '0.75rem', color: autoStatus === 'Paid' ? '#059669' : '#d97706', fontWeight: 600 }}>
                  {autoStatus === 'Paid' ? 'Paid in Full' : `Pending (Balance ₹ ${formatINR(currentBalance)})`}
                </span>
              </div>
            </div>

            <div className="form-group col-span-full">
              <label className="form-label">Notes</label>
              <input
                type="text"
                className="form-control"
                placeholder="Enter notes..."
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
                setCottonItems(DEFAULT_COTTON_ITEMS);
                setIsCottonDropdownOpen(false);
                setShowAddVariety(false);
                setNewVarietyName('');
                setEditingId(null);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Update Purchase' : 'Save Purchase'}
            </button>
          </div>
        </form>
      </Modal>

      {/* History Table with Search, Filter & Actions */}
      <div className="erp-card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="card-title-group" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <FileText size={18} color="var(--primary-600)" />
            <h3 className="card-title">Purchase History</h3>
            {statusFilter !== 'All' && (
              <span
                onClick={() => setStatusFilter('All')}
                style={{
                  fontSize: '0.725rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '9999px',
                  backgroundColor: statusFilter === 'Paid' ? '#dcfce7' : statusFilter === 'Overdue' ? '#fee2e2' : '#ffedd5',
                  color: statusFilter === 'Paid' ? '#166534' : statusFilter === 'Overdue' ? '#991b1b' : '#9a3412',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
                title="Click to clear status filter"
              >
                Showing {statusFilter} ✕
              </span>
            )}
            {supplierFilter !== 'All Suppliers' && (
              <span
                onClick={() => setSupplierFilter('All Suppliers')}
                style={{
                  fontSize: '0.725rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '9999px',
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
                title="Click to clear supplier filter"
              >
                Supplier: {supplierFilter} ✕
              </span>
            )}
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
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditingId(null);
                setFormData(INITIAL_FORM);
                setIsModalOpen(true);
              }}
            >
              <Plus size={14} /> Add Purchase
            </button>
            <div className="search-box" style={{ width: '200px', height: '34px' }}>
              <Search size={14} />
              <input
                type="text"
                placeholder="Search records..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <select
              className="form-control"
              style={{ width: '150px', height: '34px', fontSize: '0.78rem' }}
              value={supplierFilter}
              onChange={(e) => {
                setSupplierFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All Suppliers">All Suppliers ({items.length})</option>
              {supplierOptions.map((sup) => (
                <option key={sup} value={sup}>
                  {sup}
                </option>
              ))}
            </select>

            <select
              className="form-control"
              style={{ width: '135px', height: '34px', fontSize: '0.78rem' }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue ({metrics.overdueCount})</option>
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

            <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
              <Download size={14} /> Export Excel
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportPDF}>
              <Printer size={14} /> Export PDF
            </button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={paginatedItems}
          onView={(row) => setViewingItem(row)}
          onEdit={(row) => handleEdit(row)}
          onDelete={(row) => setDeletingId(row._id || row.id)}
          page={page}
          totalPages={totalPages}
          totalItems={sortedItems.length}
          itemsPerPage={itemsPerPage}
          onPageChange={(newPage) => setPage(newPage)}
          onItemsPerPageChange={(newSize) => {
            setItemsPerPage(newSize);
            setPage(1);
          }}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
        />
      </div>

      {/* View Details Modal */}
      <Modal isOpen={!!viewingItem} onClose={() => setViewingItem(null)} title="Non-GST Thread Purchase Details" maxWidth="1120px">
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
                <div><strong style={{ color: 'var(--text-muted)' }}>Invoice No:</strong> {viewingItem.invoiceNo}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Date:</strong> {formatDate(viewingItem.date)}</div>
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
                <div><strong style={{ color: 'var(--text-muted)' }}>Supplier:</strong> {viewingItem.supplier}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Thread Type:</strong> {viewingItem.threadType}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Quantity:</strong> {viewingItem.qty} {viewingItem.unit || 'Kg'}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Rate per Unit:</strong> ₹ {viewingItem.rate}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Total Amount:</strong> <strong style={{ color: 'var(--primary-600)' }}>{formatINR(viewingItem.total)}</strong></div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Amount Paid:</strong> <strong style={{ color: '#059669' }}>{formatINR(vPaid)}</strong></div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Balance Amount:</strong> <strong style={{ color: vBalance > 0 ? '#d97706' : '#64748b' }}>{formatINR(vBalance)}</strong></div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Payment Status:</strong> <StatusBadge status={getPaymentStatus(viewingItem)} isLocked={isPaidLocked(viewingItem)} /></div>
              </div>

              {/* Cotton Varieties Breakdown Table */}
              {Array.isArray(viewingItem.items) && viewingItem.items.length > 0 && (
                <div style={{ marginTop: '0.25rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    Cotton Varieties Breakdown ({viewingItem.items.length})
                  </h4>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px', color: 'var(--text-muted)', width: '45px' }}>#</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Cotton Variety / Name</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-muted)', textAlign: 'right' }}>Quantity</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-muted)', textAlign: 'right' }}>Rate (₹)</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-muted)', textAlign: 'right' }}>Subtotal (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingItem.items.map((it, idx) => (
                          <tr key={it.id || idx} style={{ borderBottom: idx < viewingItem.items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                            <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-main)' }}>{it.name || it.cottonType || it.threadType}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>{it.qty} {it.unit || viewingItem.unit || 'Kg'}</td>
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
                            {viewingItem.items.reduce((s, x) => s + (Number(x.qty) || 0), 0)} {viewingItem.unit || 'Kg'}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button className="btn btn-primary" onClick={() => setViewingItem(null)}>Close</button>
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
        title="Delete Thread Purchase (Without GST)"
        message="Are you sure you want to delete this non-GST thread purchase entry?"
      />
    </div>
  );
}
