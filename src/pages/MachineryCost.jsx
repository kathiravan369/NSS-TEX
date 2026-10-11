import React, { useState, useEffect, useMemo } from 'react';
import {
  Cpu,
  Wrench,
  Hammer,
  FileSpreadsheet,
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
  Trash2
} from 'lucide-react';
import MetricCard from '../components/common/MetricCard';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Toast from '../components/common/Toast';
import StatusBadge from '../components/common/StatusBadge';
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
  machine: 'Loom Machine',
  machineId: '',
  category: 'Maintenance',
  desc: '',
  qty: 1,
  unit: 'Nos',
  cost: '',
  includeGST: true,
  gstRate: 18,
  vendor: '',
  paidAmount: '',
  status: 'Paid',
  notes: ''
};

export default function MachineryCost() {
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [machineFilter, setMachineFilter] = useState('All Machines');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const itemsPerPage = 6;

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const loadData = async (notifyOverdue = true) => {
    let list = [];
    try {
      const data = await storageService.fetchLiveCollection('machinery');
      list = cleanAccidentalDuplicates(data || []);
    } catch {
      const data = storageService.getCollection('machinery');
      list = cleanAccidentalDuplicates(data || []);
    }
    setItems(list);

    if (notifyOverdue) {
      const overdues = list.filter(x => isOverdue(x));
      if (overdues.length > 0) {
        showToast(`⚠️ Payment Alert: ${overdues.length} machinery expense(s) have crossed their 45-day due date!`, 'error');
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

  // Calculations
  const subtotal = (Number(formData.qty) || 0) * (Number(formData.cost) || 0);
  const gstAmount = formData.includeGST ? (subtotal * (Number(formData.gstRate) || 0)) / 100 : 0;
  const totalExpense = subtotal + gstAmount;

  const currentPaid = formData.paidAmount !== '' && formData.paidAmount !== undefined
    ? Number(formData.paidAmount)
    : 0;
  const currentBalance = Math.max(0, totalExpense - currentPaid);
  const autoStatus = totalExpense > 0 && currentBalance === 0 ? 'Paid' : 'Pending';

  // KPI Metrics with Paid, Pending, and Overdue Counts
  const metrics = useMemo(() => {
    const totalCost = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const maintenance = items.filter(x => x.category === 'Maintenance').reduce((acc, curr) => acc + (curr.total || 0), 0);
    const repairs = items.filter(x => x.category === 'Repair').reduce((acc, curr) => acc + (curr.total || 0), 0);
    const other = items.filter(x => x.category !== 'Maintenance' && x.category !== 'Repair').reduce((acc, curr) => acc + (curr.total || 0), 0);
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
      maintenance,
      repairs,
      other,
      totalRecords: items.length,
      paidCount,
      pendingCount,
      overdueCount,
      overdueBalance
    };
  }, [items]);

  // Dynamic unique list of machines and categories from actual user data
  const machineOptions = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      const name = item.machine?.trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const categoryOptions = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      const name = item.category?.trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Filtered & Paginated
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.machine?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.machineId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.desc?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.vendor?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesMachine =
        machineFilter === 'All Machines' ||
        item.machine?.trim().toLowerCase() === machineFilter.trim().toLowerCase();

      const matchesCategory =
        categoryFilter === 'All Categories' ||
        item.category?.trim().toLowerCase() === categoryFilter.trim().toLowerCase();

      const itemStatus = getPaymentStatus(item);
      const matchesStatus =
        statusFilter === 'All'
          ? true
          : statusFilter === 'Overdue'
          ? isOverdue(item)
          : itemStatus === statusFilter;

      return matchesSearch && matchesMachine && matchesCategory && matchesStatus;
    });
  }, [items, searchQuery, machineFilter, categoryFilter, statusFilter]);

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
      } else if (sortField === 'total' || sortField === 'amount' || sortField === 'cost') {
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

    if (!formData.machine || !formData.category || !formData.desc || !formData.cost || !formData.vendor) {
      showToast('Please fill all required fields.', 'error');
      return;
    }

    const effectivePaid = formData.paidAmount !== '' && formData.paidAmount !== undefined
      ? Number(formData.paidAmount)
      : 0;
    const effectiveBalance = Math.max(0, totalExpense - effectivePaid);
    const effectiveStatus = totalExpense > 0 && effectiveBalance === 0 ? 'Paid' : 'Pending';

    const existingItem = editingId ? items.find(x => (x._id || x.id) === editingId || x.id === editingId) : null;
    let paidAt = existingItem?.paidAt;
    if (effectiveStatus === 'Paid' && !paidAt) {
      paidAt = new Date().toISOString();
    } else if (effectiveStatus !== 'Paid') {
      paidAt = null;
    }

    const effectiveDueDate = formData.dueDate || calculateDefaultDueDate(formData.date, 45);

    const payload = {
      ...formData,
      dueDate: effectiveDueDate,
      qty: Number(formData.qty),
      cost: Number(formData.cost),
      gstRate: Number(formData.gstRate),
      subtotal,
      gst: gstAmount,
      total: totalExpense,
      paidAmount: effectivePaid,
      balanceAmount: effectiveBalance,
      status: effectiveStatus,
      paidAt
    };

    if (editingId) {
      await storageService.updateItem('machinery', editingId, payload);
      showToast('Machinery expense updated.');
      setEditingId(null);
    } else {
      await storageService.addItem('machinery', payload);
      showToast('New machinery expense added.');
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

    const targetId = item._id || item.id || (item.machineId ? `mach_${item.machineId}` : null);
    setEditingId(targetId);
    const total = Number(item.total || 0);
    const paid = item.paidAmount !== undefined && item.paidAmount !== null && item.paidAmount !== ''
      ? item.paidAmount
      : (getPaymentStatus(item) === 'Paid' ? total : 0);

    const itemDate = item.date ? new Date(item.date).toISOString().split('T')[0] : '';
    const itemDueDate = item.dueDate
      ? new Date(item.dueDate).toISOString().split('T')[0]
      : calculateDefaultDueDate(itemDate || defaultToday, 45);

    setFormData({
      date: itemDate,
      dueDate: itemDueDate,
      machine: item.machine || 'Loom Machine',
      machineId: item.machineId || '',
      category: item.category || 'Maintenance',
      desc: item.desc || '',
      qty: item.qty || 1,
      unit: item.unit || 'Nos',
      cost: item.cost || '',
      includeGST: item.includeGST ?? true,
      gstRate: item.gstRate || 18,
      vendor: item.vendor || '',
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

      await storageService.deleteItem('machinery', deletingId);
      showToast('Machinery expense record deleted.', 'success');
      setDeletingId(null);
      await loadData(false);
    }
  };

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
    { key: 'date', header: 'Date', sortable: true, render: (val) => formatDate(val) },
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
    { key: 'machine', header: 'Machine Name' },
    { key: 'machineId', header: 'Machine ID', render: (val) => <code style={{ color: '#64748b' }}>{val || '-'}</code> },
    {
      key: 'category',
      header: 'Category',
      render: (val) => (
        <span
          style={{
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.725rem',
            fontWeight: 600,
            background: val === 'Maintenance' ? '#dbeafe' : val === 'Repair' ? '#fee2e2' : '#f3e8ff',
            color: val === 'Maintenance' ? '#1e40af' : val === 'Repair' ? '#b91c1c' : '#7e22ce'
          }}
        >
          {val}
        </span>
      )
    },
    { key: 'desc', header: 'Description' },
    { key: 'qty', header: 'Qty', render: (val, row) => `${val} ${row.unit || 'Nos'}` },
    { key: 'total', header: 'Amount', sortable: true, render: (val) => <strong style={{ color: 'var(--primary-600)' }}>{formatINR(val)}</strong> },
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
    { key: 'vendor', header: 'Vendor' },
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
    storageService.exportToCSV('Machinery_Expense_History', sortedItems, columns);
    showToast('Exported Excel file successfully.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Machinery Cost Management</h2>
          <p className="page-subtitle">Track machinery purchase, maintenance, repair and other expenses</p>
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
            <Plus size={16} /> Add Machinery Expense
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
                Payment Overdue Alert: {metrics.overdueCount} machinery {metrics.overdueCount === 1 ? 'expense has' : 'expenses have'} crossed the 45-day due date!
              </div>
              <div style={{ fontSize: '0.82rem', color: '#be123c', marginTop: '2px' }}>
                Total overdue pending balance: <strong>{formatINR(metrics.overdueBalance)}</strong>. Prompt vendor settlement is recommended.
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
            {statusFilter === 'Overdue' ? 'Show All Expenses' : `View ${metrics.overdueCount} Overdue Expenses`}
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <MetricCard
          title="Total Machinery Cost"
          value={formatINR(metrics.totalCost)}
          trend="Live"
          trendType="neutral"
          icon={Cpu}
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
          title="Maintenance Expenses"
          value={formatINR(metrics.maintenance)}
          trend="Live"
          trendType="neutral"
          icon={Wrench}
          iconBg="#ecfdf5"
          iconColor="#059669"
        />
        <MetricCard
          title="Repair Expenses"
          value={formatINR(metrics.repairs)}
          trend="Live"
          trendType="neutral"
          icon={Hammer}
          iconBg="#fee2e2"
          iconColor="#dc2626"
        />
        <MetricCard
          title="Other Expenses"
          value={formatINR(metrics.other)}
          trend="Live"
          trendType="neutral"
          icon={FileSpreadsheet}
          iconBg="#f5f3ff"
          iconColor="#7c3aed"
        />
      </div>

      {/* Modal Dialog Box for Add & Edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingId(null);
        }}
        title={editingId ? 'Edit Machinery Expense' : 'Add Machinery Expense'}
        maxWidth="840px"
      >
        <form onSubmit={handleSubmit} style={{ width: '100%', boxSizing: 'border-box' }}>
          <div className="erp-form-grid">
            <div className="form-group">
              <label className="form-label">Expense Date <span className="required">*</span></label>
              <input
                type="date"
                className="form-control"
                value={formData.date}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setFormData({
                    ...formData,
                    date: newDate,
                    dueDate: calculateDefaultDueDate(newDate, 45)
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
                  style={{ padding: '1px 6px', fontSize: '0.68rem', backgroundColor: '#f1f5f9' }}
                  onClick={() => setFormData(p => ({ ...p, dueDate: calculateDefaultDueDate(p.date, 45) }))}
                >
                  45 Days (Default)
                </button>
                <button
                  type="button"
                  className="btn btn-xs"
                  style={{ padding: '1px 6px', fontSize: '0.68rem', backgroundColor: '#f1f5f9' }}
                  onClick={() => setFormData(p => ({ ...p, dueDate: calculateDefaultDueDate(p.date, 30) }))}
                >
                  30 Days
                </button>
                <button
                  type="button"
                  className="btn btn-xs"
                  style={{ padding: '1px 6px', fontSize: '0.68rem', backgroundColor: '#f1f5f9' }}
                  onClick={() => setFormData(p => ({ ...p, dueDate: calculateDefaultDueDate(p.date, 60) }))}
                >
                  60 Days
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Machine Name <span className="required">*</span></label>
              <select
                className="form-control"
                value={formData.machine}
                onChange={(e) => setFormData({ ...formData, machine: e.target.value })}
                required
              >
                <option value="Loom Machine">Loom Machine</option>
                <option value="Power Loom">Power Loom</option>
                <option value="Dyeing Machine">Dyeing Machine</option>
                <option value="Compressor">Compressor</option>
                <option value="Generator">Generator</option>
                <option value="Finishing Machine">Finishing Machine</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Machine ID</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. LM-001"
                value={formData.machineId}
                onChange={(e) => setFormData({ ...formData, machineId: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Expense Category <span className="required">*</span></label>
              <select
                className="form-control"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              >
                <option value="Maintenance">Maintenance</option>
                <option value="Repair">Repair</option>
                <option value="Spare Parts">Spare Parts</option>
                <option value="Purchase">Purchase</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Description <span className="required">*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Belt Replacement"
                value={formData.desc}
                onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Quantity <span className="required">*</span></label>
              <input
                type="number"
                min="1"
                className="form-control"
                placeholder="Quantity"
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
                <option value="Nos">Nos</option>
                <option value="Set">Set</option>
                <option value="Service">Service</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Cost per Unit (₹) <span className="required">*</span></label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                placeholder="Cost per unit"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                required
              />
            </div>

            <div className="form-group col-span-full" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="checkbox"
                id="machineryGstToggle"
                checked={formData.includeGST}
                onChange={(e) => setFormData({ ...formData, includeGST: e.target.checked })}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="machineryGstToggle" style={{ fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                Include GST
              </label>
            </div>

            {formData.includeGST && (
              <div className="form-group">
                <label className="form-label">GST %</label>
                <select
                  className="form-control"
                  value={formData.gstRate}
                  onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
                >
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">GST Amount (₹)</label>
              <input type="text" className="form-control" readOnly value={formatINR(gstAmount)} />
            </div>
            <div className="form-group">
              <label className="form-label">Total Expense (₹)</label>
              <input
                type="text"
                className="form-control"
                readOnly
                style={{ fontWeight: 700, color: 'var(--primary-600)' }}
                value={formatINR(totalExpense)}
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
              <label className="form-label">Vendor Name <span className="required">*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="Enter vendor / technician name"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                required
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
                setEditingId(null);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Update Expense' : 'Save Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* History Table */}
      <div className="erp-card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="card-title-group" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <FileText size={18} color="var(--primary-600)" />
            <h3 className="card-title">Machinery Expense History</h3>
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
              <Plus size={14} /> Add Expense
            </button>
            <div className="search-box" style={{ width: '190px', height: '34px' }}>
              <Search size={14} />
              <input
                type="text"
                placeholder="Search machinery..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <select
              className="form-control"
              style={{ width: '135px', height: '34px', fontSize: '0.78rem' }}
              value={machineFilter}
              onChange={(e) => {
                setMachineFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All Machines">All Machines ({items.length})</option>
              {machineOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <select
              className="form-control"
              style={{ width: '135px', height: '34px', fontSize: '0.78rem' }}
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All Categories">All Categories</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
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

            <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
              <Download size={14} /> Export Excel
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
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
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
        />
      </div>

      {/* View Details Modal */}
      <Modal isOpen={!!viewingItem} onClose={() => setViewingItem(null)} title="Machinery Expense Details">
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
                <div><strong style={{ color: 'var(--text-muted)' }}>Machine:</strong> {viewingItem.machine} ({viewingItem.machineId || 'N/A'})</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Category:</strong> {viewingItem.category}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Description:</strong> {viewingItem.desc}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Quantity:</strong> {viewingItem.qty} {viewingItem.unit || 'Nos'}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Cost per Unit:</strong> {formatINR(viewingItem.cost)}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>GST ({viewingItem.gstRate || 0}%):</strong> {formatINR(viewingItem.gst || 0)}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Total Expense:</strong> <strong style={{ color: 'var(--primary-600)' }}>{formatINR(viewingItem.total)}</strong></div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Amount Paid:</strong> <strong style={{ color: '#059669' }}>{formatINR(vPaid)}</strong></div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Balance Amount:</strong> <strong style={{ color: vBalance > 0 ? '#d97706' : '#64748b' }}>{formatINR(vBalance)}</strong></div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Vendor:</strong> {viewingItem.vendor}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Status:</strong> <StatusBadge status={getPaymentStatus(viewingItem)} isLocked={isPaidLocked(viewingItem)} /></div>
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
        title="Delete Machinery Expense"
        message="Are you sure you want to delete this machinery expense record?"
      />
    </div>
  );
}
