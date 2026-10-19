import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Download,
  Printer,
  RotateCcw,
  Eye,
  Edit2,
  Trash2,
  AlertTriangle,
  Building2,
  CreditCard,
  MapPin,
  FileText,
  Phone,
  Mail,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Tag
} from 'lucide-react';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Toast from '../components/common/Toast';
import StatusBadge from '../components/common/StatusBadge';
import DateRangePicker from '../components/common/DateRangePicker';
import { storageService } from '../services/storageService';
import { api } from '../services/api';
import { formatINR, formatDate } from '../utils/formatters';

const INITIAL_FORM = {
  customerId: '',
  name: '',
  customerType: 'Business',
  phone: '',
  alternatePhone: '',
  email: '',
  companyName: '',
  gstin: '',
  pan: '',
  customerCategory: 'Regular',
  billingAddress: {
    addressLine: '',
    city: '',
    state: 'Tamil Nadu',
    pincode: '',
    country: 'India'
  },
  shippingAddress: {
    addressLine: '',
    city: '',
    state: 'Tamil Nadu',
    pincode: '',
    country: 'India'
  },
  sameAsBilling: true,
  openingBalance: 0,
  openingBalanceType: 'Debit',
  creditLimit: 200000,
  paymentTerms: '30 Days',
  priceList: 'Standard',
  notes: '',
  tags: [],
  status: 'Active'
};

export default function CustomerDetails() {
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const [toast, setToast] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [nextSuggestedId, setNextSuggestedId] = useState('CUS-001');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const liveData = await storageService.fetchLiveCollection('customers');
      setCustomers(liveData || []);

      // Get next customer ID
      try {
        const idRes = await api.sales.customers.getNextId();
        if (idRes && idRes.nextId) {
          setNextSuggestedId(idRes.nextId);
        }
      } catch (e) {
        // Fallback calculation
        const max = (liveData || []).reduce((acc, c) => {
          const num = parseInt((c.customerId || '').replace(/\D/g, '') || '0', 10);
          return Math.max(acc, num);
        }, 0);
        setNextSuggestedId(`CUS-${String(max + 1).padStart(3, '0')}`);
      }
    } catch (err) {
      console.warn('Error loading customers:', err.message);
      const cached = storageService.getCollection('customers');
      setCustomers(cached || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered customer records
  const filteredCustomers = useMemo(() => {
    return customers.filter((cust) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        (cust.customerId && cust.customerId.toLowerCase().includes(q)) ||
        (cust.name && cust.name.toLowerCase().includes(q)) ||
        (cust.companyName && cust.companyName.toLowerCase().includes(q)) ||
        (cust.phone && cust.phone.includes(q)) ||
        (cust.gstin && cust.gstin.toLowerCase().includes(q)) ||
        (cust.billingAddress?.city && cust.billingAddress.city.toLowerCase().includes(q));

      const matchesType =
        customerTypeFilter === 'All' ||
        cust.customerType === customerTypeFilter;

      const matchesStatus =
        statusFilter === 'All' ||
        cust.status === statusFilter;

      let matchesDate = true;
      const custDate = (cust.createdAt ? cust.createdAt.split('T')[0] : '') || (cust.created_at ? cust.created_at.split('T')[0] : '');
      if (startDate) {
        matchesDate = matchesDate && custDate >= startDate;
      }
      if (endDate) {
        matchesDate = matchesDate && custDate <= endDate;
      }

      return matchesSearch && matchesType && matchesStatus && matchesDate;
    });
  }, [customers, searchQuery, customerTypeFilter, statusFilter, startDate, endDate]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage) || 1;
  const paginatedCustomers = filteredCustomers.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setCustomerTypeFilter('All');
    setStatusFilter('All');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({
      ...INITIAL_FORM,
      customerId: nextSuggestedId
    });
    setDuplicateWarning(null);
    setIsModalOpen(true);
  };

  const handleEdit = (customer) => {
    setEditingId(customer._id || customer.id);
    setFormData({
      customerId: customer.customerId || '',
      name: customer.name || '',
      customerType: customer.customerType || 'Business',
      phone: customer.phone || '',
      alternatePhone: customer.alternatePhone || '',
      email: customer.email || '',
      companyName: customer.companyName || '',
      gstin: customer.gstin || '',
      pan: customer.pan || '',
      customerCategory: customer.customerCategory || 'Regular',
      billingAddress: {
        addressLine: customer.billingAddress?.addressLine || '',
        city: customer.billingAddress?.city || '',
        state: customer.billingAddress?.state || 'Tamil Nadu',
        pincode: customer.billingAddress?.pincode || '',
        country: customer.billingAddress?.country || 'India'
      },
      shippingAddress: {
        addressLine: customer.shippingAddress?.addressLine || '',
        city: customer.shippingAddress?.city || '',
        state: customer.shippingAddress?.state || 'Tamil Nadu',
        pincode: customer.shippingAddress?.pincode || '',
        country: customer.shippingAddress?.country || 'India'
      },
      sameAsBilling: customer.sameAsBilling !== undefined ? customer.sameAsBilling : true,
      openingBalance: customer.openingBalance || 0,
      openingBalanceType: customer.openingBalanceType || 'Debit',
      creditLimit: customer.creditLimit !== undefined ? customer.creditLimit : 200000,
      paymentTerms: customer.paymentTerms || '30 Days',
      priceList: customer.priceList || 'Standard',
      notes: customer.notes || '',
      tags: Array.isArray(customer.tags) ? customer.tags : [],
      status: customer.status || 'Active'
    });
    setDuplicateWarning(null);
    setIsModalOpen(true);
  };

  const handleView = async (customer) => {
    try {
      const res = await api.sales.customers.getById(customer._id || customer.id || customer.customerId);
      if (res && res.success && res.data) {
        setViewingCustomer(res.data);
      } else {
        setViewingCustomer(customer);
      }
    } catch {
      setViewingCustomer(customer);
    }
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim();
      if (val && !formData.tags.includes(val)) {
        setFormData({ ...formData, tags: [...formData.tags, val] });
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(t => t !== tagToRemove)
    });
  };

  const handleSubmit = async (e, forceSave = false) => {
    if (e) e.preventDefault();

    if (!formData.name.trim()) {
      showToast('Please enter customer name.', 'error');
      return;
    }
    if (!formData.phone.trim()) {
      showToast('Please enter phone number.', 'error');
      return;
    }

    // Phone format check
    const cleanPhone = formData.phone.replace(/[\s\-\+]/g, '');
    if (!/^\d{10,12}$/.test(cleanPhone)) {
      showToast('Please enter a valid 10-digit mobile number.', 'error');
      return;
    }

    // GSTIN format check
    if (formData.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(formData.gstin.trim())) {
      showToast('Invalid GSTIN format (e.g. 33ABCDE1234F1Z5)', 'error');
      return;
    }

    // Duplicate check on creation if not force saving
    if (!editingId && !forceSave) {
      try {
        const dupRes = await api.sales.customers.checkDuplicate({
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          gstin: formData.gstin.trim()
        });

        if (dupRes && dupRes.isDuplicate) {
          setDuplicateWarning({
            field: dupRes.duplicateField,
            existing: dupRes.existingCustomer
          });
          return;
        }
      } catch (err) {
        console.warn('Duplicate check check failed:', err.message);
      }
    }

    const payload = {
      ...formData,
      customerId: formData.customerId || nextSuggestedId,
      shippingAddress: formData.sameAsBilling ? { ...formData.billingAddress } : formData.shippingAddress
    };

    try {
      if (editingId) {
        await storageService.updateItem('customers', editingId, payload);
        showToast('Customer profile updated successfully.');
      } else {
        await storageService.addItem('customers', payload);
        showToast('New customer registered successfully.');
      }

      setIsModalOpen(false);
      setEditingId(null);
      setFormData(INITIAL_FORM);
      setDuplicateWarning(null);
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to save customer', 'error');
    }
  };

  const handleToggleStatus = async (customer) => {
    const newStatus = customer.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.sales.customers.patchStatus(customer._id || customer.id, newStatus);
      showToast(`Customer status updated to ${newStatus}.`);
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deletingCustomer) return;
    try {
      const res = await api.sales.customers.delete(deletingCustomer._id || deletingCustomer.id);
      showToast(res.message || 'Customer deleted successfully.');
      setDeletingCustomer(null);
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to delete customer', 'error');
    }
  };

  const handleExportCSV = () => {
    storageService.exportToCSV('Customer_Directory', filteredCustomers, columns);
    showToast('Exported Customer directory to Excel.');
  };

  const handleExportPDF = () => {
    storageService.exportToPDF('Customer_Directory', filteredCustomers, columns);
  };

  const columns = [
    {
      key: 'id',
      header: 'S.No.',
      width: '60px',
      render: (val, row, idx) => (page - 1) * itemsPerPage + idx + 1
    },
    {
      key: 'customerId',
      header: 'Customer ID',
      width: '120px',
      render: (val, row) => (
        <span
          style={{ fontWeight: 700, color: 'var(--primary-600)', cursor: 'pointer' }}
          onClick={() => handleView(row)}
          title="Click to view customer details"
        >
          {val || `CUS-${row.id}`}
        </span>
      )
    },
    {
      key: 'name',
      header: 'Customer Name',
      render: (val, row) => (
        <div>
          <div
            style={{ fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
            onClick={() => handleView(row)}
          >
            {val}
          </div>
          {row.companyName && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {row.companyName}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (val, row) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span>{val}</span>
          {row.alternatePhone && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Alt: {row.alternatePhone}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'gstin',
      header: 'GSTIN',
      render: (val) => val ? (
        <code style={{ fontSize: '0.78rem', color: '#1e293b', fontWeight: 600, background: '#f8fafc', padding: '2px 6px', borderRadius: '4px' }}>
          {val}
        </code>
      ) : (
        <span style={{ color: 'var(--text-light)' }}>-</span>
      )
    },
    {
      key: 'city',
      header: 'City',
      render: (val, row) => row.billingAddress?.city || val || '-'
    },
    {
      key: 'status',
      header: 'Status',
      width: '90px',
      render: (val) => (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 10px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 600,
            backgroundColor: val === 'Active' ? '#dcfce7' : '#fee2e2',
            color: val === 'Active' ? '#15803d' : '#b91c1c'
          }}
        >
          {val || 'Active'}
        </span>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header matching screenshot */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="page-title" style={{ fontSize: '1.35rem', fontWeight: 700 }}>Customer Details</h2>
          <p className="page-subtitle" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Manage all customer information, contact profiles, addresses, GSTIN and opening balances
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
            <Download size={14} /> Export Excel
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportPDF}>
            <Printer size={14} /> Export PDF
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenAddModal}>
            <Plus size={15} /> + Add Customer
          </button>
        </div>
      </div>

      {/* Search & Filters Toolbar */}
      <div className="erp-card" style={{ padding: '0.85rem 1.15rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ flex: 1, minWidth: '260px', height: '36px' }}>
            <Search size={15} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search by customer name, phone, GSTIN..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <select
              className="form-control"
              style={{ width: '160px', height: '36px', fontSize: '0.8125rem' }}
              value={customerTypeFilter}
              onChange={(e) => {
                setCustomerTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All">Customer Type</option>
              <option value="Business">Business</option>
              <option value="Individual">Individual</option>
            </select>

            <select
              className="form-control"
              style={{ width: '140px', height: '36px', fontSize: '0.8125rem' }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All">Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
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

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ height: '36px', padding: '0 0.85rem' }}
              onClick={handleResetFilters}
              title="Reset all search filters"
            >
              <RotateCcw size={14} /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="erp-card">
        <DataTable
          columns={columns}
          data={paginatedCustomers}
          onRowClick={(row) => handleView(row)}
          onView={(row) => handleView(row)}
          onEdit={(row) => handleEdit(row)}
          onDelete={(row) => setDeletingCustomer(row)}
          page={page}
          totalPages={totalPages}
          totalItems={filteredCustomers.length}
          itemsPerPage={itemsPerPage}
          onPageChange={(newPage) => setPage(newPage)}
          onItemsPerPageChange={(newSize) => {
            setItemsPerPage(newSize);
            setPage(1);
          }}
        />
      </div>

      {/* Add / Edit Customer Modal (matches Reference Screenshot panel 1) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingId(null);
          setDuplicateWarning(null);
        }}
        title={editingId ? 'Edit Customer Profile' : 'Add New Customer'}
        maxWidth="920px"
      >
        <form onSubmit={(e) => handleSubmit(e, false)} style={{ width: '100%' }}>
          {/* Duplicate Warning Alert */}
          {duplicateWarning && (
            <div
              style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}
            >
              <AlertTriangle color="#d97706" size={20} style={{ marginTop: '2px', flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: '0.82rem', color: '#92400e' }}>
                <div style={{ fontWeight: 700, marginBottom: '2px' }}>Potential Duplicate Customer Detected</div>
                <div>
                  A customer with this {duplicateWarning.field} already exists: <strong>"{duplicateWarning.existing?.name}"</strong> ({duplicateWarning.existing?.customerId}).
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ backgroundColor: '#d97706', borderColor: '#d97706', fontSize: '0.75rem' }}
                    onClick={(e) => handleSubmit(e, true)}
                  >
                    Confirm & Proceed Anyway
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => setDuplicateWarning(null)}
                  >
                    Go Back & Edit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Form Section 1: Basic Details */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary-700)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-600)' }} />
              Basic Details
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Customer ID</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.customerId || nextSuggestedId}
                  readOnly
                  style={{ backgroundColor: '#f8fafc', fontWeight: 600 }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Customer Name <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Sri Amma Textiles"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Customer Type <span className="required">*</span></label>
                <select
                  className="form-control"
                  value={formData.customerType}
                  onChange={(e) => setFormData({ ...formData, customerType: e.target.value })}
                >
                  <option value="Business">Business</option>
                  <option value="Individual">Individual</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="10-digit mobile"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Alternate Phone</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Optional landline / alt"
                  value={formData.alternatePhone}
                  onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 3' }}>
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="accounts@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Form Section 2: Company Details */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary-700)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-600)' }} />
              Company Details
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Registered enterprise name"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">GSTIN</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 33ABCDE1234F1Z5"
                  maxLength={15}
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">PAN</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. ABCDE1234F"
                  maxLength={10}
                  value={formData.pan}
                  onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Customer Category</label>
                <select
                  className="form-control"
                  value={formData.customerCategory}
                  onChange={(e) => setFormData({ ...formData, customerCategory: e.target.value })}
                >
                  <option value="Regular">Regular</option>
                  <option value="Wholesale">Wholesale</option>
                  <option value="Retail">Retail</option>
                  <option value="Distributor">Distributor</option>
                </select>
              </div>
            </div>
          </div>

          {/* Form Section 3: Billing Address */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary-700)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-600)' }} />
              Billing Address
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Address Line</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Door No, Street name, Area"
                  value={formData.billingAddress.addressLine}
                  onChange={(e) => setFormData({
                    ...formData,
                    billingAddress: { ...formData.billingAddress, addressLine: e.target.value }
                  })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Coimbatore"
                  value={formData.billingAddress.city}
                  onChange={(e) => setFormData({
                    ...formData,
                    billingAddress: { ...formData.billingAddress, city: e.target.value }
                  })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Tamil Nadu"
                  value={formData.billingAddress.state}
                  onChange={(e) => setFormData({
                    ...formData,
                    billingAddress: { ...formData.billingAddress, state: e.target.value }
                  })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">PIN Code</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="641001"
                  maxLength={6}
                  value={formData.billingAddress.pincode}
                  onChange={(e) => setFormData({
                    ...formData,
                    billingAddress: { ...formData.billingAddress, pincode: e.target.value }
                  })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Country</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.billingAddress.country}
                  readOnly
                  style={{ backgroundColor: '#f8fafc' }}
                />
              </div>
            </div>
          </div>

          {/* Form Section 4: Shipping Address */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary-700)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-600)' }} />
                Shipping Address
              </h4>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600, color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={formData.sameAsBilling}
                  onChange={(e) => setFormData({ ...formData, sameAsBilling: e.target.checked })}
                  style={{ accentColor: 'var(--primary-600)', width: '15px', height: '15px' }}
                />
                Same as Billing Address
              </label>
            </div>

            {!formData.sameAsBilling && (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Address Line</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Delivery warehouse or location"
                    value={formData.shippingAddress.addressLine}
                    onChange={(e) => setFormData({
                      ...formData,
                      shippingAddress: { ...formData.shippingAddress, addressLine: e.target.value }
                    })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="City"
                    value={formData.shippingAddress.city}
                    onChange={(e) => setFormData({
                      ...formData,
                      shippingAddress: { ...formData.shippingAddress, city: e.target.value }
                    })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="State"
                    value={formData.shippingAddress.state}
                    onChange={(e) => setFormData({
                      ...formData,
                      shippingAddress: { ...formData.shippingAddress, state: e.target.value }
                    })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">PIN Code</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="PIN Code"
                    value={formData.shippingAddress.pincode}
                    onChange={(e) => setFormData({
                      ...formData,
                      shippingAddress: { ...formData.shippingAddress, pincode: e.target.value }
                    })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.shippingAddress.country}
                    readOnly
                    style={{ backgroundColor: '#f8fafc' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Form Section 5: Account Details */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary-700)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-600)' }} />
              Account Details
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Opening Balance</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  placeholder="0.00"
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({ ...formData, openingBalance: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select
                  className="form-control"
                  value={formData.openingBalanceType}
                  onChange={(e) => setFormData({ ...formData, openingBalanceType: e.target.value })}
                >
                  <option value="Debit">Debit</option>
                  <option value="Credit">Credit</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Credit Limit (₹)</label>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  className="form-control"
                  value={formData.creditLimit}
                  onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Terms</label>
                <select
                  className="form-control"
                  value={formData.paymentTerms}
                  onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                >
                  <option value="Immediate">Immediate</option>
                  <option value="15 Days">15 Days</option>
                  <option value="30 Days">30 Days</option>
                  <option value="45 Days">45 Days</option>
                  <option value="60 Days">60 Days</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Price List</label>
                <select
                  className="form-control"
                  value={formData.priceList}
                  onChange={(e) => setFormData({ ...formData, priceList: e.target.value })}
                >
                  <option value="Standard">Standard</option>
                  <option value="Wholesale">Wholesale</option>
                  <option value="Special">Special</option>
                </select>
              </div>
            </div>
          </div>

          {/* Form Section 6: Additional */}
          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary-700)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-600)' }} />
              Additional
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Special instructions or background remarks"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tags (press Enter to add)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 8px', minHeight: '38px', backgroundColor: '#ffffff' }}>
                  {formData.tags.map(t => (
                    <span
                      key={t}
                      style={{
                        backgroundColor: '#eff6ff',
                        color: '#2563eb',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {t}
                      <span
                        style={{ cursor: 'pointer', fontWeight: 700 }}
                        onClick={() => handleRemoveTag(t)}
                      >
                        ×
                      </span>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder={formData.tags.length === 0 ? "e.g. VIP, Export, Terry" : ""}
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    style={{ border: 'none', outline: 'none', flex: 1, minWidth: '80px', fontSize: '0.8125rem' }}
                  />
                </div>
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label className="form-label">Status</label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '6px' }}>
                  <input
                    type="checkbox"
                    checked={formData.status === 'Active'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 'Active' : 'Inactive' })}
                    style={{ width: '18px', height: '18px', accentColor: '#16a34a' }}
                  />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: formData.status === 'Active' ? '#15803d' : '#94a3b8' }}>
                    {formData.status === 'Active' ? 'Active' : 'Inactive'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsModalOpen(false);
                setEditingId(null);
                setDuplicateWarning(null);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Update Customer' : 'Save Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Customer Details Modal */}
      {viewingCustomer && (
        <Modal
          isOpen={!!viewingCustomer}
          onClose={() => setViewingCustomer(null)}
          title={`Customer Profile — ${viewingCustomer.name}`}
          maxWidth="820px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Quick Profile Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.15rem'
                  }}
                >
                  {viewingCustomer.name?.substring(0, 2).toUpperCase() || 'CU'}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{viewingCustomer.name}</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    ID: <strong>{viewingCustomer.customerId}</strong> • Category: {viewingCustomer.customerCategory || 'Regular'} • Type: {viewingCustomer.customerType || 'Business'}
                  </div>
                </div>
              </div>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: viewingCustomer.status === 'Active' ? '#dcfce7' : '#fee2e2',
                  color: viewingCustomer.status === 'Active' ? '#15803d' : '#b91c1c'
                }}
              >
                {viewingCustomer.status}
              </span>
            </div>

            {/* Financial Overview Metrics */}
            {viewingCustomer.stats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: '#f1f5f9', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Total Invoices</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{viewingCustomer.stats.totalInvoices}</div>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: '#eff6ff', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#2563eb' }}>Total Billed</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1d4ed8' }}>{formatINR(viewingCustomer.stats.totalBilled)}</div>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: '#ecfdf5', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#059669' }}>Total Paid</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#047857' }}>{formatINR(viewingCustomer.stats.totalPaid)}</div>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#dc2626' }}>Balance Due</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#b91c1c' }}>{formatINR(viewingCustomer.stats.outstandingBalance)}</div>
                </div>
              </div>
            )}

            {/* Information Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.85rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={14} /> Contact Details
                </div>
                <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><strong>Phone:</strong> {viewingCustomer.phone}</div>
                  {viewingCustomer.alternatePhone && <div><strong>Alt Phone:</strong> {viewingCustomer.alternatePhone}</div>}
                  {viewingCustomer.email && <div><strong>Email:</strong> {viewingCustomer.email}</div>}
                  <div><strong>GSTIN:</strong> {viewingCustomer.gstin || 'Unregistered'}</div>
                  {viewingCustomer.pan && <div><strong>PAN:</strong> {viewingCustomer.pan}</div>}
                </div>
              </div>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.85rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={14} /> Account Terms
                </div>
                <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><strong>Credit Limit:</strong> {formatINR(viewingCustomer.creditLimit || 0)}</div>
                  <div><strong>Payment Terms:</strong> {viewingCustomer.paymentTerms || '30 Days'}</div>
                  <div><strong>Price List:</strong> {viewingCustomer.priceList || 'Standard'}</div>
                  <div><strong>Opening Balance:</strong> {formatINR(viewingCustomer.openingBalance || 0)} ({viewingCustomer.openingBalanceType || 'Debit'})</div>
                </div>
              </div>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.85rem', gridColumn: 'span 2' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} /> Billing & Shipping Addresses
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.8rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#475569' }}>Billing Address:</div>
                    <div>{viewingCustomer.billingAddress?.addressLine || '-'}</div>
                    <div>{viewingCustomer.billingAddress?.city}, {viewingCustomer.billingAddress?.state} - {viewingCustomer.billingAddress?.pincode}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#475569' }}>Shipping Address:</div>
                    {viewingCustomer.sameAsBilling ? (
                      <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Same as Billing Address</div>
                    ) : (
                      <>
                        <div>{viewingCustomer.shippingAddress?.addressLine || '-'}</div>
                        <div>{viewingCustomer.shippingAddress?.city}, {viewingCustomer.shippingAddress?.state} - {viewingCustomer.shippingAddress?.pincode}</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const cust = viewingCustomer;
                  setViewingCustomer(null);
                  handleEdit(cust);
                }}
              >
                <Edit2 size={13} /> Edit Customer
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setViewingCustomer(null)}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete / Deactivate Customer Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deletingCustomer}
        onClose={() => setDeletingCustomer(null)}
        onConfirm={handleDelete}
        title="Deactivate / Delete Customer"
        message={
          deletingCustomer ? (
            <div>
              Are you sure you want to remove customer <strong>"{deletingCustomer.name}"</strong>?
              <p style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Note: Any historical invoices and audit logs belonging to this customer will remain safely preserved in the database.
              </p>
            </div>
          ) : ''
        }
      />
    </div>
  );
}
