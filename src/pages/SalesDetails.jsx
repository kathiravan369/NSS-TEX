import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  TrendingUp,
  Download,
  Printer,
  Search,
  RotateCcw,
  Eye,
  Edit2,
  Trash2,
  CreditCard,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  Users,
  Package,
  FileSpreadsheet,
  DollarSign,
  AlertTriangle,
  Receipt,
  FileText
} from 'lucide-react';
import MetricCard from '../components/common/MetricCard';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Toast from '../components/common/Toast';
import DateRangePicker from '../components/common/DateRangePicker';
import { storageService } from '../services/storageService';
import { api } from '../services/api';
import { formatINR, formatDate } from '../utils/formatters';
import { SALESPERSON_LIST } from './CreateInvoice';

export default function SalesDetails() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions', 'customer', 'product', 'periodic', 'outstanding', 'gst'
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerFilter, setCustomerFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
  const [salespersonFilter, setSalespersonFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Periodic report granularity
  const [periodGranularity, setPeriodGranularity] = useState('monthly'); // 'daily', 'weekly', 'monthly'

  // Reports data states
  const [customerWiseData, setCustomerWiseData] = useState([]);
  const [productWiseData, setProductWiseData] = useState([]);
  const [periodicData, setPeriodicData] = useState([]);
  const [outstandingData, setOutstandingData] = useState([]);
  const [gstSummary, setGstSummary] = useState(null);

  // Payment Modal
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentRef, setPaymentRef] = useState('');

  // Delete Invoice
  const [deletingInvoice, setDeletingInvoice] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (customerFilter !== 'All') params.customerId = customerFilter;
      if (statusFilter !== 'All') params.invoiceStatus = statusFilter;
      if (paymentStatusFilter !== 'All') params.paymentStatus = paymentStatusFilter;

      const [invData, custData, custWiseRes, prodWiseRes, gstRes, outRes] = await Promise.all([
        storageService.fetchLiveCollection('invoices', params),
        storageService.fetchLiveCollection('customers'),
        api.sales.reports.getCustomerWise(params).catch(() => ({ data: [] })),
        api.sales.reports.getProductWise(params).catch(() => ({ data: [] })),
        api.sales.reports.getGST(params).catch(() => ({ data: {} })),
        api.sales.reports.getOutstanding().catch(() => ({ data: [] }))
      ]);

      setInvoices(invData || []);
      setCustomers(custData || []);
      setCustomerWiseData(custWiseRes?.data || []);
      setProductWiseData(prodWiseRes?.data || []);
      setGstSummary(gstRes?.data || {});
      setOutstandingData(outRes?.data || []);

      // Also load periodic data
      try {
        const periodRes = await api.sales.reports.getPeriodic({ ...params, period: periodGranularity });
        setPeriodicData(periodRes?.data || []);
      } catch (e) {
        setPeriodicData([]);
      }
    } catch (err) {
      console.warn('Error loading sales data:', err.message);
      setInvoices(storageService.getCollection('invoices') || []);
      setCustomers(storageService.getCollection('customers') || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, customerFilter, statusFilter, paymentStatusFilter, periodGranularity]);

  // Filtered Invoices for Transactions Table
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        (inv.invoiceNo && inv.invoiceNo.toLowerCase().includes(q)) ||
        (inv.customerName && inv.customerName.toLowerCase().includes(q)) ||
        (inv.referenceNo && inv.referenceNo.toLowerCase().includes(q));

      const matchesSalesperson =
        salespersonFilter === 'All' ||
        inv.salesperson === salespersonFilter;

      return matchesSearch && matchesSalesperson;
    });
  }, [invoices, searchQuery, salespersonFilter]);

  // Dynamic KPI summary metrics
  const summary = useMemo(() => {
    const list = filteredInvoices;
    const totalSales = list.reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0);
    const amountReceived = list.reduce((sum, i) => sum + (Number(i.amountPaid) || 0), 0);
    const outstanding = list.reduce((sum, i) => sum + (Number(i.balanceDue) || 0), 0);
    const invoiceCount = list.length;

    return { totalSales, amountReceived, outstanding, invoiceCount };
  }, [filteredInvoices]);

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage) || 1;
  const paginatedInvoices = filteredInvoices.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setCustomerFilter('All');
    setStatusFilter('All');
    setPaymentStatusFilter('All');
    setSalespersonFilter('All');
    setSearchQuery('');
    setPage(1);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentInvoice) return;

    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) {
      showToast('Please enter a valid payment amount.', 'error');
      return;
    }

    try {
      await api.sales.invoices.recordPayment(paymentInvoice._id || paymentInvoice.id, {
        amount: amt,
        paymentMode,
        paymentDate,
        reference: paymentRef
      });
      showToast(`Payment of ${formatINR(amt)} recorded.`);
      setPaymentInvoice(null);
      setPaymentAmount('');
      setPaymentRef('');
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to record payment', 'error');
    }
  };

  const handleDeleteInvoice = async () => {
    if (!deletingInvoice) return;
    try {
      await api.sales.invoices.delete(deletingInvoice._id || deletingInvoice.id);
      showToast('Invoice deleted.');
      setDeletingInvoice(null);
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to delete invoice', 'error');
    }
  };

  const handleExportExcel = () => {
    if (activeTab === 'transactions') {
      storageService.exportToCSV('Sales_Transactions', filteredInvoices, transactionColumns);
    } else if (activeTab === 'customer') {
      storageService.exportToCSV('Customer_Wise_Sales', customerWiseData);
    } else if (activeTab === 'product') {
      storageService.exportToCSV('Product_Wise_Sales', productWiseData);
    } else if (activeTab === 'outstanding') {
      storageService.exportToCSV('Outstanding_Payments_Report', outstandingData);
    } else {
      storageService.exportToCSV('Sales_Report', filteredInvoices);
    }
    showToast('Exported report to Excel.');
  };

  const handleExportPDF = () => {
    if (activeTab === 'transactions') {
      storageService.exportToPDF('Sales_Transactions', filteredInvoices, transactionColumns);
    } else if (activeTab === 'customer') {
      storageService.exportToPDF('Customer_Wise_Sales', customerWiseData);
    } else if (activeTab === 'product') {
      storageService.exportToPDF('Product_Wise_Sales', productWiseData);
    } else if (activeTab === 'outstanding') {
      storageService.exportToPDF('Outstanding_Payments_Report', outstandingData);
    } else {
      storageService.exportToPDF('Sales_Report', filteredInvoices, transactionColumns);
    }
  };

  // Transactions table columns matching panel 3
  const transactionColumns = [
    {
      key: 'id',
      header: 'S.No.',
      width: '50px',
      render: (val, row, idx) => (page - 1) * itemsPerPage + idx + 1
    },
    {
      key: 'invoiceNo',
      header: 'Invoice No.',
      width: '125px',
      render: (val, row) => (
        <span
          style={{ fontWeight: 700, color: 'var(--primary-600)', cursor: 'pointer' }}
          onClick={() => navigate(`/sales/invoices/${row._id || row.id}`)}
        >
          {val}
        </span>
      )
    },
    {
      key: 'invoiceDate',
      header: 'Invoice Date',
      width: '100px',
      render: (val) => formatDate(val)
    },
    {
      key: 'customerName',
      header: 'Customer Name',
      render: (val, row) => (
        <span
          style={{ fontWeight: 600, cursor: 'pointer' }}
          onClick={() => navigate(`/sales/invoices/${row._id || row.id}`)}
        >
          {val}
        </span>
      )
    },
    {
      key: 'itemsCount',
      header: 'Items',
      width: '55px',
      render: (val, row) => (row.items && Array.isArray(row.items) ? row.items.length : 0)
    },
    {
      key: 'taxableAmount',
      header: 'Taxable Amount',
      render: (val) => formatINR(val)
    },
    {
      key: 'gstAmount',
      header: 'GST Amount',
      render: (val) => formatINR(val)
    },
    {
      key: 'grandTotal',
      header: 'Invoice Total',
      render: (val) => (
        <strong style={{ color: 'var(--text-main)' }}>
          {formatINR(val)}
        </strong>
      )
    },
    {
      key: 'amountPaid',
      header: 'Amount Paid',
      render: (val) => (
        <span style={{ color: '#047857', fontWeight: 600 }}>
          {formatINR(val)}
        </span>
      )
    },
    {
      key: 'balanceDue',
      header: 'Balance Due',
      render: (val) => (
        <span style={{ color: Number(val) > 0 ? '#dc2626' : '#64748b', fontWeight: Number(val) > 0 ? 700 : 500 }}>
          {formatINR(val)}
        </span>
      )
    },
    {
      key: 'paymentStatus',
      header: 'Payment Status',
      width: '110px',
      render: (val) => {
        let bg = '#fee2e2';
        let text = '#b91c1c';
        if (val === 'Paid') {
          bg = '#dcfce7';
          text = '#15803d';
        } else if (val === 'Partially Paid') {
          bg = '#fef3c7';
          text = '#b45309';
        } else if (val === 'Overdue') {
          bg = '#fee2e2';
          text = '#b91c1c';
        }
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: bg,
              color: text,
              display: 'inline-block'
            }}
          >
            {val || 'Unpaid'}
          </span>
        );
      }
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 className="page-title" style={{ fontSize: '1.35rem', fontWeight: 700 }}>Sales Details (Reports)</h2>
          <p className="page-subtitle" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            View sales transactions, customer-wise sales, payment status and periodic analytical reports
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportExcel}>
            <Download size={14} /> Export Excel
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportPDF}>
            <Printer size={14} /> Export PDF
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/sales/invoices/new')}>
            <Receipt size={14} /> Create Invoice
          </button>
        </div>
      </div>

      {/* 4 Summary Cards matching Panel 3 */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {/* Total Sales */}
        <MetricCard
          title="Total Sales"
          value={formatINR(summary.totalSales)}
          trend="Selected date range"
          trendType="up"
          icon={TrendingUp}
          iconBg="#eff6ff"
          iconColor="#2563eb"
        />

        {/* Amount Received */}
        <MetricCard
          title="Amount Received"
          value={formatINR(summary.amountReceived)}
          trend="Payments received"
          trendType="up"
          icon={CheckCircle2}
          iconBg="#ecfdf5"
          iconColor="#059669"
        />

        {/* Outstanding */}
        <MetricCard
          title="Outstanding"
          value={formatINR(summary.outstanding)}
          trend="Unpaid invoice balances"
          trendType={summary.outstanding > 0 ? "down" : "up"}
          icon={Clock}
          iconBg="#fef2f2"
          iconColor="#dc2626"
        />

        {/* Invoices */}
        <MetricCard
          title="Invoices"
          value={summary.invoiceCount}
          trend="Invoices in this period"
          trendType="up"
          icon={FileSpreadsheet}
          iconBg="#f0f9ff"
          iconColor="#0284c7"
        />
      </div>

      {/* Filter Toolbar matching Panel 3 */}
      <div className="erp-card" style={{ padding: '0.85rem 1.15rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
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

          {/* Customer Dropdown */}
          <select
            className="form-control"
            style={{ width: '170px', height: '36px', fontSize: '0.8125rem' }}
            value={customerFilter}
            onChange={(e) => {
              setCustomerFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="All">All Customers</option>
            {customers.map((c) => (
              <option key={c.id || c._id} value={c.id || c._id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Invoice Status */}
          <select
            className="form-control"
            style={{ width: '130px', height: '36px', fontSize: '0.8125rem' }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="All">All Status</option>
            <option value="Issued">Issued</option>
            <option value="Draft">Draft</option>
          </select>

          {/* Payment Status */}
          <select
            className="form-control"
            style={{ width: '160px', height: '36px', fontSize: '0.8125rem' }}
            value={paymentStatusFilter}
            onChange={(e) => {
              setPaymentStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="All">All Payment Status</option>
            <option value="Paid">Paid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Overdue">Overdue</option>
          </select>

          {/* Search Box */}
          <div className="search-box" style={{ flex: 1, minWidth: '180px', height: '36px' }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search invoice or customer..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ height: '36px', padding: '0 0.85rem' }}
            onClick={handleResetFilters}
            title="Reset filters"
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '0.35rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px', overflowX: 'auto' }}>
        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          style={{
            padding: '0.55rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'transactions' ? '3px solid var(--primary-600)' : '3px solid transparent',
            color: activeTab === 'transactions' ? 'var(--primary-600)' : 'var(--text-muted)',
            fontWeight: activeTab === 'transactions' ? 700 : 500,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Receipt size={15} /> All Invoices
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('customer')}
          style={{
            padding: '0.55rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'customer' ? '3px solid var(--primary-600)' : '3px solid transparent',
            color: activeTab === 'customer' ? 'var(--primary-600)' : 'var(--text-muted)',
            fontWeight: activeTab === 'customer' ? 700 : 500,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Users size={15} /> Customer-wise Sales
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('product')}
          style={{
            padding: '0.55rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'product' ? '3px solid var(--primary-600)' : '3px solid transparent',
            color: activeTab === 'product' ? 'var(--primary-600)' : 'var(--text-muted)',
            fontWeight: activeTab === 'product' ? 700 : 500,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Package size={15} /> Product-wise Sales
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('periodic')}
          style={{
            padding: '0.55rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'periodic' ? '3px solid var(--primary-600)' : '3px solid transparent',
            color: activeTab === 'periodic' ? 'var(--primary-600)' : 'var(--text-muted)',
            fontWeight: activeTab === 'periodic' ? 700 : 500,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Calendar size={15} /> Periodic Trends (Daily / Weekly / Monthly)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('outstanding')}
          style={{
            padding: '0.55rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'outstanding' ? '3px solid var(--primary-600)' : '3px solid transparent',
            color: activeTab === 'outstanding' ? 'var(--primary-600)' : 'var(--text-muted)',
            fontWeight: activeTab === 'outstanding' ? 700 : 500,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Clock size={15} /> Outstanding Payments ({outstandingData.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gst')}
          style={{
            padding: '0.55rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'gst' ? '3px solid var(--primary-600)' : '3px solid transparent',
            color: activeTab === 'gst' ? 'var(--primary-600)' : 'var(--text-muted)',
            fontWeight: activeTab === 'gst' ? 700 : 500,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <FileText size={15} /> GST Summary
        </button>
      </div>

      {/* Tab 1: All Invoices Transaction Table */}
      {activeTab === 'transactions' && (
        <div className="erp-card">
          <DataTable
            columns={transactionColumns}
            data={paginatedInvoices}
            onRowClick={(row) => navigate(`/sales/invoices/${row._id || row.id}`)}
            onView={(row) => navigate(`/sales/invoices/${row._id || row.id}`)}
            onEdit={(row) => navigate(`/sales/invoices/${row._id || row.id}/edit`)}
            onDelete={(row) => setDeletingInvoice(row)}
            page={page}
            totalPages={totalPages}
            totalItems={filteredInvoices.length}
            itemsPerPage={itemsPerPage}
            onPageChange={(newPage) => setPage(newPage)}
            onItemsPerPageChange={(newSize) => {
              setItemsPerPage(newSize);
              setPage(1);
            }}
          />
        </div>
      )}

      {/* Tab 2: Customer-wise Sales Report */}
      {activeTab === 'customer' && (
        <div className="erp-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Customer Revenue Breakdown</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{customerWiseData.length} customers with billing</span>
          </div>

          <div className="table-responsive">
            <table className="erp-table">
              <thead>
                <tr>
                  <th style={{ width: '45px' }}>#</th>
                  <th>Customer Name</th>
                  <th>Customer ID</th>
                  <th style={{ textAlign: 'center' }}>Invoices</th>
                  <th style={{ textAlign: 'right' }}>Taxable Amount</th>
                  <th style={{ textAlign: 'right' }}>GST Amount</th>
                  <th style={{ textAlign: 'right' }}>Total Sales</th>
                  <th style={{ textAlign: 'right' }}>Amount Paid</th>
                  <th style={{ textAlign: 'right' }}>Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {customerWiseData.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No customer sales records found.
                    </td>
                  </tr>
                ) : (
                  customerWiseData.map((row, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>
                        <strong>{row.customerName}</strong>
                        {row.companyName && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{row.companyName}</div>}
                      </td>
                      <td><code>{row.customerCode}</code></td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.invoiceCount}</td>
                      <td style={{ textAlign: 'right' }}>{formatINR(row.taxableAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatINR(row.gstAmount)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatINR(row.totalSales)}</td>
                      <td style={{ textAlign: 'right', color: '#047857', fontWeight: 600 }}>{formatINR(row.amountPaid)}</td>
                      <td style={{ textAlign: 'right', color: Number(row.balanceDue) > 0 ? '#dc2626' : '#64748b', fontWeight: 700 }}>
                        {formatINR(row.balanceDue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Product-wise Sales Report */}
      {activeTab === 'product' && (
        <div className="erp-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Product Sales & Volume Breakdown</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{productWiseData.length} distinct items sold</span>
          </div>

          <div className="table-responsive">
            <table className="erp-table">
              <thead>
                <tr>
                  <th style={{ width: '45px' }}>#</th>
                  <th>Product Description</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th style={{ textAlign: 'right' }}>Quantity Sold</th>
                  <th style={{ textAlign: 'right' }}>Average Rate</th>
                  <th style={{ textAlign: 'right' }}>Taxable Revenue</th>
                  <th style={{ textAlign: 'right' }}>Total Sales (with GST)</th>
                </tr>
              </thead>
              <tbody>
                {productWiseData.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No product sales records found.
                    </td>
                  </tr>
                ) : (
                  productWiseData.map((p, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td><strong>{p.productName}</strong></td>
                      <td>{p.category}</td>
                      <td>{p.unit}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{p.quantitySold.toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>{formatINR(p.averageRate)}</td>
                      <td style={{ textAlign: 'right' }}>{formatINR(p.taxableRevenue)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary-700)' }}>
                        {formatINR(p.totalRevenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Periodic Trends (Daily / Weekly / Monthly) */}
      {activeTab === 'periodic' && (
        <div className="erp-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Periodic Sales Aggregation</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Group invoice sales by timeframe</p>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                type="button"
                className={`btn btn-sm ${periodGranularity === 'daily' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPeriodGranularity('daily')}
              >
                Daily
              </button>
              <button
                type="button"
                className={`btn btn-sm ${periodGranularity === 'weekly' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPeriodGranularity('weekly')}
              >
                Weekly
              </button>
              <button
                type="button"
                className={`btn btn-sm ${periodGranularity === 'monthly' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPeriodGranularity('monthly')}
              >
                Monthly
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th style={{ textAlign: 'center' }}>Invoices Issued</th>
                  <th style={{ textAlign: 'right' }}>Taxable Sales</th>
                  <th style={{ textAlign: 'right' }}>GST Collected</th>
                  <th style={{ textAlign: 'right' }}>Gross Total Sales</th>
                  <th style={{ textAlign: 'right' }}>Payments Collected</th>
                  <th style={{ textAlign: 'right' }}>Remaining Balance</th>
                </tr>
              </thead>
              <tbody>
                {periodicData.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No periodic transactions found for this range.
                    </td>
                  </tr>
                ) : (
                  periodicData.map((row, idx) => (
                    <tr key={idx}>
                      <td><strong>{row.periodKey}</strong></td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.invoiceCount}</td>
                      <td style={{ textAlign: 'right' }}>{formatINR(row.taxableAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatINR(row.gstAmount)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary-700)' }}>
                        {formatINR(row.totalSales)}
                      </td>
                      <td style={{ textAlign: 'right', color: '#047857', fontWeight: 600 }}>
                        {formatINR(row.amountPaid)}
                      </td>
                      <td style={{ textAlign: 'right', color: Number(row.balanceDue) > 0 ? '#dc2626' : '#64748b', fontWeight: 700 }}>
                        {formatINR(row.balanceDue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Outstanding Payments Report */}
      {activeTab === 'outstanding' && (
        <div className="erp-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={18} /> Outstanding Customer Balances & Dues
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Invoices with pending balance amounts sorted by due date
              </p>
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#b91c1c' }}>
              Total Outstanding: {formatINR(summary.outstanding)}
            </div>
          </div>

          <div className="table-responsive">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Customer Name</th>
                  <th>Phone</th>
                  <th>Invoice Date</th>
                  <th>Due Date</th>
                  <th style={{ textAlign: 'center' }}>Overdue Days</th>
                  <th style={{ textAlign: 'right' }}>Invoice Total</th>
                  <th style={{ textAlign: 'right' }}>Paid Amount</th>
                  <th style={{ textAlign: 'right' }}>Balance Due</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {outstandingData.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: '#059669', fontWeight: 600 }}>
                      🎉 Excellent! All invoices have been fully paid. Zero outstanding balances.
                    </td>
                  </tr>
                ) : (
                  outstandingData.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong
                          style={{ color: 'var(--primary-600)', cursor: 'pointer' }}
                          onClick={() => navigate(`/sales/invoices/${row.id}`)}
                        >
                          {row.invoiceNo}
                        </strong>
                      </td>
                      <td>
                        <strong>{row.customerName}</strong>
                        {row.companyName && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{row.companyName}</div>}
                      </td>
                      <td>{row.phone || '-'}</td>
                      <td>{formatDate(row.invoiceDate)}</td>
                      <td>{formatDate(row.dueDate)}</td>
                      <td style={{ textAlign: 'center' }}>
                        {row.daysOverdue > 0 ? (
                          <span style={{ color: '#dc2626', fontWeight: 700, backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem' }}>
                            {row.daysOverdue} days
                          </span>
                        ) : (
                          <span style={{ color: '#059669', fontSize: '0.75rem' }}>Current</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatINR(row.grandTotal)}</td>
                      <td style={{ textAlign: 'right', color: '#047857' }}>{formatINR(row.amountPaid)}</td>
                      <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 800 }}>
                        {formatINR(row.balanceDue)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                          onClick={() => {
                            setPaymentInvoice(row);
                            setPaymentAmount(row.balanceDue);
                          }}
                        >
                          <CreditCard size={12} /> Collect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: GST Summary */}
      {activeTab === 'gst' && (
        <div className="erp-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary-700)', marginBottom: '1rem' }}>
            GST Summary & Output Tax Liability
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Total Taxable Value</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px' }}>{formatINR(gstSummary?.taxableAmount || 0)}</div>
            </div>
            <div style={{ padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>Total CGST (Intra-state)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1d4ed8', marginTop: '4px' }}>{formatINR(gstSummary?.cgstAmount || 0)}</div>
            </div>
            <div style={{ padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>Total SGST (Intra-state)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1d4ed8', marginTop: '4px' }}>{formatINR(gstSummary?.sgstAmount || 0)}</div>
            </div>
            <div style={{ padding: '1rem', backgroundColor: '#f5f3ff', borderRadius: '8px', border: '1px solid #ddd6fe' }}>
              <div style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 600 }}>Total IGST (Inter-state)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#6d28d9', marginTop: '4px' }}>{formatINR(gstSummary?.igstAmount || 0)}</div>
            </div>
            <div style={{ padding: '1rem', backgroundColor: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
              <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>Total Output Tax</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#047857', marginTop: '4px' }}>{formatINR(gstSummary?.gstAmount || 0)}</div>
            </div>
          </div>

          <div style={{ backgroundColor: '#f1f5f9', padding: '1rem', borderRadius: '6px', fontSize: '0.8rem', color: '#475569', lineHeight: 1.6 }}>
            <strong>Filing Notice:</strong> Figures above reflect all tax invoices issued by NSS-TEX Towels & Textiles within the selected period. Out-of-state shipments are classified under IGST (Inter-state), and Tamil Nadu shipments are divided equally between CGST and SGST (Intra-state) in accordance with the Goods and Services Tax Act.
          </div>
        </div>
      )}

      {/* Quick Collect Payment Modal */}
      {paymentInvoice && (
        <Modal
          isOpen={!!paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          title={`Collect Payment for Invoice ${paymentInvoice.invoiceNo}`}
          maxWidth="480px"
        >
          <form onSubmit={handleRecordPayment}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '6px', fontSize: '0.82rem' }}>
                <div>Customer: <strong>{paymentInvoice.customerName}</strong></div>
                <div>Balance Due: <strong style={{ color: '#dc2626' }}>{formatINR(paymentInvoice.balanceDue)}</strong></div>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Amount (₹) <span className="required">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={paymentInvoice.balanceDue}
                  className="form-control"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select className="form-control" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                  <option value="RTGS">RTGS</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Date</label>
                <input type="date" className="form-control" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">Reference / UTR</label>
                <input type="text" className="form-control" placeholder="Transaction ID" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setPaymentInvoice(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Record Payment
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Invoice Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deletingInvoice}
        onClose={() => setDeletingInvoice(null)}
        onConfirm={handleDeleteInvoice}
        title="Delete Invoice"
        message={
          deletingInvoice ? (
            <div>
              Are you sure you want to delete invoice <strong>"{deletingInvoice.invoiceNo}"</strong> ({formatINR(deletingInvoice.grandTotal)})?
            </div>
          ) : ''
        }
      />
    </div>
  );
}
