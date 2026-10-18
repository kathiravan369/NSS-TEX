// Centralized Data Management & Storage Service
// Integrates React.js components with Node.js backend REST APIs and localStorage cache

import { api } from './api';
import { formatDate, formatDateTime, getItemDueDate, isOverdue, getPaymentStatus } from '../utils/formatters';

function getStorage(key, fallback = []) {
  try {
    const item = localStorage.getItem(`nsstowels_${key}`);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
}

function setStorage(key, val) {
  try {
    localStorage.setItem(`nsstowels_${key}`, JSON.stringify(val));
  } catch (e) {
    console.error('Storage save error:', e);
  }
}

// Ensure all ERP module caches are cleanly wiped on the client side for a fresh start
if (typeof window !== 'undefined' && !localStorage.getItem('nsstowels_all_data_cleared_v1')) {
  try {
    const allKeys = [
      'employees',
      'threadGST',
      'threadNoGST',
      'oil',
      'oilStock',
      'machinery',
      'electricity',
      'weeklyPayroll',
      'customers',
      'invoices',
      'salesPayments'
    ];
    allKeys.forEach(k => {
      localStorage.removeItem(`nsstowels_${k}`);
    });
    localStorage.setItem('nsstowels_all_data_cleared_v1', 'true');
  } catch (e) {
    // Ignore storage access restrictions
  }
}

// Safe ID generator for client-side storage
function generateUniqueId() {
  return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
}

// Automatically cleans up accidental duplicate records caused by edit re-creations
export function cleanAccidentalDuplicates(list) {
  if (!Array.isArray(list) || list.length <= 1) return list;
  const seen = new Map();
  const cleaned = [];

  for (const item of list) {
    // Fingerprint based on identical physical item specifications
    const specKey = item.invoiceNo
      ? `inv_${item.invoiceNo}`
      : `${item.supplier || ''}_${item.threadType || item.machine || item.oilType || ''}_${item.qty || ''}_${item.rate || item.cost || ''}_${item.total || ''}`;

    const isSpecificItem = (item.supplier || item.machine) && item.total;

    if (isSpecificItem && specKey) {
      if (!seen.has(specKey)) {
        seen.set(specKey, item);
        cleaned.push(item);
      } else {
        // Keep the latest edit (higher paidAmount or more recent updatedAt)
        const existing = seen.get(specKey);
        const existingPaid = Number(existing.paidAmount || 0);
        const itemPaid = Number(item.paidAmount || 0);
        const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const itemTime = new Date(item.updatedAt || item.createdAt || 0).getTime();

        if (itemPaid > existingPaid || (itemPaid === existingPaid && itemTime > existingTime)) {
          const idx = cleaned.indexOf(existing);
          if (idx !== -1) {
            cleaned[idx] = {
              ...existing,
              ...item,
              id: existing.id || item.id,
              _id: existing._id || item._id,
              dueDate: item.dueDate || existing.dueDate
            };
            seen.set(specKey, cleaned[idx]);
          }
        }
      }
    } else {
      cleaned.push(item);
    }
  }

  return cleaned;
}

export const storageService = {
  // Synchronous Local Cache Access with Guaranteed Unique IDs and Auto-Deduplication
  getCollection(key) {
    const rawList = getStorage(key, []);
    let modified = false;

    // 1. Clean accidental duplicate records created during edit bug
    const dedupedList = cleanAccidentalDuplicates(rawList);
    if (dedupedList.length !== rawList.length) {
      modified = true;
    }

    // 2. Guarantee every item has a unique, non-empty id and _id
    const sanitized = dedupedList.map((item, idx) => {
      const existingId = item._id || item.id;
      if (!existingId) {
        modified = true;
        const genId = `rec_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 6)}`;
        return { ...item, id: genId, _id: genId };
      }
      if (!item.id && item._id) {
        modified = true;
        return { ...item, id: item._id };
      }
      if (!item._id && item.id) {
        modified = true;
        return { ...item, _id: String(item.id) };
      }
      return item;
    });

    if (modified) {
      setStorage(key, sanitized);
    }
    return sanitized;
  },

  saveCollection(key, data) {
    setStorage(key, data);
  },

  // Add Item to Local State & Dispatches to Backend REST API
  async addItem(key, item) {
    const genId = generateUniqueId();
    let newItem = {
      ...item,
      id: item.id || item._id || genId,
      _id: item._id || item.id || genId
    };

    try {
      let res;
      switch (key) {
        case 'employees':
          res = await api.employees.create(item);
          break;
        case 'threadGST':
          res = await api.threadPurchases.create({ ...item, gstMode: 'WITH_GST' });
          break;
        case 'threadNoGST':
          res = await api.threadPurchases.create({ ...item, gstMode: 'WITHOUT_GST' });
          break;
        case 'oil':
          res = await api.oil.createPurchase(item);
          break;
        case 'machinery':
          res = await api.machinery.create(item);
          break;
        case 'electricity':
          res = await api.electricity.create(item);
          break;
        case 'weeklyPayroll':
          res = await api.payroll.createWeekly(item);
          break;
        case 'customers':
          res = await api.sales.customers.create(item);
          break;
        case 'invoices':
          res = await api.sales.invoices.create(item);
          break;
        default:
          break;
      }
      if (res && res.success && res.data) {
        newItem = {
          ...res.data,
          id: res.data._id || res.data.id || newItem.id,
          _id: res.data._id || res.data.id || newItem._id
        };
      }
    } catch (err) {
      console.warn(`[Sync Warning] Direct API save for ${key}:`, err.message);
    }

    const now = new Date().toISOString();
    if (!newItem.createdAt) newItem.createdAt = now;
    if (!newItem.updatedAt) newItem.updatedAt = now;

    const list = this.getCollection(key);
    list.unshift(newItem);
    this.saveCollection(key, list);
    return newItem;
  },

  // Update Item in Local State & Backend REST API
  async updateItem(key, id, updatedItem) {
    const list = this.getCollection(key);
    const searchId = String(id);
    const index = list.findIndex(x =>
      String(x.id) === searchId ||
      String(x._id) === searchId ||
      (x.invoiceNo && updatedItem.invoiceNo && x.invoiceNo === updatedItem.invoiceNo)
    );
    let merged = { ...updatedItem, id: id, _id: id };
    const now = new Date().toISOString();

    if (index !== -1) {
      const existing = list[index];
      merged = {
        ...existing,
        ...updatedItem,
        id: existing.id || existing._id || id,
        _id: existing._id || existing.id || id,
        updatedAt: now
      };
      if (!merged.createdAt && existing.createdAt) merged.createdAt = existing.createdAt;
      list[index] = merged;
      this.saveCollection(key, list);
    } else {
      merged.updatedAt = now;
      if (!merged.createdAt) merged.createdAt = now;
      list.unshift(merged);
      this.saveCollection(key, list);
    }

    try {
      const syncId = merged._id || merged.id || id;
      switch (key) {
        case 'employees':
          await api.employees.update(syncId, merged);
          break;
        case 'threadGST':
        case 'threadNoGST':
          await api.threadPurchases.update(syncId, merged);
          break;
        case 'oil':
          await api.oil.updatePurchase(syncId, merged);
          break;
        case 'machinery':
          await api.machinery.update(syncId, merged);
          break;
        case 'electricity':
          await api.electricity.update(syncId, merged);
          break;
        case 'weeklyPayroll':
          await api.payroll.updateWeekly(syncId, merged);
          break;
        case 'customers':
          await api.sales.customers.update(syncId, merged);
          break;
        case 'invoices':
          await api.sales.invoices.update(syncId, merged);
          break;
        default:
          break;
      }
    } catch (err) {
      console.warn(`[Sync Warning] Update ${key} to backend:`, err.message);
    }

    return merged;
  },

  // Delete Item in Local State & Backend REST API
  async deleteItem(key, id) {
    let list = this.getCollection(key);
    const searchId = String(id);
    const itemToDelete = list.find(x => String(x.id) === searchId || String(x._id) === searchId);
    list = list.filter(x => String(x.id) !== searchId && String(x._id) !== searchId);
    this.saveCollection(key, list);

    try {
      const syncId = (itemToDelete && (itemToDelete._id || itemToDelete.id)) || id;
      switch (key) {
        case 'threadGST':
        case 'threadNoGST':
          await api.threadPurchases.delete(syncId);
          break;
        case 'machinery':
          await api.machinery.delete(syncId);
          break;
        case 'electricity':
          await api.electricity.delete(syncId);
          break;
        case 'customers':
          await api.sales.customers.delete(syncId);
          break;
        case 'invoices':
          await api.sales.invoices.delete(syncId);
          break;
        default:
          break;
      }
    } catch (err) {
      console.warn(`[Sync Warning] Delete ${key} from backend:`, err.message);
    }

    return true;
  },

  // Async Live Fetchers for direct DB & API population
  async fetchLiveCollection(key, params = {}) {
    try {
      let res;
      switch (key) {
        case 'employees':
          res = await api.employees.getAll(params);
          break;
        case 'threadGST':
          res = await api.threadPurchases.getAll({ ...params, gstMode: 'WITH_GST' });
          break;
        case 'threadNoGST':
          res = await api.threadPurchases.getAll({ ...params, gstMode: 'WITHOUT_GST' });
          break;
        case 'oil':
          res = await api.oil.getPurchases(params);
          break;
        case 'oilStock':
          res = await api.oil.getStock();
          break;
        case 'machinery':
          res = await api.machinery.getAll(params);
          break;
        case 'electricity':
          res = await api.electricity.getAll(params);
          break;
        case 'weeklyPayroll':
          res = await api.payroll.getWeekly(params);
          break;
        case 'customers':
          res = await api.sales.customers.getAll(params);
          break;
        case 'invoices':
          res = await api.sales.invoices.getAll(params);
          break;
        default:
          return this.getCollection(key);
      }

      if (res && res.success && Array.isArray(res.data)) {
        const cachedList = this.getCollection(key);
        const cachedMap = new Map();
        cachedList.forEach(item => {
          if (item._id) cachedMap.set(String(item._id), item);
          if (item.id) cachedMap.set(String(item.id), item);
          if (item.invoiceNo) cachedMap.set(`inv_${item.invoiceNo}`, item);
        });

        const mergedData = res.data.map(serverItem => {
          const idKey = String(serverItem._id || serverItem.id);
          const cached = cachedMap.get(idKey) || (serverItem.invoiceNo ? cachedMap.get(`inv_${serverItem.invoiceNo}`) : null);
          if (cached) {
            return {
              ...cached,
              ...serverItem,
              dueDate: serverItem.dueDate || cached.dueDate,
              paidAmount: serverItem.paidAmount !== undefined ? serverItem.paidAmount : cached.paidAmount,
              balanceAmount: serverItem.balanceAmount !== undefined ? serverItem.balanceAmount : cached.balanceAmount
            };
          }
          return serverItem;
        });

        this.saveCollection(key, mergedData);
        return mergedData;
      }
      return this.getCollection(key);
    } catch (error) {
      console.warn(`[Live Fetch] Loading from storage cache for ${key}:`, error.message);
      return this.getCollection(key);
    }
  },

  // Professional Excel / CSV Export Helper
  exportToCSV(filename, rows, columns = null) {
    if (!rows || !rows.length) return;

    // Friendly column title mapping for clean Excel headers
    const titleMap = {
      sno: 'S.No',
      id: 'S.No',
      empId: 'Employee ID',
      name: 'Employee Name',
      phone: 'Phone Number',
      type: 'Work Type',
      workType: 'Work Type',
      dailyRate: 'Daily Rate (₹)',
      pieceRate: 'Piece Rate (₹)',
      productType: 'Product Type',
      salaryRate: 'Salary Rate',
      date: 'Date',
      joinDate: 'Joining Date',
      billDate: 'Bill Date',
      dueDate: 'Due Date',
      month: 'Month',
      supplier: 'Supplier',
      threadType: 'Thread Type',
      oilType: 'Oil Type',
      qty: 'Quantity',
      unit: 'Unit',
      rate: 'Rate (₹)',
      subtotal: 'Subtotal (₹)',
      gstRate: 'GST %',
      gstAmount: 'GST Amount (₹)',
      total: 'Amount',
      paidAmount: 'Paid',
      balanceAmount: 'Balance',
      cost: 'Cost (₹)',
      final: 'Final Amount (₹)',
      gross: 'Gross Earnings (₹)',
      grossPay: 'Gross Pay (₹)',
      deductions: 'Deductions (₹)',
      net: 'Net Salary (₹)',
      netPay: 'Net Pay (₹)',
      invoiceNo: 'Invoice No',
      machine: 'Machine Name',
      machineId: 'Machine ID',
      category: 'Category',
      desc: 'Description',
      vendor: 'Vendor Name',
      units: 'Units Consumed',
      prev: 'Previous Reading',
      curr: 'Current Reading',
      fixed: 'Fixed Charges (₹)',
      additional: 'Additional Charges (₹)',
      daysWorked: 'Days Worked',
      leaveDays: 'Leave Days',
      hoursWorked: 'Hours Worked',
      productsProduced: 'Products Produced',
      status: 'Status',
      notes: 'Notes',
      customerId: 'Customer ID',
      customerName: 'Customer Name',
      customerType: 'Customer Type',
      companyName: 'Company Name',
      gstin: 'GSTIN',
      pan: 'PAN',
      customerCategory: 'Customer Category',
      openingBalance: 'Opening Balance (₹)',
      creditLimit: 'Credit Limit (₹)',
      paymentTerms: 'Payment Terms',
      priceList: 'Price List',
      invoiceStatus: 'Invoice Status',
      paymentStatus: 'Payment Status',
      referenceNo: 'Reference No',
      vehicleNo: 'Vehicle No',
      poNumber: 'PO Number',
      challanNo: 'Challan No',
      deliveryDate: 'Delivery Date',
      salesperson: 'Salesperson',
      dispatchNo: 'Dispatch No',
      taxableAmount: 'Taxable Amount (₹)',
      cgstAmount: 'CGST (₹)',
      sgstAmount: 'SGST (₹)',
      igstAmount: 'IGST (₹)',
      roundOff: 'Round Off (₹)',
      grandTotal: 'Grand Total (₹)',
      amountReceived: 'Amount Received (₹)',
      outstanding: 'Outstanding (₹)',
      createdAt: 'Created At',
      updatedAt: 'Updated At'
    };

    // Ignore internal raw database technical keys in user Excel sheets
    const excludedKeys = new Set(['_id', '__v', 'gstMode', 'password']);

    let headers = [];
    let fieldExtractors = [];

    if (columns && Array.isArray(columns) && columns.length > 0) {
      const validCols = columns.filter(c => c.key !== 'actions' && c.key !== 'action');
      headers = validCols.map(c => c.header || titleMap[c.key] || c.key);
      fieldExtractors = validCols.map(c => {
        return (row, idx) => {
          if (c.key === 'id' || c.key === 'sno' || c.header === 'S. No' || c.header === 'S.No') {
            return row.sno !== undefined && row.sno !== null ? row.sno : idx + 1;
          }
          if (c.key === 'dueDate') {
            return formatDate(getItemDueDate(row));
          }
          if (c.key === 'status') {
            return isOverdue(row) ? 'Overdue' : getPaymentStatus(row);
          }
          if (c.key === 'paidAmount') {
            const total = Number(row.total || row.final || 0);
            return row.paidAmount !== undefined && row.paidAmount !== null && row.paidAmount !== ''
              ? Number(row.paidAmount)
              : (getPaymentStatus(row) === 'Paid' ? total : 0);
          }
          if (c.key === 'balanceAmount') {
            const total = Number(row.total || row.final || 0);
            const paid = row.paidAmount !== undefined && row.paidAmount !== null && row.paidAmount !== ''
              ? Number(row.paidAmount)
              : (getPaymentStatus(row) === 'Paid' ? total : 0);
            return Math.max(0, total - paid);
          }
          const val = row[c.key];
          if (val === null || val === undefined) return '';
          if (c.key === 'date' || c.key.toLowerCase().includes('date') || c.key === 'joinDate' || c.key === 'billDate' || c.key === 'payDate') {
            return formatDate(val);
          }
          if (typeof val === 'number') return val;
          return String(val);
        };
      });
    } else {
      // Auto-order preferred fields
      const allKeys = Object.keys(rows[0]).filter(k => !excludedKeys.has(k));
      headers = allKeys.map(k => titleMap[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()));
      fieldExtractors = allKeys.map(k => {
        return (row, idx) => {
          if (k === 'id' || k === 'sno') return row.sno !== undefined && row.sno !== null ? row.sno : idx + 1;
          if (k === 'dueDate') return formatDate(getItemDueDate(row));
          if (k === 'status') return isOverdue(row) ? 'Overdue' : getPaymentStatus(row);
          const val = row[k];
          if (val === null || val === undefined) return '';
          if (k === 'date' || k.toLowerCase().includes('date') || k === 'joinDate' || k === 'billDate') {
            return formatDate(val);
          }
          if (k === 'createdAt' || k === 'updatedAt') {
            return formatDateTime(val);
          }
          if (typeof val === 'number') return val;
          return String(val);
        };
      });
    }

    const separator = ',';
    const csvLines = [
      headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(separator)
    ];

    rows.forEach((row, idx) => {
      const lineValues = fieldExtractors.map(extractor => {
        let cell = extractor(row, idx);
        if (cell === null || cell === undefined) cell = '';
        cell = String(cell).replace(/"/g, '""');
        return `"${cell}"`;
      });
      csvLines.push(lineValues.join(separator));
    });

    // Prepend UTF-8 BOM (\uFEFF) so Microsoft Excel opens it with proper encoding and clean columns
    const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }
};

export default storageService;
