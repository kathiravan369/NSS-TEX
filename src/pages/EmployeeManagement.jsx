import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Calendar,
  Box,
  Layers,
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
  Trash2,
  Check
} from 'lucide-react';
import MetricCard from '../components/common/MetricCard';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Toast from '../components/common/Toast';
import StatusBadge from '../components/common/StatusBadge';
import { storageService } from '../services/storageService';
import { formatINR, formatDate, formatDateTime } from '../utils/formatters';

export const DEFAULT_SIZE_RATES = [
  { size: 'Large (30 × 60)', rate: 5 },
  { size: 'Medium (27 × 54)', rate: 4 },
  { size: 'Small (24 × 47)', rate: 3 }
];

// Helper to reliably extract work type array from any employee record
export function getEmployeeWorkTypes(emp) {
  if (!emp) return ['Day Salary'];
  if (Array.isArray(emp.workTypes) && emp.workTypes.length > 0) {
    return emp.workTypes;
  }
  const str = `${emp.workType || ''} ${emp.type || ''}`;
  const types = [];
  if (/day/i.test(str)) types.push('Day Salary');
  if (/count/i.test(str)) types.push('Count Salary');
  if (/size/i.test(str)) types.push('Size Salary');
  return types.length > 0 ? types : ['Day Salary'];
}

const INITIAL_FORM = {
  empId: '',
  name: '',
  phone: '',
  joinDate: new Date().toISOString().split('T')[0],
  workTypes: ['Day Salary'], // Array of selected: 'Day Salary', 'Count Salary', 'Size Salary'
  dailyRate: 600,
  productType: 'Towels',
  pieceRate: 12,
  sizeRates: DEFAULT_SIZE_RATES,
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

  // KPI Metrics (Day, Count, Size & Total)
  const metrics = useMemo(() => {
    const total = items.length;
    const daySalary = items.filter(e => getEmployeeWorkTypes(e).includes('Day Salary')).length;
    const countSalary = items.filter(e => getEmployeeWorkTypes(e).includes('Count Salary')).length;
    const sizeSalary = items.filter(e => getEmployeeWorkTypes(e).includes('Size Salary')).length;
    const active = items.filter(e => e.status === 'Active').length;

    return { total, daySalary, countSalary, sizeSalary, active };
  }, [items]);

  // Filtered & Paginated
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.empId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.phone?.includes(searchQuery);

      const empTypes = getEmployeeWorkTypes(item);
      let matchesType = true;
      if (workTypeFilter === 'Day Salary') matchesType = empTypes.includes('Day Salary');
      else if (workTypeFilter === 'Count Salary') matchesType = empTypes.includes('Count Salary');
      else if (workTypeFilter === 'Size Salary') matchesType = empTypes.includes('Size Salary');
      else if (workTypeFilter === 'Multiple Work Types') matchesType = empTypes.length > 1;

      const matchesStatus =
        statusFilter === 'All Status' || item.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [items, searchQuery, workTypeFilter, statusFilter]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const paginatedItems = filteredItems.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // Toggle salary type in multiple selection
  const handleToggleWorkType = (typeKey) => {
    setFormData(prev => {
      const current = prev.workTypes || [];
      let updated;
      if (current.includes(typeKey)) {
        if (current.length === 1) {
          showToast('At least one salary type must remain selected.', 'error');
          return prev;
        }
        updated = current.filter(t => t !== typeKey);
      } else {
        updated = [...current, typeKey];
      }
      return { ...prev, workTypes: updated };
    });
  };

  const handleSelectAllWorkTypes = () => {
    setFormData(prev => ({
      ...prev,
      workTypes: ['Day Salary', 'Count Salary', 'Size Salary']
    }));
  };

  const handleSelectSingleWorkType = (typeKey) => {
    setFormData(prev => ({
      ...prev,
      workTypes: [typeKey]
    }));
  };

  const handleSizeRateChange = (idx, newRate) => {
    const rateVal = Math.max(0, Number(newRate) || 0);
    setFormData(prev => {
      const updated = [...(prev.sizeRates || DEFAULT_SIZE_RATES)];
      if (updated[idx]) {
        updated[idx] = { ...updated[idx], rate: rateVal };
      }
      return { ...prev, sizeRates: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.phone || !formData.joinDate) {
      showToast('Please fill all required employee details.', 'error');
      return;
    }

    if (!formData.workTypes || formData.workTypes.length === 0) {
      showToast('Please select at least one salary type.', 'error');
      return;
    }

    const primaryTypeStr = formData.workTypes.join(', ');

    const payload = {
      ...formData,
      empId: formData.empId || (editingId ? formData.empId : nextEmpId),
      workTypes: formData.workTypes,
      type: primaryTypeStr,
      workType: primaryTypeStr,
      dailyRate: formData.workTypes.includes('Day Salary') ? Number(formData.dailyRate) || 0 : 0,
      pieceRate: formData.workTypes.includes('Count Salary') ? Number(formData.pieceRate) || 0 : 0,
      productType: formData.workTypes.includes('Count Salary') ? (formData.productType || 'Towels') : '',
      sizeRates: formData.workTypes.includes('Size Salary') ? (formData.sizeRates || DEFAULT_SIZE_RATES) : []
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
    const assignedTypes = getEmployeeWorkTypes(item);
    const loadedSizeRates = Array.isArray(item.sizeRates) && item.sizeRates.length > 0
      ? item.sizeRates
      : DEFAULT_SIZE_RATES;

    setFormData({
      empId: item.empId,
      name: item.name,
      phone: item.phone,
      joinDate: item.joinDate ? new Date(item.joinDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      workTypes: assignedTypes,
      dailyRate: item.dailyRate !== undefined ? item.dailyRate : 600,
      productType: item.productType || 'Towels',
      pieceRate: item.pieceRate !== undefined ? item.pieceRate : 12,
      sizeRates: loadedSizeRates,
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
    {
      key: 'type',
      header: 'Work Type',
      render: (val, row) => {
        const types = getEmployeeWorkTypes(row);
        return (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {types.map((t) => {
              if (t === 'Day Salary') {
                return (
                  <span
                    key={t}
                    style={{
                      padding: '2px 7px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Calendar size={11} /> Day
                  </span>
                );
              }
              if (t === 'Count Salary') {
                return (
                  <span
                    key={t}
                    style={{
                      padding: '2px 7px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      backgroundColor: '#f5f3ff',
                      color: '#7c3aed',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Box size={11} /> Count
                  </span>
                );
              }
              return (
                <span
                  key={t}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    backgroundColor: '#e0f2fe',
                    color: '#0284c7',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Layers size={11} /> Size
                </span>
              );
            })}
          </div>
        );
      }
    },
    {
      key: 'productType',
      header: 'Product / Details',
      render: (val, row) => {
        const types = getEmployeeWorkTypes(row);
        const details = [];
        if (types.includes('Count Salary')) details.push(row.productType || 'Towels');
        if (types.includes('Size Salary')) details.push('Towel Sizes');
        if (types.includes('Day Salary') && details.length === 0) return 'General';
        return details.join(', ') || '-';
      }
    },
    {
      key: 'salaryRate',
      header: 'Salary Rate',
      render: (val, row) => {
        const types = getEmployeeWorkTypes(row);
        const parts = [];
        if (types.includes('Day Salary')) {
          parts.push(`₹ ${row.dailyRate || 600} / Day`);
        }
        if (types.includes('Count Salary')) {
          parts.push(`₹ ${row.pieceRate || 12} / Pc`);
        }
        if (types.includes('Size Salary')) {
          const lRate = row.sizeRates?.find(s => s.size?.toLowerCase().includes('large'))?.rate || 5;
          const mRate = row.sizeRates?.find(s => s.size?.toLowerCase().includes('medium'))?.rate || 4;
          const sRate = row.sizeRates?.find(s => s.size?.toLowerCase().includes('small'))?.rate || 3;
          parts.push(`Size: L:₹${lRate} M:₹${mRate} S:₹${sRate}`);
        }
        return (
          <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {parts.map((p, idx) => (
              <span key={idx} style={{ fontWeight: 600, color: '#334155' }}>
                {p}
              </span>
            ))}
          </div>
        );
      }
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
          <p className="page-subtitle">Manage employee profiles and assign Day, Count, and Size salary compensation methods</p>
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

      {/* KPI Cards: Day, Count, Size, Active, Total */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <MetricCard
          title="Total Employees"
          value={metrics.total}
          trend="Total"
          trendType="up"
          icon={Users}
          iconBg="#eff6ff"
          iconColor="#2563eb"
        />
        <MetricCard
          title="Day Salary"
          value={metrics.daySalary}
          trend="Daily Wage"
          trendType="up"
          icon={Calendar}
          iconBg="#ecfdf5"
          iconColor="#059669"
        />
        <MetricCard
          title="Count Salary"
          value={metrics.countSalary}
          trend="Piece Count"
          trendType="up"
          icon={Box}
          iconBg="#f5f3ff"
          iconColor="#7c3aed"
        />
        <MetricCard
          title="Size Salary"
          value={metrics.sizeSalary}
          trend="Size Rates"
          trendType="up"
          icon={Layers}
          iconBg="#e0f2fe"
          iconColor="#0284c7"
        />
        <MetricCard
          title="Active Employees"
          value={metrics.active}
          trend="Available"
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
            <h3 className="card-title">Employee Directory</h3>
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
              style={{ width: '150px', height: '34px', fontSize: '0.78rem' }}
              value={workTypeFilter}
              onChange={(e) => {
                setWorkTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All Work Types">All Work Types</option>
              <option value="Day Salary">Day Salary</option>
              <option value="Count Salary">Count Salary</option>
              <option value="Size Salary">Size Salary</option>
              <option value="Multiple Work Types">Multiple Work Types</option>
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
        maxWidth="860px"
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

            {/* Work Type Multi-Selector Cards */}
            <div className="form-group col-span-3">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                  Assigned Salary Types (Multiple Selectable) <span className="required">*</span>
                </label>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                    onClick={handleSelectAllWorkTypes}
                  >
                    Select All (Day + Count + Size)
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                    onClick={() => handleSelectSingleWorkType('Day Salary')}
                  >
                    Day Only
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                    onClick={() => handleSelectSingleWorkType('Count Salary')}
                  >
                    Count Only
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                    onClick={() => handleSelectSingleWorkType('Size Salary')}
                  >
                    Size Only
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                {/* 1. Day Salary Card */}
                <div
                  onClick={() => handleToggleWorkType('Day Salary')}
                  style={{
                    border: formData.workTypes.includes('Day Salary')
                      ? '2px solid #2563eb'
                      : '1px solid var(--border-color)',
                    backgroundColor: formData.workTypes.includes('Day Salary') ? '#eff6ff' : '#ffffff',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.65rem 0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    position: 'relative',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      border: formData.workTypes.includes('Day Salary') ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      backgroundColor: formData.workTypes.includes('Day Salary') ? '#2563eb' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      flexShrink: 0
                    }}
                  >
                    {formData.workTypes.includes('Day Salary') && <Check size={14} />}
                  </div>
                  <Calendar size={18} color="#2563eb" />
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e3a8a' }}>Day Salary</div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Daily wage rate</div>
                  </div>
                </div>

                {/* 2. Count Salary Card */}
                <div
                  onClick={() => handleToggleWorkType('Count Salary')}
                  style={{
                    border: formData.workTypes.includes('Count Salary')
                      ? '2px solid #7c3aed'
                      : '1px solid var(--border-color)',
                    backgroundColor: formData.workTypes.includes('Count Salary') ? '#f5f3ff' : '#ffffff',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.65rem 0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    position: 'relative',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      border: formData.workTypes.includes('Count Salary') ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                      backgroundColor: formData.workTypes.includes('Count Salary') ? '#7c3aed' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      flexShrink: 0
                    }}
                  >
                    {formData.workTypes.includes('Count Salary') && <Check size={14} />}
                  </div>
                  <Box size={18} color="#7c3aed" />
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#581c87' }}>Count Salary</div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Fixed price per piece</div>
                  </div>
                </div>

                {/* 3. Size Salary Card */}
                <div
                  onClick={() => handleToggleWorkType('Size Salary')}
                  style={{
                    border: formData.workTypes.includes('Size Salary')
                      ? '2px solid #0284c7'
                      : '1px solid var(--border-color)',
                    backgroundColor: formData.workTypes.includes('Size Salary') ? '#e0f2fe' : '#ffffff',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.65rem 0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    position: 'relative',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      border: formData.workTypes.includes('Size Salary') ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      backgroundColor: formData.workTypes.includes('Size Salary') ? '#0284c7' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      flexShrink: 0
                    }}
                  >
                    {formData.workTypes.includes('Size Salary') && <Check size={14} />}
                  </div>
                  <Layers size={18} color="#0284c7" />
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0369a1' }}>Size Salary</div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Towel size rates</div>
                  </div>
                </div>
              </div>
            </div>

            {/* DYNAMIC RATE PANELS BASED ON SELECTED WORK TYPES */}

            {/* Day Salary Configuration */}
            {formData.workTypes.includes('Day Salary') && (
              <div
                className="col-span-3"
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderLeft: '4px solid #2563eb',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Calendar size={16} color="#2563eb" />
                  <strong style={{ fontSize: '0.82rem', color: '#1e3a8a' }}>Day Salary Rate Setting</strong>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Daily Salary Rate (₹ / Day) <span className="required">*</span></label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    placeholder="e.g. 600"
                    value={formData.dailyRate}
                    onChange={(e) => setFormData({ ...formData, dailyRate: e.target.value })}
                    required
                    style={{ maxWidth: '240px' }}
                  />
                </div>
              </div>
            )}

            {/* Count Salary Configuration */}
            {formData.workTypes.includes('Count Salary') && (
              <div
                className="col-span-3"
                style={{
                  backgroundColor: '#fbfbfe',
                  border: '1px solid #ede9fe',
                  borderLeft: '4px solid #7c3aed',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Box size={16} color="#7c3aed" />
                  <strong style={{ fontSize: '0.82rem', color: '#581c87' }}>Count Salary Rate Setting</strong>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
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
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Rate per Piece (₹) <span className="required">*</span></label>
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
                </div>
              </div>
            )}

            {/* Size Salary Configuration */}
            {formData.workTypes.includes('Size Salary') && (
              <div
                className="col-span-3"
                style={{
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderLeft: '4px solid #0284c7',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Layers size={16} color="#0284c7" />
                  <strong style={{ fontSize: '0.82rem', color: '#0369a1' }}>Size Salary Rates Setting</strong>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>(Large ₹5, Medium ₹4, Small ₹3 default rates)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  {(formData.sizeRates || DEFAULT_SIZE_RATES).map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: '#ffffff',
                        padding: '0.5rem 0.65rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid #cbd5e1'
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        {item.size}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          className="form-control"
                          style={{ height: '32px', fontSize: '0.82rem' }}
                          value={item.rate}
                          onChange={(e) => handleSizeRateChange(idx, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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

            <div className="form-group col-span-2">
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
              <div>
                <strong style={{ color: 'var(--text-muted)' }}>Work Type:</strong>{' '}
                {getEmployeeWorkTypes(viewingItem).join(', ')}
              </div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Current Status:</strong> <StatusBadge status={viewingItem.status} /></div>
            </div>

            {/* Compensation breakdown */}
            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
              <strong style={{ fontSize: '0.85rem', color: '#1e293b', display: 'block', marginBottom: '0.4rem' }}>
                Compensation Configuration:
              </strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {getEmployeeWorkTypes(viewingItem).includes('Day Salary') && (
                  <div>• <strong>Day Salary:</strong> ₹ {viewingItem.dailyRate || 600} / Day</div>
                )}
                {getEmployeeWorkTypes(viewingItem).includes('Count Salary') && (
                  <div>• <strong>Count Salary:</strong> ₹ {viewingItem.pieceRate || 12} / {viewingItem.productType || 'Piece'}</div>
                )}
                {getEmployeeWorkTypes(viewingItem).includes('Size Salary') && (
                  <div>
                    • <strong>Size Salary:</strong>{' '}
                    {(viewingItem.sizeRates && viewingItem.sizeRates.length > 0 ? viewingItem.sizeRates : DEFAULT_SIZE_RATES)
                      .map(s => `${s.size}: ₹${s.rate}`)
                      .join(' | ')}
                  </div>
                )}
              </div>
            </div>

            {viewingItem.notes && (
              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)' }}>
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
