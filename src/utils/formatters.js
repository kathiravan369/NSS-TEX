/**
 * Format a number into Indian Rupee currency format (e.g., ₹ 4,85,230)
 */
export function formatINR(amount, includeDecimals = false) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹ 0';

  const num = Number(amount);
  const options = {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: includeDecimals ? 2 : 0,
    minimumFractionDigits: includeDecimals ? 2 : 0
  };

  return new Intl.NumberFormat('en-IN', options).format(num);
}

/**
 * Format a standard date string into Indian display format (DD Mon YYYY / DD-MM-YYYY)
 */
export function formatDate(dateString, formatType = 'DD-MM-YYYY') {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthNumber = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  if (formatType === 'DD Mon YYYY') {
    return `${day} ${monthNames[date.getMonth()]} ${year}`;
  }

  return `${day}-${monthNumber}-${year}`;
}

/**
 * Format timestamp into display format with date & time (e.g., 11 Oct 2026, 09:30 AM)
 */
export function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? String(hours).padStart(2, '0') : '12';

  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
}

/**
 * Automatically computes payment status based strictly on Total and Paid/Balance.
 * Paid: when total > 0 and (balance <= 0 or paidAmount >= total).
 * Pending: when balance > 0 or total === 0.
 * Eliminates manual intervention.
 */
export function getPaymentStatus(item) {
  if (!item) return 'Pending';
  const total = Number(item.total || item.final || item.cost || 0);
  const paid = item.paidAmount !== undefined && item.paidAmount !== null && item.paidAmount !== ''
    ? Number(item.paidAmount)
    : (String(item.status || '').toLowerCase() === 'paid' ? total : 0);
  const balance = Math.max(0, total - paid);
  return (total > 0 && balance === 0) ? 'Paid' : 'Pending';
}

/**
 * Checks if a paid record has passed the 1-day (24 hours) threshold.
 * Once locked, the record cannot be edited, deleted, or reverted from Paid to Pending.
 */
export function isPaidLocked(item) {
  if (!item) return false;
  const status = getPaymentStatus(item);
  if (status !== 'Paid') return false;
  const timeSource = item.paidAt || item.paymentDate || item.payDate || item.createdAt || item.updatedAt || item.date;
  if (!timeSource) return false;
  const timeMs = new Date(timeSource).getTime();
  if (isNaN(timeMs)) return false;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  return (Date.now() - timeMs) >= ONE_DAY_MS;
}

/**
 * Calculates a default due date from a base date string by adding a specified number of days (default 45 days).
 */
export function calculateDefaultDueDate(baseDateStr, days = 45) {
  if (!baseDateStr) return '';
  const cleanStr = String(baseDateStr).includes('T') ? baseDateStr.split('T')[0] : String(baseDateStr);
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      const d = new Date(year, month, day);
      d.setDate(d.getDate() + Number(days));
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dt = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dt}`;
    }
  }

  const d = new Date(baseDateStr);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + Number(days));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}

/**
 * Returns the effective due date for a record. If item.dueDate is set, returns clean YYYY-MM-DD string.
 * Otherwise defaults to 45 days after item.date.
 */
export function getItemDueDate(item, defaultDays = 45) {
  if (!item) return '';
  if (item.dueDate) {
    const cleanStr = String(item.dueDate).includes('T') ? item.dueDate.split('T')[0] : String(item.dueDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) return cleanStr;
    const d = new Date(item.dueDate);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dt = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dt}`;
    }
    return cleanStr;
  }
  return calculateDefaultDueDate(item.date, defaultDays);
}

/**
 * Checks if a due date string has crossed today's local date.
 */
export function isDueDateCrossed(dueDateStr) {
  if (!dueDateStr) return false;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const cleanDue = dueDateStr.includes('T') ? dueDateStr.split('T')[0] : dueDateStr;
  return cleanDue < todayStr;
}

/**
 * Checks if a record is overdue:
 * - Payment status must be Pending (balance > 0)
 * - Due date has passed today's date
 */
export function isOverdue(item) {
  if (!item) return false;
  if (getPaymentStatus(item) === 'Paid') return false;
  const dueDateStr = getItemDueDate(item);
  if (!dueDateStr) return false;
  return isDueDateCrossed(dueDateStr);
}

/**
 * Calculates number of days a record is overdue (0 if not overdue).
 */
export function getDaysOverdue(item) {
  if (!item || getPaymentStatus(item) === 'Paid') return 0;
  const dueDateStr = getItemDueDate(item);
  if (!dueDateStr) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

/**
 * Extract clean YYYY-MM-DD due date for an invoice.
 * Defaults to invoiceDate + 30 days if not explicitly set.
 */
export function getInvoiceDueDate(inv) {
  if (!inv) return '';
  if (inv.dueDate) {
    const cleanStr = String(inv.dueDate).includes('T') ? inv.dueDate.split('T')[0] : String(inv.dueDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) return cleanStr;
    const d = new Date(inv.dueDate);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dt = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dt}`;
    }
  }
  return calculateDefaultDueDate(inv.invoiceDate || inv.date, 30);
}

/**
 * Checks if an invoice is overdue:
 * - Payment status is not Paid (balanceDue > 0)
 * - Due date has passed today's date
 */
export function isInvoiceOverdue(inv) {
  if (!inv) return false;
  const isPaid = inv.paymentStatus === 'Paid' || Number(inv.balanceDue) <= 0;
  if (isPaid) return false;
  const dueStr = getInvoiceDueDate(inv);
  if (!dueStr) return false;
  return isDueDateCrossed(dueStr);
}

/**
 * Returns precise due status, friendly badge label, and remaining or overdue days
 */
export function getInvoiceDueStatus(inv) {
  if (!inv) return { status: 'none', label: '-', days: 0 };
  const isPaid = inv.paymentStatus === 'Paid' || Number(inv.balanceDue) <= 0;
  if (isPaid) {
    return { status: 'paid', label: 'Settled', days: 0 };
  }

  const dueStr = getInvoiceDueDate(inv);
  if (!dueStr) return { status: 'pending', label: 'Pending', days: 0 };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueStr);
  due.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return { status: 'overdue', label: `Overdue by ${diffDays}d`, days: diffDays };
  } else if (diffDays === 0) {
    return { status: 'today', label: 'Due Today', days: 0 };
  } else {
    return { status: 'upcoming', label: `Due in ${Math.abs(diffDays)}d`, days: Math.abs(diffDays) };
  }
}

/**
 * Calculates number of elapsed days between given date and today
 */
export function getDaysSinceDate(dateString) {
  if (!dateString) return 0;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diff = today.getTime() - date.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}
