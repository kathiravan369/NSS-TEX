import React, { useState, useEffect, useMemo } from 'react';
import {
  Fuel,
  Droplets,
  DollarSign,
  PackageCheck,
  Plus,
  AlertTriangle,
  FileText,
  Download,
  Printer,
  Search,
  Eye,
  Edit2,
  Trash2,
  Lock,
  Clock,
  CheckCircle2,
  X
} from 'lucide-react';
import MetricCard from '../components/common/MetricCard';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Toast from '../components/common/Toast';
import StatusBadge from '../components/common/StatusBadge';
import DateRangePicker from '../components/common/DateRangePicker';
import DynamicTypeSelect from '../components/common/DynamicTypeSelect';
import { storageService } from '../services/storageService';
import {
  formatINR,
  formatDate,
  formatDateTime,
  isPaidLocked,
  getItemDueDate,
  isOverdue,
  getDaysOverdue,
  calculateDefaultDueDate,
  isDueDateCrossed,
  getPaymentStatus
} from '../utils/formatters';

const defaultToday = new Date().toISOString().split('T')[0];
const defaultDueDate = calculateDefaultDueDate(defaultToday, 45);

const INITIAL_FORM = {
  date: defaultToday,
  dueDate: defaultDueDate,
  oilType: '',
  supplier: '',
  qty: '',
  unit: 'Litre',
  rate: '',
  includeGST: true,
  invoiceNo: '',
  paidAmount: '',
  status: 'Paid',
  notes: '',
  cottonItems: []
};

export default function OilPurchase() {
  const [items, setItems] = useState([]);
  const [stockInfo, setStockInfo] = useState([]);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);

  // Search, Filter & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('All Suppliers');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Sorting state for S.No, Due Date, and Amount
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
    const purchases = await storageService.fetchLiveCollection('oil');
    const stocks = await storageService.fetchLiveCollection('oilStock');
    setItems(purchases || []);
    setStockInfo(stocks || []);

    if (notifyOverdue) {
      const overdues = (purchases || []).filter(x => isOverdue(x));
      if (overdues.length > 0) {
        showToast(`⚠️ Payment Alert: ${overdues.length} oil purchase(s) have crossed their 45-day due date!`, 'error');
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

  // Dynamic Cotton Varieties Management
  const handleAddCottonItem = () => {
    setFormData(prev => ({
      ...prev,
      cottonItems: [
        ...(prev.cottonItems || []),
        {
          id: `cotton_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: '',
          qty: '',
          unit: 'Kg',
          rate: ''
        }
      ]
    }));
  };

  const handleCottonItemChange = (index, field, value) => {
    setFormData(prev => {
      const updated = [...(prev.cottonItems || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, cottonItems: updated };
    });
  };

  const handleRemoveCottonItem = (index) => {
    setFormData(prev => {
      const updated = (prev.cottonItems || []).filter((_, idx) => idx !== index);
      return { ...prev, cottonItems: updated };
    });
  };

  // Live Auto-Calculations
  const isCotton = formData.oilType === 'Cotton';
  const totalCottonQty = isCotton
    ? (formData.cottonItems || []).reduce((acc, curr) => acc + (Number(curr.qty) || 0), 0)
    : 0;
  const cost = isCotton
    ? (formData.cottonItems || []).reduce((acc, curr) => acc + ((Number(curr.qty) || 0) * (Number(curr.rate) || 0)), 0)
    : ((Number(formData.qty) || 0) * (Number(formData.rate) || 0));
  const gstAmount = formData.includeGST ? (cost * 0.05) : 0;
  const finalAmount = cost + gstAmount;

  const currentPaid = formData.paidAmount !== '' && formData.paidAmount !== undefined
    ? Number(formData.paidAmount)
    : 0;
  const currentBalance = Math.max(0, finalAmount - currentPaid);
  const autoStatus = finalAmount > 0 && currentBalance === 0 ? 'Paid' : 'Pending';

  // KPI Metrics with Paid, Pending, and Overdue Counts
  const metrics = useMemo(() => {
    const totalPurchases = items.reduce((acc, curr) => acc + (curr.final || curr.total || curr.cost || 0), 0);
    const totalQty = items.reduce((acc, curr) => acc + (Number(curr.qty) || 0), 0);
    const totalStock = stockInfo.reduce((acc, curr) => acc + (Number(curr.stock) || 0), 0);
    const paidCount = items.filter(curr => getPaymentStatus(curr) === 'Paid').length;
    const pendingCount = items.filter(curr => getPaymentStatus(curr) === 'Pending').length;
    const overdueItems = items.filter(curr => isOverdue(curr));
    const overdueCount = overdueItems.length;
    const overdueBalance = overdueItems.reduce((acc, curr) => {
      const total = Number(curr.final || curr.total || curr.cost || 0);
      const paid = curr.paidAmount !== undefined && curr.paidAmount !== null && curr.paidAmount !== ''
        ? Number(curr.paidAmount)
        : 0;
      return acc + Math.max(0, total - paid);
    }, 0);

    return {
      totalPurchases,
      totalQty,
      totalStock,
      totalRecords: items.length,
      paidCount,
      pendingCount,
      overdueCount,
      overdueBalance
    };
  }, [items, stockInfo]);

  // Dynamic list of suppliers from user data
  const supplierOptions = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      const name = item.supplier?.trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Dynamic list of oil / material types from items
  const oilTypeOptions = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      const name = item.oilType?.trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.invoiceNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.oilType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.supplier?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.notes?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType =
        typeFilter === 'All Types' || item.oilType === typeFilter;

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

      return matchesSearch && matchesType && matchesSupplier && matchesStatus && matchesDate;
    });
  }, [items, searchQuery, typeFilter, supplierFilter, statusFilter, startDate, endDate]);

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
      } else if (sortField === 'final' || sortField === 'total' || sortField === 'amount' || sortField === 'cost') {
        aVal = Number(a.final || a.total || a.cost || 0);
        bVal = Number(b.final || b.total || b.cost || 0);
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

    const isCotton = formData.oilType === 'Cotton';

    if (!formData.oilType || !formData.supplier?.trim()) {
      showToast('Please fill all required fields.', 'error');
      return;
    }

    if (isCotton) {
      if (!formData.cottonItems || formData.cottonItems.length === 0) {
        showToast('Please add at least one cotton variety.', 'error');
        return;
      }
      for (let i = 0; i < formData.cottonItems.length; i++) {
        const row = formData.cottonItems[i];
        if (!row.name || !row.name.trim()) {
          showToast(`Please enter cotton type/name for row #${i + 1}.`, 'error');
          return;
        }
        if (!row.qty || Number(row.qty) <= 0) {
          showToast(`Please enter a valid quantity (> 0) for "${row.name || 'row #' + (i + 1)}".`, 'error');
          return;
        }
        if (row.rate === '' || row.rate === undefined || Number(row.rate) < 0) {
          showToast(`Please enter a valid rate (>= 0) for "${row.name}".`, 'error');
          return;
        }
      }
    } else {
      if (!formData.qty || formData.rate === '' || formData.rate === undefined) {
        showToast('Please fill all required fields.', 'error');
        return;
      }
      if (Number(formData.qty) <= 0) {
        showToast('Quantity must be greater than 0.', 'error');
        return;
      }
      if (Number(formData.rate) < 0) {
        showToast('Rate cannot be negative.', 'error');
        return;
      }
    }

    const effectivePaid = formData.paidAmount !== '' && formData.paidAmount !== undefined
      ? Number(formData.paidAmount)
      : 0;
    const effectiveBalance = Math.max(0, finalAmount - effectivePaid);
    const effectiveStatus = finalAmount > 0 && effectiveBalance === 0 ? 'Paid' : 'Pending';

    const existingItem = editingId ? items.find(x => (x._id || x.id) === editingId || x.id === editingId) : null;
    let paidAt = existingItem?.paidAt;
    if (effectiveStatus === 'Paid' && !paidAt) {
      paidAt = new Date().toISOString();
    } else if (effectiveStatus !== 'Paid') {
      paidAt = null;
    }

    const effectiveDueDate = formData.dueDate || calculateDefaultDueDate(formData.date, 45);

    let sanitizedItems = [];
    let submittedQty = Number(formData.qty);
    let submittedRate = Number(formData.rate);
    let submittedUnit = formData.unit || 'Litre';

    if (isCotton) {
      sanitizedItems = formData.cottonItems.map((it, idx) => ({
        id: it.id || `cotton_${Date.now()}_${idx}`,
        name: it.name.trim(),
        cottonType: it.name.trim(),
        qty: Number(it.qty),
        unit: it.unit || 'Kg',
        rate: Number(it.rate),
        subtotal: Math.round(Number(it.qty) * Number(it.rate) * 100) / 100
      }));
      submittedQty = totalCottonQty;
      submittedUnit = sanitizedItems[0]?.unit || 'Kg';
      submittedRate = totalCottonQty > 0 ? Math.round((cost / totalCottonQty) * 100) / 100 : 0;
    }

    const payload = {
      ...formData,
      oilType: formData.oilType,
      items: sanitizedItems,
      dueDate: effectiveDueDate,
      qty: submittedQty,
      rate: submittedRate,
      unit: submittedUnit,
      cost,
      gst: gstAmount,
      final: finalAmount,
      total: finalAmount,
      paidAmount: effectivePaid,
      balanceAmount: effectiveBalance,
      status: effectiveStatus,
      paidAt,
      invoiceNo: formData.invoiceNo || `INV-0036-${String(Math.floor(100 + Math.random() * 900))}`
    };

    if (editingId) {
      await storageService.updateItem('oil', editingId, payload);
      showToast(`${isCotton ? 'Cotton' : 'Oil'} purchase updated successfully.`);
      setEditingId(null);
    } else {
      await storageService.addItem('oil', payload);
      showToast(`${isCotton ? 'Cotton' : 'Oil'} purchase recorded successfully.`);
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

    const itemDate = item.date ? new Date(item.date).toISOString().split('T')[0] : defaultToday;
    const itemDueDate = item.dueDate || calculateDefaultDueDate(itemDate, 45);
    const total = Number(item.final || item.total || item.cost || 0);
    const paid = item.paidAmount !== undefined && item.paidAmount !== null && item.paidAmount !== ''
      ? item.paidAmount
      : (item.status === 'Paid' ? total : '');

    const cottonItems = Array.isArray(item.items) && item.items.length > 0
      ? item.items.map((it, idx) => ({
          id: it.id || `cotton_${idx}`,
          name: it.name || it.cottonType || '',
          qty: it.qty ?? '',
          unit: it.unit || 'Kg',
          rate: it.rate ?? ''
        }))
      : [];

    setEditingId(item._id || item.id);
    setFormData({
      date: itemDate,
      dueDate: itemDueDate,
      oilType: item.oilType || '',
      supplier: item.supplier || '',
      qty: item.qty || '',
      unit: item.unit || (item.oilType === 'Cotton' ? 'Kg' : 'Litre'),
      rate: item.rate || '',
      includeGST: item.includeGST ?? true,
      invoiceNo: item.invoiceNo || '',
      paidAmount: paid,
      status: item.status || 'Paid',
      notes: item.notes || '',
      cottonItems
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

      await storageService.deleteItem('oil', deletingId);
      showToast('Oil record deleted.', 'success');
      setDeletingId(null);
      await loadData(false);
    }
  };

  const handleStatusChange = async (row, newStatus) => {
    if (isPaidLocked(row)) {
      showToast('This record was marked Paid over 24 hours ago and cannot be changed back to Pending.', 'error');
      return;
    }

    try {
      const targetId = row._id || row.id;
      const total = Number(row.final || row.total || row.cost || 0);
      const updatedPaid = newStatus === 'Paid' ? total : 0;
      const updatedBalance = newStatus === 'Paid' ? 0 : total;

      const updated = {
        ...row,
        status: newStatus,
        paidAmount: updatedPaid,
        balanceAmount: updatedBalance,
        paidAt: newStatus === 'Paid' ? (row.paidAt || new Date().toISOString()) : null
      };
      await storageService.updateItem('oil', targetId, updated);
      showToast(`Payment status changed to ${newStatus}.`, 'success');
      await loadData(false);
    } catch {
      showToast('Failed to update payment status.', 'error');
    }
  };

  // Columns definition:
  // - S.No (numeric 1..n, sortable)
  // - Date (sortable)
  // - Due Date (sortable, red when overdue)
  // - Supplier
  // - Qty
  // - Rate
  // - Amount (final, sortable)
  // - Paid
  // - Balance
  // - Status
  // Hidden from table: invoiceNo, oilType, cost (subtotal), gst (shown only in View modal)
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
    {
      key: 'supplier',
      header: 'Supplier',
      render: (val, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{val}</span>
          {row.oilType === 'Cotton' && (
            <span style={{
              fontSize: '0.68rem',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              padding: '1px 6px',
              borderRadius: '4px',
              fontWeight: 600
            }}>
              Cotton
            </span>
          )}
        </div>
      )
    },
    {
      key: 'qty',
      header: 'Qty',
      render: (val, row) => {
        if (row.oilType === 'Cotton' && Array.isArray(row.items) && row.items.length > 0) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span>{val} {row.unit || 'Kg'}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {row.items.length} {row.items.length === 1 ? 'type' : 'types'}
              </span>
            </div>
          );
        }
        return `${val} ${row.unit || 'Ltr'}`;
      }
    },
    {
      key: 'rate',
      header: 'Rate (₹)',
      render: (val, row) => {
        if (row.oilType === 'Cotton' && Array.isArray(row.items) && row.items.length > 1) {
          return (
            <span title={`Average Rate: ₹${val}`}>
              ₹ {val} <small style={{ color: 'var(--text-muted)' }}>(avg)</small>
            </span>
          );
        }
        return `₹ ${val}`;
      }
    },
    {
      key: 'final',
      header: 'Amount',
      sortable: true,
      render: (val) => <strong style={{ color: 'var(--primary-600)' }}>{formatINR(val)}</strong>
    },
    {
      key: 'paidAmount',
      header: 'Paid',
      render: (val, row) => {
        const total = Number(row.final || row.total || row.cost || 0);
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
        const total = Number(row.final || row.total || row.cost || 0);
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
    storageService.exportToCSV('Oil_Purchase_History', sortedItems, columns);
    showToast('Exported Excel file successfully.');
  };

  const handleExportPDF = () => {
    storageService.exportToPDF('Oil_Purchase_History', sortedItems, columns);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Oil Purchase Management</h2>
          <p className="page-subtitle">Manage oil purchases and track inventory for your manufacturing unit</p>
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
            <Plus size={16} /> Record Oil Purchase
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <MetricCard
          title="Total Oil Purchases"
          value={formatINR(metrics.totalPurchases)}
          trend="Live"
          trendType="neutral"
          icon={Fuel}
          iconBg="#fffbeb"
          iconColor="#d97706"
        />
        <MetricCard
          title="Current Stock"
          value={`${metrics.totalStock.toLocaleString('en-IN')} Ltr`}
          trend="Live"
          trendType="neutral"
          icon={PackageCheck}
          iconBg="#f5f3ff"
          iconColor="#7c3aed"
        />
        <div
          onClick={() => setStatusFilter(prev => prev === 'Paid' ? 'All' : 'Paid')}
          style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
          title="Click to filter Paid records"
        >
          <MetricCard
            title="Paid"
            value={`${metrics.paidCount} Purchases`}
            trend={statusFilter === 'Paid' ? 'Active Filter' : 'Click to filter'}
            trendType="positive"
            icon={CheckCircle2}
            iconBg="#ecfdf5"
            iconColor="#059669"
            style={statusFilter === 'Paid' ? { outline: '2px solid #059669', backgroundColor: '#f0fdf4' } : {}}
          />
        </div>
        <div
          onClick={() => setStatusFilter(prev => prev === 'Pending' ? 'All' : 'Pending')}
          style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
          title="Click to filter Pending records"
        >
          <MetricCard
            title="Pending"
            value={`${metrics.pendingCount} Purchases`}
            trend={statusFilter === 'Pending' ? 'Active Filter' : 'Click to filter'}
            trendType="neutral"
            icon={Clock}
            iconBg="#fef3c7"
            iconColor="#d97706"
            style={statusFilter === 'Pending' ? { outline: '2px solid #d97706', backgroundColor: '#fffbeb' } : {}}
          />
        </div>
        <div
          onClick={() => setStatusFilter(prev => prev === 'Overdue' ? 'All' : 'Overdue')}
          style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
          title="Click to filter Overdue records"
        >
          <MetricCard
            title="Overdue"
            value={`${metrics.overdueCount} Overdue`}
            trend={metrics.overdueCount > 0 ? formatINR(metrics.overdueBalance) : 'None'}
            trendType="negative"
            icon={AlertTriangle}
            iconBg="#fee2e2"
            iconColor="#dc2626"
            style={{
              borderColor: metrics.overdueCount > 0 ? '#fca5a5' : undefined,
              outline: statusFilter === 'Overdue' ? '2px solid #dc2626' : undefined,
              backgroundColor: statusFilter === 'Overdue' ? '#fef2f2' : undefined
            }}
          />
        </div>
      </div>

      {/* Real-time Stock Information Cards Strip */}
      {stockInfo.length > 0 && (
        <div className="erp-card">
          <div className="card-header">
            <h3 className="card-title">Live Inventory Stock Levels</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
            {stockInfo.map((item) => (
              <div
                key={item.type}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 0.85rem',
                  backgroundColor: item.isLow ? '#fff1f2' : '#f8fafc',
                  border: `1px solid ${item.isLow ? '#fecdd3' : 'var(--border-color)'}`,
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{item.type}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Min Threshold: {item.lowStockThreshold} {item.unit}</div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: item.isLow ? '#be123c' : 'var(--text-main)' }}>
                    {item.stock} {item.unit}
                  </span>
                  {item.isLow && <StatusBadge status="Low Stock" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Dialog Box for Add & Edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingId(null);
        }}
        title={editingId ? (formData.oilType === 'Cotton' ? 'Edit Cotton Purchase' : 'Edit Oil Purchase') : (formData.oilType === 'Cotton' ? 'Record Cotton Purchase' : 'Record Oil Purchase')}
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
                  const newDue = calculateDefaultDueDate(newDate, 45);
                  setFormData(prev => ({
                    ...prev,
                    date: newDate,
                    dueDate: prev.dueDate === calculateDefaultDueDate(prev.date, 45) ? newDue : prev.dueDate
                  }));
                }}
                required
              />
            </div>

            {/* Payment Due Date with default 45 days */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>
                  Payment Due Date <span className="required">*</span>
                </label>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  Default: 45 Days
                </span>
              </div>
              <input
                type="date"
                className="form-control"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                required
                style={{
                  borderColor: isDueDateCrossed(formData.dueDate) ? '#dc2626' : undefined,
                  backgroundColor: isDueDateCrossed(formData.dueDate) ? '#fef2f2' : undefined
                }}
              />
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '2px 6px', fontSize: '0.68rem', height: 'auto' }}
                  onClick={() => setFormData({ ...formData, dueDate: defaultToday })}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '2px 6px', fontSize: '0.68rem', height: 'auto' }}
                  onClick={() => setFormData({ ...formData, dueDate: calculateDefaultDueDate(formData.date, 15) })}
                >
                  +15d
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '2px 6px', fontSize: '0.68rem', height: 'auto' }}
                  onClick={() => setFormData({ ...formData, dueDate: calculateDefaultDueDate(formData.date, 30) })}
                >
                  +30d
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '2px 6px', fontSize: '0.68rem', height: 'auto', fontWeight: 600, color: 'var(--primary-600)' }}
                  onClick={() => setFormData({ ...formData, dueDate: calculateDefaultDueDate(formData.date, 45) })}
                >
                  +45d (Default)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '2px 6px', fontSize: '0.68rem', height: 'auto' }}
                  onClick={() => setFormData({ ...formData, dueDate: calculateDefaultDueDate(formData.date, 60) })}
                >
                  +60d
                </button>
              </div>
              {isDueDateCrossed(formData.dueDate) && (
                <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <AlertTriangle size={12} />
                  <span>Selected due date has already passed today</span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Oil Type / Material Type <span className="required">*</span></label>
              <DynamicTypeSelect
                category="oil_type"
                value={formData.oilType}
                onChange={(val) => {
                  setFormData(prev => ({
                    ...prev,
                    oilType: val,
                    unit: val === 'Cotton' ? 'Kg' : (prev.unit === 'Kg' ? 'Litre' : prev.unit)
                  }));
                }}
                label="Oil / Material Type"
                placeholder="Select Oil / Material Type"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Supplier Name <span className="required">*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="Enter supplier name"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                required
              />
            </div>

            {formData.oilType !== 'Cotton' ? (
              <>
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
                    <option value="Litre">Litre</option>
                    <option value="Barrel">Barrel</option>
                    <option value="Can">Can</option>
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
              </>
            ) : null}

            {formData.oilType === 'Cotton' && (
              <div className="form-group col-span-3" style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        Cotton Rate Details
                      </h4>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Configure dynamic cotton varieties with quantity and rate
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleAddCottonItem}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        fontWeight: 600,
                        fontSize: '0.8rem'
                      }}
                    >
                      <Plus size={15} /> Add Cotton Type (+)
                    </button>
                  </div>

                  {(!formData.cottonItems || formData.cottonItems.length === 0) ? (
                    <div style={{
                      padding: '2rem 1rem',
                      textAlign: 'center',
                      backgroundColor: '#f8fafc',
                      border: '1.5px dashed #cbd5e1',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.65rem'
                    }}>
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: '#e0f2fe',
                        color: '#0284c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Plus size={22} />
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                        No Cotton Varieties Added Yet
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '440px', lineHeight: '1.4' }}>
                        Click <strong>Add Cotton Type (+)</strong> to add custom varieties (e.g., White Cotton, Red Cotton, Blue Cotton, or any custom color).
                      </p>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleAddCottonItem}
                        style={{ marginTop: '0.25rem', fontWeight: 600 }}
                      >
                        <Plus size={14} /> Add Cotton Type (+)
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {formData.cottonItems.map((item, idx) => {
                        const rowSubtotal = (Number(item.qty) || 0) * (Number(item.rate) || 0);
                        return (
                          <div
                            key={item.id || idx}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(180px, 2fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(110px, 1fr) minmax(120px, 1.2fr) 40px',
                              gap: '0.75rem',
                              alignItems: 'flex-end',
                              padding: '0.85rem 1rem',
                              backgroundColor: '#f8fafc',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-md)'
                            }}
                          >
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                                Cotton Type / Name <span style={{ color: '#dc2626' }}>*</span>
                              </label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="e.g. White Cotton"
                                value={item.name}
                                onChange={(e) => handleCottonItemChange(idx, 'name', e.target.value)}
                                required
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                                Quantity <span style={{ color: '#dc2626' }}>*</span>
                              </label>
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                className="form-control"
                                placeholder="10"
                                value={item.qty}
                                onChange={(e) => handleCottonItemChange(idx, 'qty', e.target.value)}
                                required
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                                Unit <span style={{ color: '#dc2626' }}>*</span>
                              </label>
                              <select
                                className="form-control"
                                value={item.unit || 'Kg'}
                                onChange={(e) => handleCottonItemChange(idx, 'unit', e.target.value)}
                              >
                                <option value="Kg">Kg</option>
                                <option value="Bale">Bale</option>
                                <option value="Nos">Nos</option>
                                <option value="Meter">Meter</option>
                                <option value="Litre">Litre</option>
                              </select>
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                                Rate (₹) <span style={{ color: '#dc2626' }}>*</span>
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                className="form-control"
                                placeholder="100"
                                value={item.rate}
                                onChange={(e) => handleCottonItemChange(idx, 'rate', e.target.value)}
                                required
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                                Subtotal (₹)
                              </label>
                              <input
                                type="text"
                                className="form-control"
                                readOnly
                                value={formatINR(rowSubtotal)}
                                style={{
                                  backgroundColor: '#ffffff',
                                  fontWeight: 600,
                                  color: 'var(--text-main)',
                                  cursor: 'default'
                                }}
                              />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '2px' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveCottonItem(idx)}
                                title="Remove cotton variety"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#dc2626',
                                  cursor: 'pointer',
                                  padding: '6px',
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Summary Banner below rows matching prompt specs */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.85rem 1.25rem',
                        backgroundColor: '#f1f5f9',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid #e2e8f0',
                        marginTop: '0.25rem',
                        flexWrap: 'wrap',
                        gap: '1rem'
                      }}>
                        <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Subtotal
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-600)' }}>
                              {formatINR(cost)}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Total Quantity
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                              {totalCottonQty} {formData.cottonItems[0]?.unit || 'Kg'}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                          Illustrative values only. GST, amount paid and balance due should be calculated using your actual entries.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="form-group col-span-3" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.75rem', margin: '0.25rem 0' }}>
              <input
                type="checkbox"
                id="includeGSTCheck"
                checked={formData.includeGST}
                onChange={(e) => setFormData({ ...formData, includeGST: e.target.checked })}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="includeGSTCheck" style={{ fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                Include GST (5%)
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">Subtotal Cost (₹)</label>
              <input type="text" className="form-control" readOnly value={formatINR(cost)} />
            </div>

            <div className="form-group">
              <label className="form-label">GST Amount (₹)</label>
              <input type="text" className="form-control" readOnly value={formatINR(gstAmount)} />
            </div>

            <div className="form-group">
              <label className="form-label">Total Amount (₹)</label>
              <input
                type="text"
                className="form-control"
                readOnly
                style={{ fontWeight: 700, color: 'var(--primary-600)' }}
                value={formatINR(finalAmount)}
              />
            </div>

            {/* Paid Amount */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Amount Paid (₹)</label>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary-600)',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    padding: 0
                  }}
                  onClick={() => handlePaidAmountChange(String(finalAmount))}
                >
                  Pay Full ({formatINR(finalAmount)})
                </button>
              </div>
              <input
                type="number"
                min="0"
                max={finalAmount || undefined}
                step="0.01"
                className="form-control"
                placeholder={finalAmount > 0 ? `Enter paid (0 to ${finalAmount})` : '0'}
                value={formData.paidAmount}
                onChange={(e) => handlePaidAmountChange(e.target.value)}
              />
            </div>

            {/* Balance Amount */}
            <div className="form-group">
              <label className="form-label">Balance Amount (₹)</label>
              <input
                type="text"
                className="form-control"
                readOnly
                value={formatINR(currentBalance)}
                style={{
                  fontWeight: 600,
                  color: currentBalance > 0 ? '#d97706' : '#059669',
                  backgroundColor: currentBalance > 0 ? '#fffbeb' : '#f0fdf4'
                }}
              />
            </div>

            {/* Payment Status */}
            <div className="form-group">
              <label className="form-label">Payment Status</label>
              <div style={{ display: 'flex', alignItems: 'center', height: '38px', gap: '0.5rem' }}>
                <StatusBadge status={autoStatus} />
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {autoStatus === 'Paid' ? 'Fully settled' : `Pending ₹${currentBalance.toLocaleString('en-IN')}`}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Invoice Number</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. INV-0036-090"
                value={formData.invoiceNo}
                onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value })}
              />
            </div>

            <div className="form-group col-span-2">
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
              {editingId ? 'Update Purchase' : 'Save Purchase'}
            </button>
          </div>
        </form>
      </Modal>

      {/* History Table Card */}
      <div className="erp-card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="card-title-group">
            <FileText size={18} color="var(--primary-600)" />
            <h3 className="card-title">Oil Purchase History</h3>
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
              <Plus size={14} /> Record Purchase
            </button>

            {/* Search Box */}
            <div className="search-box" style={{ width: '190px', height: '34px' }}>
              <Search size={14} />
              <input
                type="text"
                placeholder="Search oil records..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Dynamic Suppliers Filter Dropdown */}
            <select
              className="form-control"
              style={{ width: '150px', height: '34px', fontSize: '0.78rem' }}
              value={supplierFilter}
              onChange={(e) => {
                setSupplierFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All Suppliers">
                All Suppliers ({items.length})
              </option>
              {supplierOptions.map((s) => {
                const count = items.filter(x => x.supplier?.trim().toLowerCase() === s.toLowerCase()).length;
                return (
                  <option key={s} value={s}>
                    {s} ({count})
                  </option>
                );
              })}
            </select>

            {/* Oil Type Filter */}
            <select
              className="form-control"
              style={{ width: '140px', height: '34px', fontSize: '0.78rem' }}
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All Types">All Types</option>
              {oilTypeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
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

        {/* Active Filter Indicator Chips */}
        {(supplierFilter !== 'All Suppliers' || statusFilter !== 'All' || typeFilter !== 'All Types' || searchQuery || startDate || endDate) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.45rem 1rem',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '0.75rem',
            flexWrap: 'wrap'
          }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Active Filters:</span>
            {supplierFilter !== 'All Suppliers' && (
              <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Supplier: {supplierFilter}
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSupplierFilter('All Suppliers')} />
              </span>
            )}
            {typeFilter !== 'All Types' && (
              <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Type: {typeFilter}
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => setTypeFilter('All Types')} />
              </span>
            )}
            {statusFilter !== 'All' && (
              <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Status: {statusFilter}
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => setStatusFilter('All')} />
              </span>
            )}
            {startDate && (
              <span className="badge" style={{ backgroundColor: '#ccfbf1', color: '#0f766e', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Date: {startDate}{endDate ? ` to ${endDate}` : ''}
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => { setStartDate(''); setEndDate(''); }} />
              </span>
            )}
            {searchQuery && (
              <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Search: "{searchQuery}"
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
              </span>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '1px 6px', fontSize: '0.7rem', height: 'auto', marginLeft: 'auto' }}
              onClick={() => {
                setSupplierFilter('All Suppliers');
                setTypeFilter('All Types');
                setStatusFilter('All');
                setSearchQuery('');
                setStartDate('');
                setEndDate('');
              }}
            >
              Clear All Filters
            </button>
          </div>
        )}

        <DataTable
          columns={columns}
          data={paginatedItems}
          onView={(row) => setViewingItem(row)}
          onEdit={(row) => handleEdit(row)}
          onDelete={(row) => setDeletingId(row._id || row.id)}
          onStatusChange={handleStatusChange}
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

      {/* View Details Modal: Shows Invoice No, Oil Type, Subtotal, GST, etc. */}
      <Modal isOpen={!!viewingItem} onClose={() => setViewingItem(null)} title={viewingItem?.oilType === 'Cotton' ? 'Cotton Purchase Details' : 'Oil Purchase Details'} maxWidth="1120px">
        {viewingItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div><strong style={{ color: 'var(--text-muted)' }}>Invoice No:</strong> <code>{viewingItem.invoiceNo || 'N/A'}</code></div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Purchase Date:</strong> {formatDate(viewingItem.date)}</div>
              <div>
                <strong style={{ color: 'var(--text-muted)' }}>Payment Due Date:</strong>{' '}
                <span style={{
                  color: isOverdue(viewingItem) ? '#dc2626' : 'var(--text-main)',
                  fontWeight: isOverdue(viewingItem) ? 700 : 500
                }}>
                  {formatDate(getItemDueDate(viewingItem))}
                  {isOverdue(viewingItem) && ` (Overdue by ${getDaysOverdue(viewingItem)} days)`}
                </span>
              </div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Material / Oil Type:</strong> {viewingItem.oilType}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Supplier:</strong> {viewingItem.supplier}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Total Quantity:</strong> {viewingItem.qty} {viewingItem.unit || (viewingItem.oilType === 'Cotton' ? 'Kg' : 'Ltr')}</div>
              <div>
                <strong style={{ color: 'var(--text-muted)' }}>Rate per Unit:</strong> ₹ {viewingItem.rate}
                {viewingItem.oilType === 'Cotton' && Array.isArray(viewingItem.items) && viewingItem.items.length > 1 && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '4px' }}>(avg)</span>
                )}
              </div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Subtotal Cost:</strong> {formatINR(viewingItem.cost)}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>GST ({viewingItem.gstRate || 5}%):</strong> {formatINR(viewingItem.gst || 0)}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Total Amount:</strong> <strong style={{ color: 'var(--primary-600)' }}>{formatINR(viewingItem.final || viewingItem.total)}</strong></div>
              <div>
                <strong style={{ color: 'var(--text-muted)' }}>Paid:</strong>{' '}
                <strong style={{ color: '#059669' }}>
                  {formatINR(
                    viewingItem.paidAmount !== undefined && viewingItem.paidAmount !== null && viewingItem.paidAmount !== ''
                      ? Number(viewingItem.paidAmount)
                      : (viewingItem.status === 'Paid' ? Number(viewingItem.final || viewingItem.total || 0) : 0)
                  )}
                </strong>
              </div>
              <div>
                <strong style={{ color: 'var(--text-muted)' }}>Balance:</strong>{' '}
                <strong style={{ color: '#d97706' }}>
                  {formatINR(
                    Math.max(
                      0,
                      Number(viewingItem.final || viewingItem.total || 0) -
                      (viewingItem.paidAmount !== undefined && viewingItem.paidAmount !== null && viewingItem.paidAmount !== ''
                        ? Number(viewingItem.paidAmount)
                        : (viewingItem.status === 'Paid' ? Number(viewingItem.final || viewingItem.total || 0) : 0))
                    )
                  )}
                </strong>
              </div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Payment Status:</strong> <StatusBadge status={isOverdue(viewingItem) ? 'Overdue' : getPaymentStatus(viewingItem)} /></div>
            </div>

            {/* Cotton Varieties Breakdown Table */}
            {viewingItem.oilType === 'Cotton' && Array.isArray(viewingItem.items) && viewingItem.items.length > 0 && (
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
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-main)' }}>{it.name || it.cottonType}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>{it.qty} {it.unit || 'Kg'}</td>
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
                          {viewingItem.items.reduce((s, x) => s + (Number(x.qty) || 0), 0)} {viewingItem.items[0]?.unit || 'Kg'}
                        </td>
                        <td></td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--primary-600)' }}>
                          {formatINR(viewingItem.cost)}
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
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete Oil Purchase"
        message="Are you sure you want to delete this oil purchase record?"
      />
    </div>
  );
}
