import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Layers,
  Package,
  FileText,
  Plus,
  Download,
  Printer,
  Search,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  Eye,
  Edit2,
  Trash2
} from 'lucide-react';
import MetricCard from '../components/common/MetricCard';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Toast from '../components/common/Toast';
import StatusBadge from '../components/common/StatusBadge';
import DateRangePicker from '../components/common/DateRangePicker';
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
  threadType: 'Cotton',
  qty: '',
  unit: 'Kg',
  rate: '',
  gstRate: 5,
  invoiceNo: '',
  paidAmount: '',
  status: 'Paid',
  notes: ''
};

export default function ThreadPurchaseGST() {
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);

  // Search, Filter & Pagination States
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

  // Load items with auto-deduplication of accidental edit duplicates
  const loadData = async (notifyOverdue = true) => {
    const data = await storageService.fetchLiveCollection('threadGST');
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

  // Live Auto-Calculations
  const subtotal = (Number(formData.qty) || 0) * (Number(formData.rate) || 0);
  const gstAmount = (subtotal * (Number(formData.gstRate) || 0)) / 100;
  const totalAmount = subtotal + gstAmount;

  const currentPaid = formData.paidAmount !== '' && formData.paidAmount !== undefined
    ? Number(formData.paidAmount)
    : 0;
  const currentBalance = Math.max(0, totalAmount - currentPaid);
  const autoStatus = totalAmount > 0 && currentBalance === 0 ? 'Paid' : 'Pending';

  // KPI Metrics with Paid, Pending, and Overdue Counts
  const metrics = useMemo(() => {
    const totalCost = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const totalGST = items.reduce((acc, curr) => acc + (curr.gstAmount || 0), 0);
    const totalQty = items.reduce((acc, curr) => acc + (Number(curr.qty) || 0), 0);
    const paidCount = items.filter(curr => getPaymentStatus(curr) === 'Paid').length;
    const pendingCount = items.filter(curr => getPaymentStatus(curr) === 'Pending').length;
    const overdueItems = items.filter(curr => isOverdue(curr));
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
      totalGST,
      totalQty,
      totalRecords: items.length,
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

  // Form Submit (Create / Update)
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.supplier || !formData.threadType || !formData.qty || !formData.rate) {
      showToast('Please fill all required fields.', 'error');
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

    const payload = {
      ...formData,
      dueDate: effectiveDueDate,
      qty: Number(formData.qty),
      rate: Number(formData.rate),
      gstRate: Number(formData.gstRate),
      subtotal,
      gstAmount,
      total: totalAmount,
      paidAmount: effectivePaid,
      balanceAmount: effectiveBalance,
      status: effectiveStatus,
      paidAt,
      invoiceNo: formData.invoiceNo || `INV-0036-${String(Math.floor(100 + Math.random() * 900))}`
    };

    if (editingId) {
      await storageService.updateItem('threadGST', editingId, payload);
      showToast('Purchase record updated successfully.');
      setEditingId(null);
    } else {
      await storageService.addItem('threadGST', payload);
      showToast('New thread purchase added successfully.');
    }

    setIsModalOpen(false);
    setFormData(INITIAL_FORM);
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
      threadType: item.threadType || 'Cotton',
      qty: item.qty || '',
      unit: item.unit || 'Kg',
      rate: item.rate || '',
      gstRate: item.gstRate || 5,
      invoiceNo: item.invoiceNo || '',
      paidAmount: paid,
      notes: item.notes || ''
    });
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

      await storageService.deleteItem('threadGST', deletingId);
      showToast('Purchase record deleted.', 'success');
      setDeletingId(null);
      await loadData(false);
    }
  };

  // Columns for Purchase History (Invoice number, thread type, subtotal, gst, gst% are hidden here and shown on View)
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
    storageService.exportToCSV('Thread_Purchases_With_GST', sortedItems, columns);
    showToast('Exported Excel file successfully.');
  };

  const handleExportPDF = () => {
    storageService.exportToPDF('Thread_Purchases_With_GST', sortedItems, columns);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Thread Purchase (With GST)</h2>
          <p className="page-subtitle">Manage thread purchases with GST for your manufacturing unit</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingId(null);
              setFormData(INITIAL_FORM);
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
                Total overdue balance: <strong>{formatINR(metrics.overdueBalance)}</strong>. Prompt payment settlement is advised.
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
          title="Total GST"
          value={formatINR(metrics.totalGST)}
          trend="Live"
          trendType="neutral"
          icon={FileText}
          iconBg="#eff6ff"
          iconColor="#2563eb"
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
          iconBg="#f5f3ff"
          iconColor="#7c3aed"
        />
        <MetricCard
          title="Total Records"
          value={metrics.totalRecords}
          trend="Live"
          trendType="neutral"
          icon={Package}
          iconBg="#fee2e2"
          iconColor="#dc2626"
        />
      </div>

      {/* Modal Dialog Box for Add & Edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingId(null);
        }}
        title={editingId ? 'Edit Thread Purchase (With GST)' : 'Add Thread Purchase (With GST)'}
        maxWidth="940px"
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
                list="gst-supplier-list"
                className="form-control"
                placeholder="Enter supplier name"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                required
              />
              <datalist id="gst-supplier-list">
                {supplierOptions.map((sup) => (
                  <option key={sup} value={sup} />
                ))}
              </datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Thread Type <span className="required">*</span></label>
              <select
                className="form-control"
                value={formData.threadType}
                onChange={(e) => setFormData({ ...formData, threadType: e.target.value })}
                required
              >
                <option value="Cotton">Cotton</option>
                <option value="Polyester">Polyester</option>
                <option value="Nylon">Nylon</option>
                <option value="Viscose">Viscose</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity <span className="required">*</span></label>
              <input
                type="number"
                min="1"
                className="form-control"
                placeholder="Enter quantity"
                value={formData.qty}
                onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                required
              />
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
            <div className="form-group">
              <label className="form-label">Rate per Unit (₹) <span className="required">*</span></label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                placeholder="Enter rate"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Subtotal (₹)</label>
              <input
                type="text"
                className="form-control"
                readOnly
                value={formatINR(subtotal)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">GST % <span className="required">*</span></label>
              <select
                className="form-control"
                value={formData.gstRate}
                onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
              >
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">GST Amount (₹)</label>
              <input
                type="text"
                className="form-control"
                readOnly
                value={formatINR(gstAmount)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Total Amount (₹)</label>
              <input
                type="text"
                className="form-control"
                readOnly
                style={{ fontWeight: 700, color: 'var(--primary-600)' }}
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
              <label className="form-label">Invoice Number</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. INV-0036-014"
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
              <textarea
                className="form-control"
                placeholder="Enter additional purchase notes..."
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

          {/* Table Controls */}
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
                placeholder="Search invoice, supplier..."
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
      <Modal isOpen={!!viewingItem} onClose={() => setViewingItem(null)} title="Thread Purchase Details" maxWidth="780px">
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
                <div><strong style={{ color: 'var(--text-muted)' }}>Supplier:</strong> {viewingItem.supplier}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Thread Type:</strong> {viewingItem.threadType}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Quantity:</strong> {viewingItem.qty} {viewingItem.unit || 'Kg'}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Rate per Unit:</strong> ₹ {viewingItem.rate}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Subtotal:</strong> {formatINR(viewingItem.subtotal)}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>GST ({viewingItem.gstRate || 5}%):</strong> {formatINR(viewingItem.gstAmount)}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Total Amount:</strong> <strong style={{ color: 'var(--primary-600)' }}>{formatINR(viewingItem.total)}</strong></div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Amount Paid:</strong> <strong style={{ color: '#059669' }}>{formatINR(vPaid)}</strong></div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Balance Amount:</strong> <strong style={{ color: vBalance > 0 ? '#d97706' : '#64748b' }}>{formatINR(vBalance)}</strong></div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Payment Status:</strong> <StatusBadge status={getPaymentStatus(viewingItem)} isLocked={isPaidLocked(viewingItem)} /></div>
              </div>
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
        title="Delete Thread Purchase Record"
        message="Are you sure you want to delete this thread purchase entry? This will update your calculated metrics."
      />
    </div>
  );
}
