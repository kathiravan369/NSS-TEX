import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap,
  DollarSign,
  Gauge,
  TrendingUp,
  Plus,
  Download,
  Printer,
  Search,
  FileText,
  Eye,
  Edit2,
  Trash2,
  Lock
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
  ComposedChart
} from 'recharts';
import MetricCard from '../components/common/MetricCard';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Toast from '../components/common/Toast';
import StatusBadge from '../components/common/StatusBadge';
import { storageService } from '../services/storageService';
import { formatINR, formatDate, formatDateTime, isPaidLocked } from '../utils/formatters';

const INITIAL_FORM = {
  month: '',
  billDate: new Date().toISOString().split('T')[0],
  dueDate: '',
  prev: '',
  curr: '',
  rate: '',
  fixed: 0,
  additional: 0,
  status: 'Pending',
  payDate: '',
  notes: ''
};

export default function ElectricityCost() {
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('2026');
  const [page, setPage] = useState(1);
  const itemsPerPage = 6;

  const loadData = async () => {
    try {
      const data = await storageService.fetchLiveCollection('electricity');
      setItems(data || []);
    } catch {
      const data = storageService.getCollection('electricity');
      setItems(data || []);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Live Auto-Calculation from meter readings
  const unitsConsumed = Math.max(0, (Number(formData.curr) || 0) - (Number(formData.prev) || 0));
  const totalBillAmount =
    unitsConsumed * (Number(formData.rate) || 0) +
    (Number(formData.fixed) || 0) +
    (Number(formData.additional) || 0);

  // KPI Metrics
  const metrics = useMemo(() => {
    const totalCost = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const totalUnits = items.reduce((acc, curr) => acc + (curr.units || 0), 0);
    const latestBill = items.length > 0 ? items[0].total : 0;
    const avgCostPerUnit = totalUnits > 0 ? totalCost / totalUnits : 6.24;

    return {
      totalCost,
      totalUnits,
      latestBill,
      avgCostPerUnit,
      totalRecords: items.length
    };
  }, [items]);

  // Chart data
  const chartData = useMemo(() => {
    return items.map((b) => ({
      month: (b.month || '').split(' ')[0],
      units: b.units,
      cost: b.total
    })).reverse();
  }, [items]);

  // Filtered & Paginated
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.month?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.notes?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesYear =
        yearFilter === 'All Years' || item.month?.includes(yearFilter);

      return matchesSearch && matchesYear;
    });
  }, [items, searchQuery, yearFilter]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const paginatedItems = filteredItems.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.month || !formData.billDate || formData.prev === '' || formData.curr === '' || !formData.rate) {
      showToast('Please fill all required fields.', 'error');
      return;
    }

    if (Number(formData.curr) < Number(formData.prev)) {
      showToast('Current reading cannot be less than previous reading.', 'error');
      return;
    }

    const existingItem = editingId ? items.find(x => (x._id || x.id) === editingId || x.id === editingId) : null;
    let payDate = formData.payDate;
    if (formData.status === 'Paid' && !payDate) {
      payDate = new Date().toISOString().split('T')[0];
    } else if (formData.status !== 'Paid') {
      payDate = '';
    }

    const payload = {
      ...formData,
      prev: Number(formData.prev),
      curr: Number(formData.curr),
      units: unitsConsumed,
      rate: Number(formData.rate),
      fixed: Number(formData.fixed) || 0,
      additional: Number(formData.additional) || 0,
      total: totalBillAmount,
      payDate
    };

    if (editingId) {
      await storageService.updateItem('electricity', editingId, payload);
      showToast('Electricity bill updated successfully.');
      setEditingId(null);
    } else {
      await storageService.addItem('electricity', payload);
      showToast('New electricity bill recorded.');
    }

    setIsModalOpen(false);
    setFormData(INITIAL_FORM);
    await loadData();
  };

  const handleEdit = (item) => {
    if (isPaidLocked(item)) {
      showToast('This record was marked Paid over 24 hours ago and cannot be edited (View Only).', 'error');
      return;
    }

    setEditingId(item._id || item.id);
    setFormData({
      month: item.month || '',
      billDate: item.billDate ? new Date(item.billDate).toISOString().split('T')[0] : '',
      dueDate: item.dueDate || '',
      prev: item.prev ?? '',
      curr: item.curr ?? '',
      rate: item.rate ?? '',
      fixed: item.fixed || 0,
      additional: item.additional || 0,
      status: item.status || 'Pending',
      payDate: item.payDate || '',
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

      await storageService.deleteItem('electricity', deletingId);
      showToast('Electricity bill deleted.', 'success');
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
        payDate: newStatus === 'Paid' ? (row.payDate || new Date().toISOString().split('T')[0]) : ''
      };
      await storageService.updateItem('electricity', targetId, updated);
      showToast(`Payment status changed to ${newStatus}.`, 'success');
      await loadData();
    } catch {
      showToast('Failed to update payment status.', 'error');
    }
  };

  const columns = [
    { key: 'id', header: 'S. No', width: '55px' },
    { key: 'month', header: 'Billing Month' },
    { key: 'billDate', header: 'Bill Date', render: (val) => formatDate(val) },
    { key: 'prev', header: 'Prev Reading' },
    { key: 'curr', header: 'Curr Reading' },
    { key: 'units', header: 'Units Consumed', render: (val) => <strong>{val}</strong> },
    { key: 'rate', header: 'Rate (₹)', render: (val) => `₹ ${val}` },
    { key: 'fixed', header: 'Fixed (₹)', render: (val) => formatINR(val) },
    { key: 'additional', header: 'Addl (₹)', render: (val) => formatINR(val) },
    { key: 'total', header: 'Total (₹)', render: (val) => <strong style={{ color: 'var(--primary-600)' }}>{formatINR(val)}</strong> },
    { key: 'status', header: 'Payment Status', isStatus: true },
    { key: 'payDate', header: 'Payment Date', render: (val) => formatDate(val) }
  ];

  const handleExportCSV = () => {
    storageService.exportToCSV('Electricity_Bill_History', filteredItems, columns);
    showToast('Exported Excel file successfully.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Electricity Cost Management</h2>
          <p className="page-subtitle">Track electricity bills, units consumption and manage payments</p>
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
            <Plus size={16} /> Add Electricity Bill
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <MetricCard
          title="Total Electricity Cost"
          value={formatINR(metrics.totalCost)}
          trend="Live"
          trendType="neutral"
          icon={Zap}
          iconBg="#ecfdf5"
          iconColor="#059669"
        />
        <MetricCard
          title="Current Month Bill"
          value={formatINR(metrics.latestBill)}
          trend="Live"
          trendType="neutral"
          icon={DollarSign}
          iconBg="#eff6ff"
          iconColor="#2563eb"
        />
        <MetricCard
          title="Total Units Consumed"
          value={`${metrics.totalUnits.toLocaleString('en-IN')} Units`}
          trend="Live"
          trendType="neutral"
          icon={Gauge}
          iconBg="#fef3c7"
          iconColor="#d97706"
        />
        <MetricCard
          title="Average Cost per Unit"
          value={`₹ ${metrics.avgCostPerUnit.toFixed(2)}`}
          trend="Live"
          trendType="neutral"
          icon={TrendingUp}
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
        title={editingId ? 'Edit Electricity Bill' : 'Record Electricity Bill'}
        maxWidth="840px"
      >
        <form onSubmit={handleSubmit} style={{ width: '100%', boxSizing: 'border-box' }}>
          <div className="erp-form-grid">
            <div className="form-group">
              <label className="form-label">Billing Month <span className="required">*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. October 2026"
                value={formData.month}
                onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Bill Date <span className="required">*</span></label>
              <input
                type="date"
                className="form-control"
                value={formData.billDate}
                onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input
                type="date"
                className="form-control"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Previous Reading <span className="required">*</span></label>
              <input
                type="number"
                min="0"
                className="form-control"
                placeholder="e.g. 12560"
                value={formData.prev}
                onChange={(e) => setFormData({ ...formData, prev: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Current Reading <span className="required">*</span></label>
              <input
                type="number"
                min="0"
                className="form-control"
                placeholder="e.g. 13240"
                value={formData.curr}
                onChange={(e) => setFormData({ ...formData, curr: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Units Consumed</label>
              <input
                type="text"
                className="form-control"
                readOnly
                style={{ fontWeight: 700, backgroundColor: '#f0fdf4', color: '#166534' }}
                value={`${unitsConsumed} Units`}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Rate per Unit (₹) <span className="required">*</span></label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="e.g. 6.50"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fixed Charges (₹)</label>
              <input
                type="number"
                className="form-control"
                placeholder="Fixed charge"
                value={formData.fixed}
                onChange={(e) => setFormData({ ...formData, fixed: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Additional Charges (₹)</label>
              <input
                type="number"
                className="form-control"
                placeholder="Additional charge"
                value={formData.additional}
                onChange={(e) => setFormData({ ...formData, additional: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Total Bill Amount (₹)</label>
              <input
                type="text"
                className="form-control"
                readOnly
                style={{ fontWeight: 700, color: 'var(--primary-600)' }}
                value={formatINR(totalBillAmount)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Status <span className="required">*</span></label>
              <select
                className="form-control"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Payment Date</label>
              <input
                type="date"
                className="form-control"
                value={formData.payDate}
                onChange={(e) => setFormData({ ...formData, payDate: e.target.value })}
              />
            </div>

            <div className="form-group col-span-3">
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
              {editingId ? 'Update Bill' : 'Save Bill'}
            </button>
          </div>
        </form>
      </Modal>

      {/* History Table */}
      <div className="erp-card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="card-title-group">
            <FileText size={18} color="var(--primary-600)" />
            <h3 className="card-title">Electricity Bill History</h3>
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
              <Plus size={14} /> Add Bill
            </button>
            <div className="search-box" style={{ width: '180px', height: '34px' }}>
              <Search size={14} />
              <input
                type="text"
                placeholder="Search bills..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <select
              className="form-control"
              style={{ width: '120px', height: '34px', fontSize: '0.78rem' }}
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All Years">All Years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
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
          onStatusChange={handleStatusChange}
          page={page}
          totalPages={totalPages}
          totalItems={filteredItems.length}
          itemsPerPage={itemsPerPage}
          onPageChange={(newPage) => setPage(newPage)}
        />
      </div>

      {/* View Details Modal */}
      <Modal isOpen={!!viewingItem} onClose={() => setViewingItem(null)} title="Electricity Bill Details">
        {viewingItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div><strong style={{ color: 'var(--text-muted)' }}>Billing Month:</strong> {viewingItem.month}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Bill Date:</strong> {formatDate(viewingItem.billDate)}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Due Date:</strong> {formatDate(viewingItem.dueDate)}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Meter Readings:</strong> {viewingItem.prev} → {viewingItem.curr}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Units Consumed:</strong> <strong>{viewingItem.units} Units</strong></div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Rate per Unit:</strong> ₹ {viewingItem.rate}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Fixed Charges:</strong> {formatINR(viewingItem.fixed)}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Additional Charges:</strong> {formatINR(viewingItem.additional)}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Total Bill:</strong> <strong style={{ color: 'var(--primary-600)' }}>{formatINR(viewingItem.total)}</strong></div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Payment Status:</strong> <StatusBadge status={viewingItem.status} /></div>
              {viewingItem.payDate && (
                <div><strong style={{ color: 'var(--text-muted)' }}>Payment Date:</strong> {formatDate(viewingItem.payDate)}</div>
              )}
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
                <strong style={{ color: 'var(--text-main)' }}>Created At:</strong> {formatDateTime(viewingItem.createdAt || viewingItem.billDate)}
              </div>
              <div>
                <strong style={{ color: 'var(--text-main)' }}>Updated At:</strong> {formatDateTime(viewingItem.updatedAt || viewingItem.createdAt || viewingItem.billDate)}
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
        title="Delete Electricity Bill"
        message="Are you sure you want to delete this electricity bill record?"
      />
    </div>
  );
}
