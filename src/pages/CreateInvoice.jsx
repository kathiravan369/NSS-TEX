import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Receipt,
  Plus,
  Trash2,
  Save,
  Send,
  Eye,
  Printer,
  Download,
  Building2,
  Calendar,
  Truck,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Info
} from 'lucide-react';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';
import { storageService } from '../services/storageService';
import { api } from '../services/api';
import { formatINR, formatDate } from '../utils/formatters';

// Standard towel product catalog for NSS-TEX
export const DEFAULT_PRODUCTS = [
  { name: 'Bath Towel - Large (30 × 60)', sku: 'TWL-BTH-L3060', category: 'Towels', unit: 'Pcs', rate: 160, gstRate: 12 },
  { name: 'Bath Towel - Medium (27 × 54)', sku: 'TWL-BTH-M2754', category: 'Towels', unit: 'Pcs', rate: 130, gstRate: 12 },
  { name: 'Bath Towel - Small (24 × 47)', sku: 'TWL-BTH-S2447', category: 'Towels', unit: 'Pcs', rate: 100, gstRate: 12 },
  { name: 'Cotton Terry Hand Towel (16 × 24)', sku: 'TWL-HND-1624', category: 'Towels', unit: 'Pcs', rate: 70, gstRate: 12 },
  { name: 'Face Towel / Napkin (12 × 12)', sku: 'TWL-FCE-1212', category: 'Towels', unit: 'Pcs', rate: 40, gstRate: 12 },
  { name: 'Jacquard Dobby Border Towel', sku: 'TWL-JCQ-DOBBY', category: 'Towels', unit: 'Pcs', rate: 145, gstRate: 12 },
  { name: 'Bleached Cotton Export Towel', sku: 'TWL-BLC-EXP', category: 'Towels', unit: 'Pcs', rate: 125, gstRate: 12 },
  { name: 'Heavy GSM Bath Mat Terry', sku: 'TEX-MAT-GSM', category: 'Textiles', unit: 'Pcs', rate: 110, gstRate: 12 }
];

export const SALESPERSON_LIST = [
  'K. Kathiravan (Director)',
  'R. Sundaram (Senior Sales)',
  'M. Prakash (Field Executive)',
  'S. Venkatesh (Regional)',
  'Direct Company Billing'
];

export default function CreateInvoice() {
  const navigate = useNavigate();
  const { id } = useParams(); // If present, edit mode
  const isEditMode = Boolean(id);

  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Quick Customer Creation modal
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustCity, setQuickCustCity] = useState('');
  const [quickCustGstin, setQuickCustGstin] = useState('');

  // Invoice Header Fields
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [referenceNo, setReferenceNo] = useState('');

  // Other Details
  const [vehicleNo, setVehicleNo] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [challanNo, setChallanNo] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [salesperson, setSalesperson] = useState('Direct Company Billing');
  const [dispatchNo, setDispatchNo] = useState('');

  // Shipping details override
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [shippingAddress, setShippingAddress] = useState({
    addressLine: '',
    city: '',
    state: 'Tamil Nadu',
    pincode: '',
    country: 'India'
  });

  // Line Items - Start with clean blank row
  const [items, setItems] = useState([
    {
      id: 1,
      productName: '',
      sku: '',
      category: 'Towels',
      unit: 'Pcs',
      quantity: 1,
      rate: 0,
      discount: 0,
      gstRate: 12
    }
  ]);

  // Financials & Discounts
  const [extraDiscount, setExtraDiscount] = useState(0);
  const [initialPayment, setInitialPayment] = useState(0);
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');
  const [paymentReference, setPaymentReference] = useState('');

  // Additional Details
  const [notes, setNotes] = useState('Thank you for choosing NSS-TEX Towels & Textiles. We appreciate your partnership.');
  const [terms, setTerms] = useState('1. Goods once sold will not be taken back.\n2. Interest @ 18% per annum will be charged if payment is delayed beyond due date.\n3. All disputes subject to Coimbatore jurisdiction.');
  const [bankDetails] = useState({
    bankName: 'State Bank of India',
    accountName: 'NSS TOWELS & TEXTILES',
    accountNumber: '38920194829',
    ifscCode: 'SBIN0001234',
    branch: 'Coimbatore Main Branch'
  });

  const [toast, setToast] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load Customers & Initial Data
  useEffect(() => {
    const initialize = async () => {
      try {
        const custList = await storageService.fetchLiveCollection('customers');
        setCustomers(custList || []);

        if (isEditMode) {
          const invRes = await api.sales.invoices.getById(id);
          if (invRes && invRes.success && invRes.data) {
            const inv = invRes.data;
            setInvoiceNo(inv.invoiceNo || '');
            setInvoiceDate(inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split('T')[0] : '');
            setDueDate(inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : '');
            setReferenceNo(inv.referenceNo || '');
            setVehicleNo(inv.vehicleNo || '');
            setPoNumber(inv.poNumber || '');
            setChallanNo(inv.challanNo || '');
            setDeliveryDate(inv.deliveryDate ? new Date(inv.deliveryDate).toISOString().split('T')[0] : '');
            setSalesperson(inv.salesperson || 'Direct Company Billing');
            setDispatchNo(inv.dispatchNo || '');
            setExtraDiscount(inv.extraDiscount || 0);
            setInitialPayment(inv.amountPaid || 0);
            setNotes(inv.notes || '');
            setTerms(inv.terms || '');
            setSelectedCustomerId(inv.customerId || '');
            setSelectedCustomer(inv.customerSnapshot || null);

            if (Array.isArray(inv.items) && inv.items.length > 0) {
              setItems(inv.items.map((it, idx) => ({ ...it, id: idx + 1 })));
            }
          }
        } else {
          // Fetch next sequential invoice number
          try {
            const nextRes = await api.sales.invoices.getNextNumber();
            if (nextRes && nextRes.nextNumber) {
              setInvoiceNo(nextRes.nextNumber);
            }
          } catch (e) {
            const currentYear = new Date().getFullYear();
            setInvoiceNo(`INV-${currentYear}-0001`);
          }
        }
      } catch (err) {
        console.warn('Error initializing invoice form:', err.message);
      }
    };

    initialize();
  }, [id, isEditMode]);

  // Handle customer selection change
  const handleCustomerChange = (custId) => {
    setSelectedCustomerId(custId);
    const found = customers.find(c => String(c.id) === String(custId) || String(c._id) === String(custId));
    if (found) {
      setSelectedCustomer(found);
      if (sameAsBilling) {
        setShippingAddress(found.shippingAddress || found.billingAddress || {});
      }
    } else {
      setSelectedCustomer(null);
    }
  };

  // Determine if state is intra-state (Tamil Nadu, state code 33)
  const isIntraState = useMemo(() => {
    const custState = (sameAsBilling
      ? selectedCustomer?.billingAddress?.state
      : shippingAddress?.state) || selectedCustomer?.billingAddress?.state || 'Tamil Nadu';
    const gstin = selectedCustomer?.gstin || '';
    if (gstin && gstin.startsWith('33')) return true;
    if (custState.toLowerCase().includes('tamil') || custState.toLowerCase().includes('tn')) return true;
    return false;
  }, [selectedCustomer, shippingAddress, sameAsBilling]);

  // Real-time calculation of invoice line items & totals
  const calculations = useMemo(() => {
    let subtotal = 0;
    let itemDiscountTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    const computedItems = items.map(item => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const discount = Math.min(qty * rate, Number(item.discount) || 0);
      const gross = qty * rate;
      const taxable = Math.max(0, gross - discount);
      const gstRate = Number(item.gstRate !== undefined ? item.gstRate : 12);

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isIntraState) {
        cgst = Math.round(((taxable * (gstRate / 200)) + Number.EPSILON) * 100) / 100;
        sgst = Math.round(((taxable * (gstRate / 200)) + Number.EPSILON) * 100) / 100;
      } else {
        igst = Math.round(((taxable * (gstRate / 100)) + Number.EPSILON) * 100) / 100;
      }

      const total = Math.round((taxable + cgst + sgst + igst) * 100) / 100;

      subtotal += gross;
      itemDiscountTotal += discount;
      cgstTotal += cgst;
      sgstTotal += sgst;
      igstTotal += igst;

      return {
        ...item,
        taxableAmount: taxable,
        cgst,
        sgst,
        igst,
        total
      };
    });

    const parsedExtraDiscount = Math.min(subtotal - itemDiscountTotal, Number(extraDiscount) || 0);
    const taxableAmount = Math.max(0, subtotal - itemDiscountTotal - parsedExtraDiscount);

    // Prorate taxes if extra discount is provided
    const discountRatio = (subtotal - itemDiscountTotal) > 0 ? taxableAmount / (subtotal - itemDiscountTotal) : 1;
    const finalCgst = Math.round((cgstTotal * discountRatio + Number.EPSILON) * 100) / 100;
    const finalSgst = Math.round((sgstTotal * discountRatio + Number.EPSILON) * 100) / 100;
    const finalIgst = Math.round((igstTotal * discountRatio + Number.EPSILON) * 100) / 100;
    const totalGst = Math.round((finalCgst + finalSgst + finalIgst) * 100) / 100;

    const rawGrandTotal = taxableAmount + totalGst;
    const grandTotal = Math.round(rawGrandTotal);
    const roundOff = Math.round((grandTotal - rawGrandTotal + Number.EPSILON) * 100) / 100;

    const balanceDue = Math.max(0, grandTotal - (Number(initialPayment) || 0));

    return {
      items: computedItems,
      subtotal,
      itemDiscountTotal,
      taxableAmount,
      cgstAmount: finalCgst,
      sgstAmount: finalSgst,
      igstAmount: finalIgst,
      totalGst,
      roundOff,
      grandTotal,
      balanceDue
    };
  }, [items, extraDiscount, isIntraState, initialPayment]);

  // Line item handlers
  const handleAddItem = () => {
    const nextId = items.length > 0 ? Math.max(...items.map(i => i.id || 0)) + 1 : 1;
    setItems([
      ...items,
      {
        id: nextId,
        productName: 'Cotton Terry Hand Towel (16 × 24)',
        sku: 'TWL-HND-1624',
        category: 'Towels',
        unit: 'Pcs',
        quantity: 50,
        rate: 70,
        discount: 0,
        gstRate: 12
      }
    ]);
  };

  const handleRemoveItem = (idx) => {
    if (items.length === 1) {
      showToast('Invoice must have at least one product row.', 'error');
      return;
    }
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, val) => {
    const updated = [...items];
    if (field === 'productSelect') {
      const catalogItem = DEFAULT_PRODUCTS.find(p => p.name === val);
      if (catalogItem) {
        updated[idx] = {
          ...updated[idx],
          productName: catalogItem.name,
          sku: catalogItem.sku,
          category: catalogItem.category,
          unit: catalogItem.unit,
          rate: catalogItem.rate,
          gstRate: catalogItem.gstRate
        };
      }
    } else {
      updated[idx] = {
        ...updated[idx],
        [field]: val
      };
    }
    setItems(updated);
  };

  // Quick Customer Creation
  const handleQuickCustomerSubmit = async (e) => {
    e.preventDefault();
    if (!quickCustName || !quickCustPhone) {
      showToast('Name and Phone are required.', 'error');
      return;
    }

    try {
      const newCust = await api.sales.customers.create({
        name: quickCustName.trim(),
        phone: quickCustPhone.trim(),
        gstin: quickCustGstin.trim().toUpperCase(),
        billingAddress: {
          city: quickCustCity.trim() || 'Coimbatore',
          state: 'Tamil Nadu',
          country: 'India'
        },
        shippingAddress: {
          city: quickCustCity.trim() || 'Coimbatore',
          state: 'Tamil Nadu',
          country: 'India'
        },
        sameAsBilling: true
      });

      if (newCust && newCust.success && newCust.data) {
        showToast('New customer added successfully.');
        setCustomers([newCust.data, ...customers]);
        setSelectedCustomerId(newCust.data.id || newCust.data._id);
        setSelectedCustomer(newCust.data);
        setIsQuickCustomerOpen(false);
        setQuickCustName('');
        setQuickCustPhone('');
        setQuickCustCity('');
        setQuickCustGstin('');
      }
    } catch (err) {
      showToast(err.message || 'Failed to create customer', 'error');
    }
  };

  // Save or Issue Invoice
  const handleSaveInvoice = async (targetStatus = 'Issued') => {
    if (!selectedCustomer) {
      showToast('Please select a customer for this invoice.', 'error');
      return;
    }

    if (!items.length) {
      showToast('Please add at least one product item.', 'error');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      if (!items[i].productName.trim()) {
        showToast(`Please enter product name on line ${i + 1}`, 'error');
        return;
      }
      if (Number(items[i].quantity) <= 0) {
        showToast(`Quantity must be greater than zero on line ${i + 1}`, 'error');
        return;
      }
    }

    setIsSubmitting(true);

    const payload = {
      invoiceNo: invoiceNo.trim(),
      invoiceDate,
      dueDate,
      referenceNo,
      customerId: selectedCustomer.id || selectedCustomerId,
      customerSnapshot: {
        id: selectedCustomer.id,
        customerId: selectedCustomer.customerId,
        name: selectedCustomer.name,
        companyName: selectedCustomer.companyName,
        phone: selectedCustomer.phone,
        email: selectedCustomer.email,
        gstin: selectedCustomer.gstin,
        pan: selectedCustomer.pan,
        billingAddress: selectedCustomer.billingAddress,
        shippingAddress: sameAsBilling ? selectedCustomer.billingAddress : shippingAddress
      },
      vehicleNo,
      poNumber,
      challanNo,
      deliveryDate,
      salesperson,
      dispatchNo,
      items: calculations.items,
      extraDiscount: Number(extraDiscount) || 0,
      initialPayment: Number(initialPayment) || 0,
      paymentMode,
      paymentReference,
      invoiceStatus: targetStatus,
      notes,
      terms,
      bankDetails
    };

    try {
      let savedResult;
      if (isEditMode) {
        savedResult = await api.sales.invoices.update(id, payload);
        showToast('Invoice updated successfully.');
      } else {
        savedResult = await api.sales.invoices.create(payload);
        showToast(targetStatus === 'Draft' ? 'Invoice saved as draft.' : 'Tax Invoice issued successfully.');
      }

      if (savedResult && savedResult.success && savedResult.data) {
        navigate(`/sales/invoices/${savedResult.data._id || savedResult.data.id}`);
      } else {
        navigate('/sales/invoices');
      }
    } catch (err) {
      showToast(err.message || 'Failed to save invoice', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '2.5rem' }}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Top Header matching reference screenshot 1 */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/sales/invoices')}
            title="Back to invoices"
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <h2 className="page-title" style={{ fontSize: '1.35rem', fontWeight: 700 }}>
              {isEditMode ? `Edit Invoice — ${invoiceNo}` : 'Create Invoice'}
            </h2>
            <p className="page-subtitle" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Complete customer billing form with tax calculations, items and terms
            </p>
          </div>
        </div>

        {/* Action Buttons Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleSaveInvoice('Draft')}
            disabled={isSubmitting}
          >
            <Save size={14} /> Save as Draft
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => window.print()}
          >
            <Printer size={14} /> Print
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => window.print()}
          >
            <Download size={14} /> Download PDF
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => handleSaveInvoice('Issued')}
            disabled={isSubmitting}
            style={{ fontWeight: 600, padding: '0.45rem 1rem' }}
          >
            <Send size={14} /> Issue Invoice
          </button>
        </div>
      </div>

      {/* Top Grid: Customer Details (Left) + Invoice Info & Other Details (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: '1.25rem' }}>
        
        {/* Left Card: Customer Details */}
        <div className="erp-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.65rem' }}>
            <h3 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--primary-700)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-600)' }} />
              Customer Details
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>GST State: {isIntraState ? 'Tamil Nadu (Intra-state)' : 'Inter-state (IGST)'}</span>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>Select Customer <span className="required">*</span></label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select
                className="form-control"
                value={selectedCustomerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                style={{ flex: 1, fontWeight: 600 }}
              >
                <option value="">-- Choose Customer --</option>
                {customers.map((c) => (
                  <option key={c.id || c._id} value={c.id || c._id}>
                    {c.customerId ? `[${c.customerId}] ` : ''}{c.name} {c.companyName ? `(${c.companyName})` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setIsQuickCustomerOpen(true)}
                style={{ whiteSpace: 'nowrap' }}
              >
                + New
              </button>
            </div>
          </div>

          {/* Billing & Shipping Address Split Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            {/* Billing Address Box */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.85rem', backgroundColor: '#f8fafc' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e3a8a', marginBottom: '4px' }}>Billing Address</div>
              {selectedCustomer ? (
                <div style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.4 }}>
                  <div style={{ fontWeight: 600 }}>{selectedCustomer.name}</div>
                  <div>{selectedCustomer.billingAddress?.addressLine || 'Address not set'}</div>
                  <div>{selectedCustomer.billingAddress?.city || ''}{selectedCustomer.billingAddress?.pincode ? ` - ${selectedCustomer.billingAddress.pincode}` : ''}</div>
                  <div>{selectedCustomer.billingAddress?.state || 'Tamil Nadu'}</div>
                  <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    GSTIN: <strong>{selectedCustomer.gstin || 'Unregistered'}</strong>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Please select a customer</div>
              )}
            </div>

            {/* Shipping Address Box */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.85rem', backgroundColor: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e3a8a' }}>Shipping Address</div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600, color: '#475569' }}>
                  <input
                    type="checkbox"
                    checked={sameAsBilling}
                    onChange={(e) => setSameAsBilling(e.target.checked)}
                    style={{ accentColor: 'var(--primary-600)' }}
                  />
                  Same as Billing
                </label>
              </div>

              {sameAsBilling ? (
                selectedCustomer ? (
                  <div style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.4 }}>
                    <div style={{ fontWeight: 600 }}>{selectedCustomer.name}</div>
                    <div>{selectedCustomer.shippingAddress?.addressLine || selectedCustomer.billingAddress?.addressLine || 'Address not set'}</div>
                    <div>{selectedCustomer.shippingAddress?.city || selectedCustomer.billingAddress?.city || ''}{selectedCustomer.shippingAddress?.pincode ? ` - ${selectedCustomer.shippingAddress.pincode}` : ''}</div>
                    <div>{selectedCustomer.shippingAddress?.state || selectedCustomer.billingAddress?.state || 'Tamil Nadu'}</div>
                    <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      GSTIN: <strong>{selectedCustomer.gstin || 'Unregistered'}</strong>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Same as billing address</div>
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Delivery Address"
                    style={{ fontSize: '0.75rem', height: '28px' }}
                    value={shippingAddress.addressLine}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, addressLine: e.target.value })}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="City"
                      style={{ fontSize: '0.75rem', height: '28px' }}
                      value={shippingAddress.city}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                    />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="State"
                      style={{ fontSize: '0.75rem', height: '28px' }}
                      value={shippingAddress.state}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Cards: Invoice Info + Other Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Invoice Information */}
          <div className="erp-card" style={{ padding: '1.15rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary-700)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-600)' }} />
              Invoice Information
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Invoice No</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontWeight: 700, backgroundColor: '#f8fafc', height: '34px', fontSize: '0.8rem' }}
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Invoice Date</label>
                <input
                  type="date"
                  className="form-control"
                  style={{ height: '34px', fontSize: '0.78rem' }}
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Due Date</label>
                <input
                  type="date"
                  className="form-control"
                  style={{ height: '34px', fontSize: '0.78rem' }}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Reference No</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="PO-1234"
                  style={{ height: '34px', fontSize: '0.78rem' }}
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Other Details / Custom Header Fields */}
          <div className="erp-card" style={{ padding: '1.15rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary-700)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-600)' }} />
              Other Details
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Vehicle No</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="TN 37 AB 1234"
                  style={{ height: '32px', fontSize: '0.78rem' }}
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem' }}>PO Number</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="PO-5678"
                  style={{ height: '32px', fontSize: '0.78rem' }}
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Challan No</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="CH-001"
                  style={{ height: '32px', fontSize: '0.78rem' }}
                  value={challanNo}
                  onChange={(e) => setChallanNo(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Delivery Date</label>
                <input
                  type="date"
                  className="form-control"
                  style={{ height: '32px', fontSize: '0.78rem' }}
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Salesperson</label>
                <select
                  className="form-control"
                  style={{ height: '32px', fontSize: '0.75rem' }}
                  value={salesperson}
                  onChange={(e) => setSalesperson(e.target.value)}
                >
                  {SALESPERSON_LIST.map(sp => (
                    <option key={sp} value={sp}>{sp}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Dispatch No</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="DSP-001"
                  style={{ height: '32px', fontSize: '0.78rem' }}
                  value={dispatchNo}
                  onChange={(e) => setDispatchNo(e.target.value)}
                />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Products Table Card matching billing design reference */}
      <div className="erp-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <h3 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--primary-700)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-600)' }} />
            Product Items & Quantity ({items.length})
          </h3>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleAddItem}
            style={{ fontSize: '0.75rem' }}
          >
            <Plus size={14} /> + Add Item
          </button>
        </div>

        <div className="table-responsive">
          <table className="erp-table" style={{ fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th style={{ minWidth: '220px' }}>Product Description</th>
                <th style={{ width: '120px' }}>Category</th>
                <th style={{ width: '80px' }}>Unit</th>
                <th style={{ width: '90px' }}>Qty</th>
                <th style={{ width: '100px' }}>Rate (₹)</th>
                <th style={{ width: '90px' }}>Disc (₹)</th>
                <th style={{ width: '85px' }}>GST %</th>
                <th style={{ width: '110px' }}>Taxable (₹)</th>
                <th style={{ width: '110px' }}>Total (₹)</th>
                <th style={{ width: '45px', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {calculations.items.map((row, idx) => (
                <tr key={row.id || idx}>
                  <td>{idx + 1}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <select
                        className="form-control"
                        style={{ height: '30px', fontSize: '0.78rem' }}
                        value={DEFAULT_PRODUCTS.some(p => p.name === row.productName) ? row.productName : 'custom'}
                        onChange={(e) => {
                          if (e.target.value !== 'custom') {
                            handleItemChange(idx, 'productSelect', e.target.value);
                          }
                        }}
                      >
                        <option value="custom">-- Custom Product / Presets --</option>
                        {DEFAULT_PRODUCTS.map(p => (
                          <option key={p.name} value={p.name}>{p.name} (₹{p.rate})</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Product Description"
                        style={{ height: '28px', fontSize: '0.75rem' }}
                        value={row.productName}
                        onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                        required
                      />
                    </div>
                  </td>
                  <td>
                    <input
                      type="text"
                      className="form-control"
                      style={{ height: '30px', fontSize: '0.75rem' }}
                      value={row.category || 'Towels'}
                      onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      className="form-control"
                      style={{ height: '30px', fontSize: '0.75rem' }}
                      value={row.unit || 'Pcs'}
                      onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                    >
                      <option value="Pcs">Pcs</option>
                      <option value="Dozens">Dozens</option>
                      <option value="Bundles">Bundles</option>
                      <option value="Kg">Kg</option>
                      <option value="Metres">Metres</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="form-control"
                      style={{ height: '30px', fontSize: '0.78rem', fontWeight: 600 }}
                      value={row.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-control"
                      style={{ height: '30px', fontSize: '0.78rem', fontWeight: 600 }}
                      value={row.rate}
                      onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-control"
                      style={{ height: '30px', fontSize: '0.78rem' }}
                      value={row.discount}
                      onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      className="form-control"
                      style={{ height: '30px', fontSize: '0.75rem' }}
                      value={row.gstRate}
                      onChange={(e) => handleItemChange(idx, 'gstRate', Number(e.target.value))}
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {formatINR(row.taxableAmount)}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--primary-700)' }}>
                    {formatINR(row.total)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="icon-button"
                      style={{ color: '#dc2626' }}
                      onClick={() => handleRemoveItem(idx)}
                      title="Remove product row"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Grid: Left (Payment, Bank, Notes) + Right (Calculations Summary) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '1.25rem' }}>
        
        {/* Left: Payment Settlement & Terms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Payment Details */}
          <div className="erp-card" style={{ padding: '1.15rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary-700)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-600)' }} />
              Payment & Settlement
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Payment Mode</label>
                <select
                  className="form-control"
                  style={{ height: '34px', fontSize: '0.78rem' }}
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                >
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                  <option value="RTGS">RTGS</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="Credit">Credit (Pay Later)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Amount Received (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={calculations.grandTotal}
                  className="form-control"
                  placeholder="0.00"
                  style={{ height: '34px', fontSize: '0.85rem', fontWeight: 700, color: '#047857' }}
                  value={initialPayment}
                  onChange={(e) => setInitialPayment(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Payment Ref / UTR</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. UTR-9982310"
                  style={{ height: '34px', fontSize: '0.78rem' }}
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Notes & Bank Details Card */}
          <div className="erp-card" style={{ padding: '1.15rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Notes for Customer</label>
                <textarea
                  className="form-control"
                  rows={3}
                  style={{ fontSize: '0.75rem' }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Terms & Conditions</label>
                <textarea
                  className="form-control"
                  rows={3}
                  style={{ fontSize: '0.75rem' }}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                />
              </div>
            </div>

            {/* Bank Info Snapshot */}
            <div style={{ marginTop: '0.65rem', padding: '0.65rem 0.85rem', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '0.72rem', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
              <div><strong>Bank:</strong> {bankDetails.bankName} | <strong>A/C:</strong> {bankDetails.accountNumber}</div>
              <div><strong>IFSC:</strong> {bankDetails.ifscCode} | <strong>Branch:</strong> {bankDetails.branch}</div>
            </div>
          </div>

        </div>

        {/* Right: Calculations Summary Card */}
        <div className="erp-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--primary-700)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-600)' }} />
              Calculations Summary
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Subtotal (Gross):</span>
                <span>{formatINR(calculations.subtotal)}</span>
              </div>

              {calculations.itemDiscountTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                  <span>Item Discounts:</span>
                  <span>- {formatINR(calculations.itemDiscountTotal)}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#475569' }}>Extra Invoice Discount (₹):</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  style={{ width: '110px', height: '28px', textAlign: 'right', fontSize: '0.8rem' }}
                  value={extraDiscount}
                  onChange={(e) => setExtraDiscount(Number(e.target.value))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#1e293b', paddingTop: '4px', borderTop: '1px dashed #e2e8f0' }}>
                <span>Taxable Amount:</span>
                <span>{formatINR(calculations.taxableAmount)}</span>
              </div>

              {/* GST Breakdown: CGST + SGST or IGST */}
              {isIntraState ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem' }}>
                    <span>CGST:</span>
                    <span>{formatINR(calculations.cgstAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem' }}>
                    <span>SGST:</span>
                    <span>{formatINR(calculations.sgstAmount)}</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem' }}>
                  <span>IGST (Inter-state):</span>
                  <span>{formatINR(calculations.igstAmount)}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem' }}>
                <span>Round-off:</span>
                <span>{calculations.roundOff >= 0 ? `+ ₹${calculations.roundOff}` : `- ₹${Math.abs(calculations.roundOff)}`}</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '2px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>Grand Total:</span>
              <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary-700)' }}>
                {formatINR(calculations.grandTotal)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              <span style={{ color: '#047857', fontWeight: 600 }}>Amount Received:</span>
              <span style={{ color: '#047857', fontWeight: 700 }}>{formatINR(initialPayment || 0)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', paddingTop: '6px', borderTop: '1px dashed #cbd5e1' }}>
              <span style={{ color: calculations.balanceDue > 0 ? '#b91c1c' : '#475569', fontWeight: 700 }}>Balance Due:</span>
              <span style={{ color: calculations.balanceDue > 0 ? '#dc2626' : '#15803d', fontWeight: 800 }}>
                {formatINR(calculations.balanceDue)}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Quick Customer Creation Modal */}
      <Modal
        isOpen={isQuickCustomerOpen}
        onClose={() => setIsQuickCustomerOpen(false)}
        title="Quick Add Customer"
        maxWidth="500px"
      >
        <form onSubmit={handleQuickCustomerSubmit} style={{ width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Customer Name <span className="required">*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="Full customer name"
                value={quickCustName}
                onChange={(e) => setQuickCustName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number <span className="required">*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="10-digit phone"
                value={quickCustPhone}
                onChange={(e) => setQuickCustPhone(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Coimbatore, Salem, Tirupur"
                value={quickCustCity}
                onChange={(e) => setQuickCustCity(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">GSTIN (Optional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 33ABCDE1234F1Z5"
                maxLength={15}
                value={quickCustGstin}
                onChange={(e) => setQuickCustGstin(e.target.value.toUpperCase())}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsQuickCustomerOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Customer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
