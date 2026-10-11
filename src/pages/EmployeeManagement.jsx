import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Calendar,
  Box,
  UserCheck,
  Plus,
  Download,
  Printer,
  Search,
  FileText,
  Info,
  Power,
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
import { storageService } from '../services/storageService';
import { formatINR, formatDate, formatDateTime } from '../utils/formatters';

const INITIAL_FORM = {
  empId: '',
  name: '',
  phone: '',
  joinDate: new Date().toISOString().split('T')[0],
  type: 'Day Salary',
  dailyRate: '',
  productType: '',
  pieceRate: '',
  status: 'Active',
  notes: ''
};

export default function EmployeeManagement() {
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [workTypeFilter, setWorkTypeFilter] = useState('All Work Types');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [page, setPage] = useState(1);
  const itemsPerPage = 6;

  const loadData = async () => {
    try {
      const data = await storageService.fetchLiveCollection('employees');
      setItems(data || []);
    } catch {
      const data = storageService.getCollection('employees');
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

  // Generate next EMP-xxxx ID
  const nextEmpId = useMemo(() => {
    const maxNum = items.reduce((acc, curr) => {
      const num = parseInt(curr.empId?.replace(/\D/g, '') || '0', 10);
      return Math.max(acc, num);
    }, 0);
    return `EMP-${String(maxNum + 1).padStart(4, '0')}`;
  }, [items]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = items.length;
    const daySalary = items.filter(e => e.type === 'Day Salary').length;
    const countSalary = items.filter(e => e.type === 'Count Salary').length;
    const active = items.filter(e => e.status === 'Active').length;

    return { total, daySalary, countSalary, active };
  }, [items]);

  // Filtered & Paginated
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.empId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.phone?.includes(searchQuery);

      const matchesType =
        workTypeFilter === 'All Work Types' || item.type === workTypeFilter;

      const matchesStatus =
        statusFilter === 'All Status' || item.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [items, searchQuery, workTypeFilter, statusFilter]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const paginatedItems = filteredItems.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.phone || !formData.joinDate) {
      showToast('Please fill all required employee details.', 'error');
      return;
    }

    const payload = {
      ...formData,
      empId: formData.empId || (editingId ? formData.empId : nextEmpId),
      dailyRate: formData.type === 'Day Salary' ? Number(formData.dailyRate) : 0,
      pieceRate: formData.type === 'Count Salary' ? Number(formData.pieceRate) : 0,
      productType: formData.type === 'Count Salary' ? formData.productType : ''
    };

    if (editingId) {
      await storageService.updateItem('employees', editingId, payload);
      showToast('Employee details updated successfully.');
      setEditingId(null);
    } else {
      await storageService.addItem('employees', payload);
      showToast('New employee registered successfully.');
    }

    setIsModalOpen(false);
    setFormData(INITIAL_FORM);
    await loadData();
  };

  const handleEdit = (item) => {
    setEditingId(item._id || item.id);
    setFormData({
      empId: item.empId,
      name: item.name,
      phone: item.phone,
      joinDate: item.joinDate,
      type: item.type,
      dailyRate: item.dailyRate || 600,
      productType: item.productType || 'Towels',
      pieceRate: item.pieceRate || 12,
      status: item.status || 'Active',
      notes: item.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (item) => {
    const updatedStatus = item.status === 'Active' ? 'Inactive' : 'Active';
    await storageService.updateItem('employees', item._id || item.id, { status: updatedStatus });
    showToast(`Employee marked as ${updatedStatus}.`);
    await loadData();
  };

  const handleDelete = async () => {
    if (deletingId) {
      await storageService.deleteItem('employees', deletingId);
      showToast('Employee deleted from directory.', 'success');
      setDeletingId(null);
      await loadData();
    }
  };

  const columns = [
    { key: 'id', header: 'S. No', width: '55px' },
    { key: 'empId', header: 'Employee ID', render: (val) => <code>{val}</code> },
    { key: 'name', header: 'Employee Name', render: (val) => <strong>{val}</strong> },
    { key: 'phone', header: 'Phone Number' },
    { key: 'type', header: 'Work Type' },
    { key: 'productType', header: 'Product Type', render: (val, row) => row.type === 'Count Salary' ? val : '-' },
    {
      key: 'salaryRate',
      header: 'Salary Rate',
      render: (val, row) =>
        row.type === 'Day Salary'
          ? `₹ ${row.dailyRate} / Day`
          : `₹ ${row.pieceRate} / Piece`
    },
    { key: 'joinDate', header: 'Joining Date', render: (val) => formatDate(val) },
    { key: 'status', header: 'Status', isStatus: true }
  ];

  const handleExportCSV = () => {
    storageService.exportToCSV('Employee_Directory', filteredItems, columns);
    showToast('Exported Excel file successfully.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="page-title">Employee Management</h2>
          <p className="page-subtitle">Manage your manufacturing employees, wages and piece-rate assignments</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingId(null);
            setFormData(INITIAL_FORM);
            setIsModalOpen(true);
          }}
        >
          <Plus size={16} /> Add Employee
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <MetricCard
          title="Total Employees"
          value={metrics.total}
          trend="↑ 12%"
          trendType="up"
          icon={Users}
          iconBg="#eff6ff"
          iconColor="#2563eb"
        />
        <MetricCard
          title="Day Salary Employees"
          value={metrics.daySalary}
          trend="↑ 6%"
          trendType="up"
          icon={Calendar}
          iconBg="#ecfdf5"
          iconColor="#059669"
        />
        <MetricCard
          title="Count Salary Employees"
          value={metrics.countSalary}
          trend="↑ 25%"
          trendType="up"
          icon={Box}
          iconBg="#f5f3ff"
          iconColor="#7c3aed"
        />
        <MetricCard
          title="Active Employees"
          value={metrics.active}
          trend="↑ 8%"
          trendType="up"
          icon={UserCheck}
          iconBg="#dcfce7"
          iconColor="#16a34a"
        />
      </div>

      {/* Directory Table */}
      <div className="erp-card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="card-title-group">
            <FileText size={18} color="var(--primary-600)" />
            <h3 className="card-title">Employee List</h3>
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
              <Plus size={14} /> Add Employee
            </button>

            <div className="search-box" style={{ width: '180px', height: '34px' }}>
              <Search size={14} />
              <input
                type="text"
                placeholder="Search employee..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <select
              className="form-control"
              style={{ width: '140px', height: '34px', fontSize: '0.78rem' }}
              value={workTypeFilter}
              onChange={(e) => {
                setWorkTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All Work Types">All Work Types</option>
              <option value="Day Salary">Day Salary</option>
              <option value="Count Salary">Count Salary</option>
            </select>

            <select
              className="form-control"
              style={{ width: '120px', height: '34px', fontSize: '0.78rem' }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All Status">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
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
          totalItems={filteredItems.length}
          itemsPerPage={itemsPerPage}
          onPageChange={(newPage) => setPage(newPage)}
        />
      </div>

      {/* Add / Edit Employee Modal Box */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingId(null);
          setFormData(INITIAL_FORM);
        }}
        title={editingId ? 'Edit Employee Details' : 'Add New Employee'}
        maxWidth="840px"
      >
        <form onSubmit={handleSubmit} style={{ width: '100%', boxSizing: 'border-box' }}>
          <div className="erp-form-grid">
            <div className="form-group">
              <label className="form-label">Employee ID</label>
              <input
                type="text"
                className="form-control"
                placeholder={nextEmpId}
                value={formData.empId || (editingId ? formData.empId : nextEmpId)}
                onChange={(e) => setFormData({ ...formData, empId: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Employee Name <span className="required">*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="Enter full name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number <span className="required">*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 9876543210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Joining Date <span className="required">*</span></label>
              <input
                type="date"
                className="form-control"
                value={formData.joinDate}
                onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                required
              />
            </div>

            {/* Work Type Switcher Pills */}
            <div className="form-group col-span-2">
              <label className="form-label">Work Type <span className="required">*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div
                  onClick={() => setFormData({ ...formData, type: 'Day Salary' })}
                  style={{
                    border: formData.type === 'Day Salary' ? '2px solid var(--primary-600)' : '1px solid var(--border-color)',
                    backgroundColor: formData.type === 'Day Salary' ? 'var(--primary-50)' : '#ffffff',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.6rem 0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem'
                  }}
                >
                  <Calendar size={18} color="var(--primary-600)" />
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Day Salary</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Daily wage based on work days</div>
                  </div>
                </div>

                <div
                  onClick={() => setFormData({ ...formData, type: 'Count Salary' })}
                  style={{
                    border: formData.type === 'Count Salary' ? '2px solid #7c3aed' : '1px solid var(--border-color)',
                    backgroundColor: formData.type === 'Count Salary' ? '#f5f3ff' : '#ffffff',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.6rem 0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem'
                  }}
                >
                  <Box size={18} color="#7c3aed" />
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Count Salary</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Payment based on piece-count</div>
                  </div>
                </div>
              </div>
            </div>

            {formData.type === 'Day Salary' ? (
              <div className="form-group col-span-3">
                <label className="form-label">Daily Salary Rate (₹) <span className="required">*</span></label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  placeholder="e.g. 600"
                  value={formData.dailyRate}
                  onChange={(e) => setFormData({ ...formData, dailyRate: e.target.value })}
                  required
                />
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Product Type <span className="required">*</span></label>
                  <select
                    className="form-control"
                    value={formData.productType}
                    onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                    required
                  >
                    <option value="Towels">Towels</option>
                    <option value="Bedsheets">Bedsheets</option>
                    <option value="Pillow Covers">Pillow Covers</option>
                    <option value="Napkins">Napkins</option>
                    <option value="Curtains">Curtains</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Rate per Product (₹) <span className="required">*</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    placeholder="e.g. 12"
                    value={formData.pieceRate}
                    onChange={(e) => setFormData({ ...formData, pieceRate: e.target.value })}
                    required
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Status <span className="required">*</span></label>
              <select
                className="form-control"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="form-group col-span-3">
              <label className="form-label">Notes</label>
              <input
                type="text"
                className="form-control"
                placeholder="Designation, department or shift notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setFormData(INITIAL_FORM);
                setEditingId(null);
                setIsModalOpen(false);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Update Employee' : 'Save Employee'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Details Modal */}
      <Modal isOpen={!!viewingItem} onClose={() => setViewingItem(null)} title="Employee Profile Details">
        {viewingItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div><strong style={{ color: 'var(--text-muted)' }}>Employee ID:</strong> {viewingItem.empId}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Name:</strong> {viewingItem.name}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Phone:</strong> {viewingItem.phone}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Joining Date:</strong> {formatDate(viewingItem.joinDate)}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Work Type:</strong> {viewingItem.type}</div>
              <div>
                <strong style={{ color: 'var(--text-muted)' }}>Compensation:</strong>{' '}
                {viewingItem.type === 'Day Salary' ? `₹ ${viewingItem.dailyRate} / Day` : `₹ ${viewingItem.pieceRate} / ${viewingItem.productType || 'Piece'}`}
              </div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Current Status:</strong> <StatusBadge status={viewingItem.status} /></div>
            </div>

            {viewingItem.notes && (
              <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)' }}>
                <strong style={{ color: 'var(--text-muted)' }}>Notes:</strong> {viewingItem.notes}
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
                <strong style={{ color: 'var(--text-main)' }}>Created At:</strong> {formatDateTime(viewingItem.createdAt || viewingItem.joinDate)}
              </div>
              <div>
                <strong style={{ color: 'var(--text-main)' }}>Updated At:</strong> {formatDateTime(viewingItem.updatedAt || viewingItem.createdAt || viewingItem.joinDate)}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <button
                type="button"
                className={`btn ${viewingItem.status === 'Active' ? 'btn-danger' : 'btn-success'} btn-sm`}
                onClick={() => {
                  handleToggleStatus(viewingItem);
                  setViewingItem(null);
                }}
              >
                <Power size={14} /> {viewingItem.status === 'Active' ? 'Deactivate Employee' : 'Activate Employee'}
              </button>
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
        title="Delete Employee"
        message="Are you sure you want to remove this employee from the directory?"
      />
    </div>
  );
}

