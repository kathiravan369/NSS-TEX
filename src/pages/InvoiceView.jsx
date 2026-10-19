import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Printer,
  Download,
  ArrowLeft,
  Edit2,
  CreditCard,
  CheckCircle2,
  Building2,
  FileText,
  Calendar,
  Send,
  Truck
} from 'lucide-react';
import { api } from '../services/api';
import { storageService } from '../services/storageService';
import { formatINR, formatDate } from '../utils/formatters';
import Toast from '../components/common/Toast';
import Modal from '../components/common/Modal';

// Number to Words converter for Indian Rupees
function numberToWords(num) {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = Math.floor(Math.abs(num));
  if (n === 0) return 'Zero Rupees Only';

  function convertGroup(n) {
    let str = '';
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += b[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += a[n] + ' ';
    }
    return str.trim();
  }

  let words = '';
  const crore = Math.floor(n / 10000000);
  let rem = n % 10000000;
  const lakh = Math.floor(rem / 100000);
  rem = rem % 100000;
  const thousand = Math.floor(rem / 1000);
  rem = rem % 1000;

  if (crore > 0) words += convertGroup(crore) + ' Crore ';
  if (lakh > 0) words += convertGroup(lakh) + ' Lakh ';
  if (thousand > 0) words += convertGroup(thousand) + ' Thousand ';
  if (rem > 0) words += convertGroup(rem) + ' ';

  return (words.trim() + ' Rupees Only');
}

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Record Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Bank Transfer');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadInvoice = async () => {
    setIsLoading(true);
    try {
      const res = await api.sales.invoices.getById(id);
      if (res && res.success && res.data) {
        setInvoice(res.data);
      } else {
        // Fallback to local storage
        const cached = storageService.getCollection('invoices').find(i => String(i.id) === String(id) || i.invoiceNo === id);
        setInvoice(cached || null);
      }
    } catch (err) {
      const cached = storageService.getCollection('invoices').find(i => String(i.id) === String(id) || i.invoiceNo === id);
      setInvoice(cached || null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const handleIssueInvoice = async () => {
    try {
      await api.sales.invoices.issue(invoice._id || invoice.id);
      showToast('Invoice issued successfully.');
      await loadInvoice();
    } catch (err) {
      showToast(err.message || 'Failed to issue invoice', 'error');
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      showToast('Please enter a valid payment amount.', 'error');
      return;
    }

    if (amt > Number(invoice.balanceDue)) {
      showToast(`Amount cannot exceed remaining balance (${formatINR(invoice.balanceDue)})`, 'error');
      return;
    }

    try {
      await api.sales.invoices.recordPayment(invoice._id || invoice.id, {
        amount: amt,
        paymentMode: payMode,
        paymentDate: payDate,
        reference: payRef,
        notes: payNotes
      });

      showToast(`Payment of ${formatINR(amt)} recorded successfully.`);
      setIsPaymentModalOpen(false);
      setPayAmount('');
      setPayRef('');
      setPayNotes('');
      await loadInvoice();
    } catch (err) {
      showToast(err.message || 'Failed to record payment', 'error');
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        Loading invoice details...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="erp-card" style={{ padding: '3rem', textAlign: 'center' }}>
        <h3>Invoice Not Found</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>The requested invoice could not be loaded.</p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/sales/invoices')}>
          Back to Invoices
        </button>
      </div>
    );
  }

  const cust = invoice.customerSnapshot || {};
  const isIntra = !invoice.igstAmount || invoice.igstAmount === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Top Action Bar (hidden on print) */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/sales/invoices')}
          >
            <ArrowLeft size={15} /> Back to Invoices
          </button>
          <div>
            <h2 className="page-title" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              Tax Invoice — {invoice.invoiceNo}
            </h2>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: invoice.invoiceStatus === 'Issued' ? '#dcfce7' : '#f1f5f9',
                color: invoice.invoiceStatus === 'Issued' ? '#15803d' : '#475569'
              }}
            >
              {invoice.invoiceStatus || 'Draft'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {invoice.invoiceStatus === 'Draft' && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleIssueInvoice}
            >
              <Send size={14} /> Issue Invoice
            </button>
          )}

          {Number(invoice.balanceDue) > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setPayAmount(invoice.balanceDue);
                setIsPaymentModalOpen(true);
              }}
            >
              <CreditCard size={14} /> Record Payment
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate(`/sales/invoices/${invoice._id || invoice.id}/edit`)}
          >
            <Edit2 size={14} /> Edit
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => window.print()}
          >
            <Printer size={14} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Printable Tax Invoice Container */}
      <div
        className="invoice-print-container"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--border-color)',
          padding: '2rem',
          maxWidth: '900px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        {/* Invoice Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <img src="/logo.png" alt="NSS-TEX" style={{ width: '45px', height: '45px', objectFit: 'contain' }} />
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#0d1527', letterSpacing: '-0.02em' }}>
                  NSS-TEX TOWELS & TEXTILES
                </h1>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Manufacturing, Dyeing & Export Quality Towels
                </p>
              </div>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#334155', lineHeight: 1.45 }}>
              <div>SF No. 124/2, Cross Cut Road, Mill Compound</div>
              <div>Coimbatore - 641001, Tamil Nadu, India</div>
              <div>Phone: +91 98765 43210 | Email: accounts@nsstowels.com</div>
              <div><strong>GSTIN:</strong> 33ABCDE1234F1Z5 | <strong>State Code:</strong> 33</div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              Tax Invoice
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>(Original for Recipient)</div>
            <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
              <div>Invoice No: <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{invoice.invoiceNo}</strong></div>
              <div>Invoice Date: <strong>{formatDate(invoice.invoiceDate)}</strong></div>
              <div>Due Date: <strong>{formatDate(invoice.dueDate)}</strong></div>
              {invoice.referenceNo && <div>Ref PO No: <strong>{invoice.referenceNo}</strong></div>}
            </div>
          </div>
        </div>

        {/* Bill To & Ship To Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.8125rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>
              Billed To
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{cust.name || invoice.customerName}</div>
            {cust.companyName && <div style={{ fontWeight: 500 }}>{cust.companyName}</div>}
            <div>{cust.billingAddress?.addressLine || 'Address Line'}</div>
            <div>{cust.billingAddress?.city || ''}, {cust.billingAddress?.state || 'Tamil Nadu'} - {cust.billingAddress?.pincode || ''}</div>
            <div>Phone: {cust.phone || '-'}</div>
            <div style={{ marginTop: '4px' }}>
              <strong>GSTIN:</strong> {cust.gstin || 'Unregistered'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>
              Shipped To
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{cust.name || invoice.customerName}</div>
            <div>{cust.shippingAddress?.addressLine || cust.billingAddress?.addressLine || 'Same as billing'}</div>
            <div>{cust.shippingAddress?.city || cust.billingAddress?.city || ''}, {cust.shippingAddress?.state || cust.billingAddress?.state || ''} - {cust.shippingAddress?.pincode || cust.billingAddress?.pincode || ''}</div>
            <div>Country: India</div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, color: '#1e3a8a', marginBottom: '2px' }}>Transport / Logistics</div>
            <div>Vehicle: <strong>{invoice.vehicleNo || 'N/A'}</strong></div>
            <div>Challan No: <strong>{invoice.challanNo || 'N/A'}</strong></div>
            <div>Dispatch No: <strong>{invoice.dispatchNo || 'N/A'}</strong></div>
            <div>Salesperson: <strong>{invoice.salesperson || 'Standard'}</strong></div>
          </div>
        </div>

        {/* Product Items Table */}
        <div style={{ padding: '1rem 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', borderTop: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '8px 6px', textAlign: 'left', width: '30px' }}>#</th>
                <th style={{ padding: '8px 6px', textAlign: 'left' }}>Item Description</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', width: '50px' }}>Unit</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', width: '60px' }}>Qty</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', width: '75px' }}>Rate (₹)</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', width: '65px' }}>Disc (₹)</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', width: '80px' }}>Taxable</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', width: '50px' }}>GST%</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', width: '85px' }}>Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items || []).map((it, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 6px' }}>{idx + 1}</td>
                  <td style={{ padding: '8px 6px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{it.productName}</div>
                    {it.sku && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>SKU: {it.sku}</div>}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>{it.unit || 'Pcs'}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>{it.quantity}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>{Number(it.rate).toFixed(2)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: '#059669' }}>
                    {Number(it.discount || 0) > 0 ? Number(it.discount).toFixed(2) : '-'}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>
                    {formatINR(it.taxableAmount || (it.quantity * it.rate - (it.discount || 0)))}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>{it.gstRate || 12}%</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>
                    {formatINR(it.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Invoice Summary & Tax Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.5rem', paddingTop: '0.75rem', borderTop: '2px solid #0f172a' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#334155', marginBottom: '0.85rem' }}>
              <strong>Amount in Words:</strong>
              <div style={{ fontStyle: 'italic', color: '#1e3a8a', fontWeight: 600, marginTop: '2px' }}>
                {numberToWords(invoice.grandTotal)}
              </div>
            </div>

            {/* Bank Information Card */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem', backgroundColor: '#f8fafc', fontSize: '0.75rem' }}>
              <div style={{ fontWeight: 700, color: '#1e3a8a', marginBottom: '4px' }}>Bank Account for Settlement:</div>
              <div>Bank: <strong>{invoice.bankDetails?.bankName || 'State Bank of India'}</strong></div>
              <div>A/C Name: <strong>{invoice.bankDetails?.accountName || 'NSS TOWELS & TEXTILES'}</strong></div>
              <div>A/C Number: <strong>{invoice.bankDetails?.accountNumber || '38920194829'}</strong></div>
              <div>IFSC Code: <strong>{invoice.bankDetails?.ifscCode || 'SBIN0001234'}</strong> | Branch: <strong>{invoice.bankDetails?.branch || 'Coimbatore'}</strong></div>
            </div>

            {/* Terms and Notes */}
            <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: '#64748b' }}>
              <div><strong>Terms:</strong> {invoice.terms}</div>
            </div>
          </div>

          {/* Right Calculations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
              <span>Taxable Amount:</span>
              <span>{formatINR(invoice.taxableAmount)}</span>
            </div>

            {isIntra ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>CGST:</span>
                  <span>{formatINR(invoice.cgstAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>SGST:</span>
                  <span>{formatINR(invoice.sgstAmount)}</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span>IGST (Inter-state):</span>
                <span>{formatINR(invoice.igstAmount)}</span>
              </div>
            )}

            {Number(invoice.roundOff) !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span>Round-off:</span>
                <span>{invoice.roundOff >= 0 ? `+ ₹${invoice.roundOff}` : `- ₹${Math.abs(invoice.roundOff)}`}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', borderTop: '2px solid #0f172a', paddingTop: '6px', marginTop: '4px' }}>
              <span>Total Invoice Amount:</span>
              <span style={{ color: '#1d4ed8' }}>{formatINR(invoice.grandTotal)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857', fontWeight: 600 }}>
              <span>Amount Received:</span>
              <span>{formatINR(invoice.amountPaid)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: Number(invoice.balanceDue) > 0 ? '#b91c1c' : '#15803d', fontWeight: 700, paddingTop: '4px', borderTop: '1px dashed #cbd5e1' }}>
              <span>Balance Due:</span>
              <span>{formatINR(invoice.balanceDue)}</span>
            </div>
          </div>
        </div>

        {/* Signature & Authorized Representative Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748b', maxWidth: '320px' }}>
            Certified that the particulars given above are true and correct, and the amount indicated represents the price actually charged.
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '2.5rem', color: '#0f172a' }}>
              For NSS-TEX TOWELS & TEXTILES
            </div>
            <div style={{ borderTop: '1px dashed #64748b', width: '180px', paddingTop: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {isPaymentModalOpen && (
        <Modal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          title={`Record Payment for ${invoice.invoiceNo}`}
          maxWidth="1120px"
        >
          <form onSubmit={handleRecordPayment}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Payment Amount (₹) <span className="required">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={invoice.balanceDue}
                  className="form-control"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select className="form-control" value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                  <option value="RTGS">RTGS</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Payment Date</label>
                <input type="date" className="form-control" value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Reference / UTR</label>
                <input type="text" className="form-control" placeholder="Transaction ID or Cheque No" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Payment
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
