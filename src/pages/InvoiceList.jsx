import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  Plus,
  Search,
  Download,
  Printer,
  RotateCcw,
  Eye,
  Edit2,
  Trash2,
  CreditCard,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Send,
  Calendar,
  MessageCircle,
  Mail,
  Copy,
  ExternalLink,
  Bell,
  PhoneCall
} from 'lucide-react';
import DataTable from '../components/common/DataTable';
import MetricCard from '../components/common/MetricCard';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Toast from '../components/common/Toast';
import DateRangePicker from '../components/common/DateRangePicker';
import DynamicTypeSelect from '../components/common/DynamicTypeSelect';
import { storageService } from '../services/storageService';
import { api } from '../services/api';
import { formatINR, formatDate, getInvoiceDueDate, isInvoiceOverdue, getInvoiceDueStatus } from '../utils/formatters';
import { ADMIN_MOBILE, generatePaymentReminderMessage, openWhatsAppChat, openEmailClient } from '../utils/reminderMessages';

export default function InvoiceList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'due', 'overdue', 'paid'
  const [searchQuery, setSearchQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Quick Payment Modal State
  const [paymentModalInvoice, setPaymentModalInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Payment Reminder Modal State
  const [reminderInvoice, setReminderInvoice] = useState(null);
  const [reminderPhone, setReminderPhone] = useState('');
  const [reminderEmail, setReminderEmail] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');

  // Delete Confirm
  const [deletingInvoice, setDeletingInvoice] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Support URL query param ?tab=due or ?tab=overdue
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && ['all', 'due', 'overdue', 'paid'].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    } catch (e) {}
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [invData, custData] = await Promise.all([
        storageService.fetchLiveCollection('invoices'),
        storageService.fetchLiveCollection('customers')
      ]);
      setInvoices(invData || []);
      setCustomers(custData || []);
    } catch (err) {
      console.warn('Error loading invoices:', err.message);
      setInvoices(storageService.getCollection('invoices') || []);
      setCustomers(storageService.getCollection('customers') || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalCount = invoices.length;
    const totalSales = invoices.reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0);
    const amountReceived = invoices.reduce((sum, i) => sum + (Number(i.amountPaid) || 0), 0);
    const outstanding = invoices.reduce((sum, i) => sum + (Number(i.balanceDue) || 0), 0);
    const paidCount = invoices.filter(i => i.paymentStatus === 'Paid' || Number(i.balanceDue) <= 0).length;
    const dueCount = invoices.filter(i => Number(i.balanceDue) > 0).length;
    const overdueCount = invoices.filter(i => isInvoiceOverdue(i)).length;

    return { totalCount, totalSales, amountReceived, outstanding, paidCount, dueCount, overdueCount };
  }, [invoices]);

  // Filtered Invoices (including Tab filtering)
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Tab based filter
      if (activeTab === 'due' && Number(inv.balanceDue) <= 0) return false;
      if (activeTab === 'overdue' && !isInvoiceOverdue(inv)) return false;
      if (activeTab === 'paid' && (inv.paymentStatus !== 'Paid' && Number(inv.balanceDue) > 0)) return false;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        (inv.invoiceNo && inv.invoiceNo.toLowerCase().includes(q)) ||
        (inv.customerName && inv.customerName.toLowerCase().includes(q)) ||
        (inv.referenceNo && inv.referenceNo.toLowerCase().includes(q)) ||
        (inv.poNumber && inv.poNumber.toLowerCase().includes(q));

      const matchesCustomer =
        customerFilter === 'All' ||
        String(inv.customerId) === String(customerFilter) ||
        inv.customerName === customerFilter;

      const matchesStatus =
        statusFilter === 'All' ||
        inv.invoiceStatus === statusFilter;

      const matchesPayment =
        paymentStatusFilter === 'All' ||
        inv.paymentStatus === paymentStatusFilter;

      let matchesDate = true;
      if (startDate) {
        matchesDate = matchesDate && new Date(inv.invoiceDate) >= new Date(startDate);
      }
      if (endDate) {
        matchesDate = matchesDate && new Date(inv.invoiceDate) <= new Date(endDate);
      }

      return matchesSearch && matchesCustomer && matchesStatus && matchesPayment && matchesDate;
    });
  }, [invoices, activeTab, searchQuery, customerFilter, statusFilter, paymentStatusFilter, startDate, endDate]);

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage) || 1;
  const paginatedInvoices = filteredInvoices.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setCustomerFilter('All');
    setStatusFilter('All');
    setPaymentStatusFilter('All');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentModalInvoice) return;

    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) {
      showToast('Please enter a valid positive payment amount.', 'error');
      return;
    }

    const currentBalance = Number(paymentModalInvoice.balanceDue) || 0;
    if (amt > currentBalance) {
      showToast(`Payment amount cannot exceed remaining balance (${formatINR(currentBalance)})`, 'error');
      return;
    }

    try {
      await api.sales.invoices.recordPayment(paymentModalInvoice._id || paymentModalInvoice.id, {
        amount: amt,
        paymentMode,
        paymentDate,
        reference: paymentRef,
        notes: paymentNotes
      });

      showToast(`Payment of ${formatINR(amt)} recorded successfully.`);
      setPaymentModalInvoice(null);
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to record payment', 'error');
    }
  };

  const handleDeleteInvoice = async () => {
    if (!deletingInvoice) return;
    try {
      await api.sales.invoices.delete(deletingInvoice._id || deletingInvoice.id);
      showToast('Invoice deleted successfully.');
      setDeletingInvoice(null);
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to delete invoice', 'error');
    }
  };

  const handleOpenReminderModal = (inv) => {
    setReminderInvoice(inv);
    const fullCust = customers.find(c => String(c.id || c._id || c.customerId) === String(inv.customerId)) || {};
    const phone = inv.customerSnapshot?.phone || fullCust.phone || '';
    const email = inv.customerSnapshot?.email || fullCust.email || '';
    setReminderPhone(phone);
    setReminderEmail(email);
    setReminderMessage(generatePaymentReminderMessage(inv));
  };

  const handleSendWhatsAppReminder = () => {
    if (!reminderPhone) {
      showToast('Please provide a customer mobile number.', 'error');
      return;
    }
    openWhatsAppChat(reminderPhone, reminderMessage);
    showToast(`Opening WhatsApp chat to +91 ${reminderPhone}`);
  };

  const handleSendEmailReminder = () => {
    if (!reminderEmail) {
      showToast('Please provide a customer email address.', 'error');
      return;
    }
    openEmailClient(
      reminderEmail,
      `Payment Reminder: Invoice ${reminderInvoice?.invoiceNo || ''} — NSS-TEX`,
      reminderMessage
    );
    showToast(`Opening email client for ${reminderEmail}`);
  };

  const handleCopyReminderMessage = () => {
    navigator.clipboard.writeText(reminderMessage);
    showToast('Reminder message copied to clipboard!');
  };

  const handleExportCSV = () => {
    storageService.exportToCSV('Invoices_Report', filteredInvoices, columns);
    showToast('Exported Invoices list to Excel.');
  };

  const handleExportPDF = () => {
    storageService.exportToPDF('Invoices_Report', filteredInvoices, columns);
  };

  const columns = [
    {
      key: 'id',
      header: 'S.No.',
      width: '55px',
      render: (val, row, idx) => (page - 1) * itemsPerPage + idx + 1
    },
    {
      key: 'invoiceNo',
      header: 'Invoice No.',
      width: '130px',
      render: (val, row) => (
        <span
          style={{ fontWeight: 700, color: 'var(--primary-600)', cursor: 'pointer' }}
          onClick={() => navigate(`/sales/invoices/${row._id || row.id}`)}
          title="Click to view tax invoice"
        >
          {val}
        </span>
      )
    },
    {
      key: 'invoiceDate',
      header: 'Date',
      width: '95px',
      render: (val) => formatDate(val)
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      width: '120px',
      render: (val, row) => {
        const dueStr = getInvoiceDueDate(row);
        const statusInfo = getInvoiceDueStatus(row);
        let badgeBg = '#f1f5f9';
        let badgeColor = '#475569';
        if (statusInfo.status === 'overdue') {
          badgeBg = '#fee2e2';
          badgeColor = '#b91c1c';
        } else if (statusInfo.status === 'today') {
          badgeBg = '#fef3c7';
          badgeColor = '#b45309';
        } else if (statusInfo.status === 'paid') {
          badgeBg = '#dcfce7';
          badgeColor = '#15803d';
        }

        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: statusInfo.status === 'overdue' ? '#dc2626' : 'var(--text-main)' }}>
              {formatDate(dueStr)}
            </div>
            <span
              style={{
                fontSize: '0.68rem',
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: badgeBg,
                color: badgeColor,
                fontWeight: 600,
                display: 'inline-block',
                marginTop: '2px'
              }}
            >
              {statusInfo.label}
            </span>
          </div>
        );
      }
    },
    {
      key: 'customerName',
      header: 'Customer Name',
      render: (val, row) => (
        <div>
          <div
            style={{ fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
            onClick={() => navigate(`/sales/invoices/${row._id || row.id}`)}
          >
            {val || 'Unknown Customer'}
          </div>
          {row.customerCode && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              ID: {row.customerCode}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'itemsCount',
      header: 'Items',
      width: '65px',
      render: (val, row) => (row.items && Array.isArray(row.items) ? row.items.length : 0)
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
      render: (val, row) => {
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
    },
    {
      key: 'invoiceStatus',
      header: 'Status',
      width: '80px',
      render: (val) => (
        <span
          style={{
            padding: '2px 7px',
            borderRadius: '4px',
            fontSize: '0.7rem',
            fontWeight: 600,
            backgroundColor: val === 'Issued' ? '#eff6ff' : '#f1f5f9',
            color: val === 'Issued' ? '#2563eb' : '#64748b'
          }}
        >
          {val || 'Draft'}
        </span>
      )
    },
    {
      key: 'reminderActions',
      header: 'Remind',
      width: '115px',
      render: (val, row) => {
        const hasDue = Number(row.balanceDue) > 0;
        if (!hasDue) {
          return (
            <span style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
              <CheckCircle size={13} /> Paid
            </span>
          );
        }

        return (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                backgroundColor: '#25D366',
                color: '#ffffff',
                border: 'none',
                padding: '3px 7px',
                fontSize: '0.72rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title="Quick Send WhatsApp Payment Reminder"
              onClick={(e) => {
                e.stopPropagation();
                const fullCust = customers.find(c => String(c.id || c._id || c.customerId) === String(row.customerId)) || {};
                const phone = row.customerSnapshot?.phone || fullCust.phone || '';
                const msg = generatePaymentReminderMessage(row);
                openWhatsAppChat(phone, msg);
                showToast(`Opening WhatsApp chat for ${row.customerName}`);
              }}
            >
              <MessageCircle size={12} /> WhatsApp
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ padding: '3px 6px' }}
              title="Preview / Customize Payment Reminder (Email & WhatsApp)"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenReminderModal(row);
              }}
            >
              <Send size={12} />
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="page-title" style={{ fontSize: '1.35rem', fontWeight: 700 }}>Invoice Details</h2>
          <p className="page-subtitle" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Create, issue, track and manage billing invoices with GST breakdowns and payment settlements
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
            <Download size={14} /> Export Excel
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportPDF}>
            <Printer size={14} /> Export PDF
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/sales/invoices/new')}>
            <Plus size={15} /> Create Invoice
          </button>
        </div>
      </div>

      {/* Metric Cards Summary */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <MetricCard
          title="Total Invoiced"
          value={formatINR(summaryMetrics.totalSales)}
          trend={`${summaryMetrics.totalCount} Invoices`}
          trendType="up"
          icon={Receipt}
          iconBg="#eff6ff"
          iconColor="#2563eb"
        />
        <MetricCard
          title="Amount Received"
          value={formatINR(summaryMetrics.amountReceived)}
          trend="Settled"
          trendType="up"
          icon={CheckCircle}
          iconBg="#ecfdf5"
          iconColor="#059669"
        />
        <MetricCard
          title="Outstanding Balance"
          value={formatINR(summaryMetrics.outstanding)}
          trend="Unpaid Dues"
          trendType={summaryMetrics.outstanding > 0 ? "down" : "up"}
          icon={Clock}
          iconBg="#fef2f2"
          iconColor="#dc2626"
        />
        <MetricCard
          title="Total Invoices"
          value={summaryMetrics.totalCount}
          trend={`${summaryMetrics.paidCount} Fully Paid`}
          trendType="up"
          icon={FileText}
          iconBg="#f5f3ff"
          iconColor="#7c3aed"
        />
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '0.35rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px', overflowX: 'auto' }}>
        <button
          type="button"
          onClick={() => { setActiveTab('all'); setPage(1); }}
          style={{
            padding: '0.55rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'all' ? '3px solid var(--primary-600)' : '3px solid transparent',
            color: activeTab === 'all' ? 'var(--primary-600)' : 'var(--text-muted)',
            fontWeight: activeTab === 'all' ? 700 : 500,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Receipt size={15} /> All Invoices ({summaryMetrics.totalCount})
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('due'); setPage(1); }}
          style={{
            padding: '0.55rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'due' ? '3px solid #d97706' : '3px solid transparent',
            color: activeTab === 'due' ? '#d97706' : 'var(--text-muted)',
            fontWeight: activeTab === 'due' ? 700 : 500,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Clock size={15} /> Payment Due
          {summaryMetrics.dueCount > 0 && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                backgroundColor: '#f59e0b',
                color: '#ffffff',
                padding: '1px 7px',
                borderRadius: '9999px',
                marginLeft: '4px'
              }}
            >
              {summaryMetrics.dueCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('overdue'); setPage(1); }}
          style={{
            padding: '0.55rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'overdue' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'overdue' ? '#dc2626' : 'var(--text-muted)',
            fontWeight: activeTab === 'overdue' ? 700 : 500,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <AlertCircle size={15} /> Overdue Invoices
          {summaryMetrics.overdueCount > 0 && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                backgroundColor: '#dc2626',
                color: '#ffffff',
                padding: '1px 7px',
                borderRadius: '9999px',
                marginLeft: '4px'
              }}
            >
              {summaryMetrics.overdueCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('paid'); setPage(1); }}
          style={{
            padding: '0.55rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'paid' ? '3px solid #059669' : '3px solid transparent',
            color: activeTab === 'paid' ? '#059669' : 'var(--text-muted)',
            fontWeight: activeTab === 'paid' ? 700 : 500,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <CheckCircle size={15} /> Fully Paid ({summaryMetrics.paidCount})
        </button>
      </div>

      {/* Due / Overdue Notice Banner */}
      {(activeTab === 'due' || activeTab === 'overdue') && (
        <div
          style={{
            backgroundColor: activeTab === 'overdue' ? '#fff1f2' : '#fffbeb',
            border: `1px solid ${activeTab === 'overdue' ? '#fecdd3' : '#fde68a'}`,
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1.15rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ color: activeTab === 'overdue' ? '#e11d48' : '#d97706' }}>
              {activeTab === 'overdue' ? <AlertCircle size={20} /> : <Clock size={20} />}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: activeTab === 'overdue' ? '#9f1239' : '#92400e' }}>
                {activeTab === 'overdue' ? 'Overdue Invoices Requiring Urgent Settlement' : 'Payment Due Invoices'}
              </div>
              <div style={{ fontSize: '0.78rem', color: activeTab === 'overdue' ? '#be123c' : '#b45309' }}>
                Send polite payment request messages directly from Admin Mobile (+91 {ADMIN_MOBILE}) to customer mobiles via WhatsApp & Email.
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: activeTab === 'overdue' ? '#be123c' : '#92400e' }}>
            Outstanding Balance: {formatINR(filteredInvoices.reduce((sum, i) => sum + (Number(i.balanceDue) || 0), 0))}
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="erp-card" style={{ padding: '0.85rem 1.15rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ flex: 1, minWidth: '220px', height: '36px' }}>
            <Search size={15} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search invoice number, customer, PO..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            className="form-control"
            style={{ width: '160px', height: '36px', fontSize: '0.8125rem' }}
            value={customerFilter}
            onChange={(e) => {
              setCustomerFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="All">All Customers</option>
            {customers.map((c) => (
              <option key={c.id || c.customerId} value={c.id || c.customerId}>
                {c.name}
              </option>
            ))}
          </select>

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

          <select
            className="form-control"
            style={{ width: '150px', height: '36px', fontSize: '0.8125rem' }}
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
            title="Reset filters"
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="erp-card">
        <DataTable
          columns={columns}
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

      {/* Record Payment Modal */}
      {paymentModalInvoice && (
        <Modal
          isOpen={!!paymentModalInvoice}
          onClose={() => setPaymentModalInvoice(null)}
          title={`Record Payment — ${paymentModalInvoice.invoiceNo}`}
          maxWidth="1120px"
        >
          <form onSubmit={handleRecordPayment} style={{ width: '100%' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Customer:</span>
                <strong>{paymentModalInvoice.customerName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Invoice Total:</span>
                <span>{formatINR(paymentModalInvoice.grandTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Already Paid:</span>
                <span style={{ color: '#047857', fontWeight: 600 }}>{formatINR(paymentModalInvoice.amountPaid)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', paddingTop: '6px', borderTop: '1px dashed #cbd5e1' }}>
                <span style={{ fontWeight: 600 }}>Remaining Balance Due:</span>
                <span style={{ color: '#dc2626', fontWeight: 700 }}>{formatINR(paymentModalInvoice.balanceDue)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Payment Amount (₹) <span className="required">*</span></label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={paymentModalInvoice.balanceDue}
                    className="form-control"
                    placeholder="Enter amount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}
                    onClick={() => setPaymentAmount(paymentModalInvoice.balanceDue)}
                  >
                    Pay Full
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <DynamicTypeSelect
                    category="payment_mode"
                    value={paymentMode}
                    onChange={(val) => setPaymentMode(val)}
                    label="Payment Mode"
                    placeholder="Select Payment Mode"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reference / UTR / Cheque Number</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. UTR192830192 or CHQ-00123"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Remarks for this settlement"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPaymentModalInvoice(null)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Payment
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Payment Reminder Modal */}
      {reminderInvoice && (
        <Modal
          isOpen={!!reminderInvoice}
          onClose={() => setReminderInvoice(null)}
          title={`Payment Reminder — ${reminderInvoice.invoiceNo}`}
          maxWidth="680px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Sender Notice */}
            <div
              style={{
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                padding: '0.75rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.82rem'
              }}
            >
              <div>
                <span style={{ color: '#1e40af', fontWeight: 600 }}>Sender (Admin Mobile):</span>{' '}
                <strong style={{ color: '#1e3a8a' }}>+91 {ADMIN_MOBILE}</strong> (NSS-TEX Admin)
              </div>
              <span style={{ fontSize: '0.72rem', backgroundColor: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                WhatsApp Direct Link
              </span>
            </div>

            {/* Recipient Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Customer Mobile Number</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 9844953791"
                  value={reminderPhone}
                  onChange={(e) => setReminderPhone(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Customer Email</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="e.g. customer@example.com"
                  value={reminderEmail}
                  onChange={(e) => setReminderEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Invoice Summary Card */}
            <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Customer:</span>
                <strong>{reminderInvoice.customerName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Invoice Total:</span>
                <span>{formatINR(reminderInvoice.grandTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Due Date:</span>
                <strong style={{ color: isInvoiceOverdue(reminderInvoice) ? '#dc2626' : 'var(--text-main)' }}>
                  {formatDate(reminderInvoice.dueDate)}
                  {isInvoiceOverdue(reminderInvoice) && ' (Overdue)'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px dashed #cbd5e1' }}>
                <span style={{ fontWeight: 600 }}>Outstanding Balance Due:</span>
                <strong style={{ color: '#dc2626', fontSize: '0.9rem' }}>{formatINR(reminderInvoice.balanceDue)}</strong>
              </div>
            </div>

            {/* Message Preview / Textarea */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="form-label" style={{ margin: 0 }}>Payment Request Message</label>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                  onClick={handleCopyReminderMessage}
                >
                  <Copy size={12} /> Copy Message
                </button>
              </div>
              <textarea
                className="form-control"
                rows={9}
                style={{ fontSize: '0.8rem', fontFamily: 'monospace', lineHeight: 1.45 }}
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReminderInvoice(null)}
              >
                Close
              </button>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                {reminderEmail && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleSendEmailReminder}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Mail size={14} /> Send Email
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  style={{
                    backgroundColor: '#25D366',
                    color: '#ffffff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 600
                  }}
                  onClick={handleSendWhatsAppReminder}
                >
                  <MessageCircle size={16} /> Send via WhatsApp
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Invoice Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingInvoice}
        onClose={() => setDeletingInvoice(null)}
        onConfirm={handleDeleteInvoice}
        title="Delete Invoice"
        message={
          deletingInvoice ? (
            <div>
              Are you sure you want to delete invoice <strong>"{deletingInvoice.invoiceNo}"</strong> for <strong>{deletingInvoice.customerName}</strong> ({formatINR(deletingInvoice.grandTotal)})?
              <p style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#dc2626' }}>
                Warning: This action will permanently remove this invoice record and its associated payment transactions.
              </p>
            </div>
          ) : ''
        }
      />
    </div>
  );
}
