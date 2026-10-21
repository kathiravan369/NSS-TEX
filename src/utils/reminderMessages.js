// Utilities for Customer Communication & Payment / Reorder Reminders
// NSS-TEX (Towels & Textiles ERP)

import { formatINR, formatDate } from './formatters';

// Designated Admin Mobile Number for Reminders
export const ADMIN_MOBILE = '9344317394';
export const ADMIN_NAME = 'NSS-TEX Admin';
export const ADMIN_EMAIL = 'admin@nsstowels.com';
export const COMPANY_NAME = 'NSS-TEX Towels & Textiles';

/**
 * Clean and format Indian phone number for WhatsApp wa.me / api.whatsapp.com URL
 * Examples: '9344317394' -> '919344317394', '09344317394' -> '919344317394', '+91 93443 17394' -> '919344317394'
 */
export function formatWhatsAppPhone(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  if (digits.length === 10) {
    digits = '91' + digits;
  }
  return digits;
}

/**
 * Generate a polite, crystal-clear payment reminder request message for WhatsApp & Email
 */
export function generatePaymentReminderMessage(invoice) {
  if (!invoice) return '';

  const custName = invoice.customerName || invoice.customerSnapshot?.name || 'Valued Customer';
  const invNo = invoice.invoiceNo || 'Invoice';
  const invDate = formatDate(invoice.invoiceDate);
  const dueDate = formatDate(invoice.dueDate);
  const total = formatINR(invoice.grandTotal);
  const paid = formatINR(invoice.amountPaid || 0);
  const balance = formatINR(invoice.balanceDue);

  return `Dear ${custName},

Greetings from ${COMPANY_NAME}!

We hope you are having a productive week. This is a polite payment reminder regarding Tax Invoice *${invNo}* issued on *${invDate}*.

📋 *Invoice Details:*
• Invoice Number: ${invNo}
• Invoice Date: ${invDate}
• Payment Due Date: ${dueDate}
• Total Bill Amount: ${total}
• Amount Paid: ${paid}
• *Outstanding Balance Due: ${balance}*

🏦 *Bank Payment Details:*
• Account Name: NSS TOWELS & TEXTILES
• Bank: State Bank of India
• A/C Number: 38920194829
• IFSC Code: SBIN0001234
• Branch: Coimbatore Main Branch

Kindly arrange to transfer the pending balance of *${balance}* at your earliest convenience. If you have already initiated this payment, please disregard this note or share the transaction / UTR reference with us.

If you have any questions or require an updated statement, please feel free to contact us directly:
📞 Admin / Accounts: +91 ${ADMIN_MOBILE}
📧 Email: ${ADMIN_EMAIL}

Thank you for your business and continued partnership!

Warm regards,
*NSS-TEX Accounts Team*
Coimbatore, Tamil Nadu`;
}

/**
 * Generate a polite, engaging customer reorder / rebuy reminder message for customers 30+ days after bill date
 */
export function generateReorderReminderMessage(customer, latestInvoice = {}) {
  const custName = customer.name || customer.customerName || latestInvoice.customerName || 'Valued Customer';
  const billDate = formatDate(latestInvoice.invoiceDate || latestInvoice.lastInvoiceDate);
  const invNo = latestInvoice.invoiceNo || latestInvoice.lastInvoiceNo || '';

  // Extract items list if available
  const items = latestInvoice.items || latestInvoice.lastItems || [];
  let itemsSummary = '';
  if (Array.isArray(items) && items.length > 0) {
    itemsSummary = items
      .slice(0, 4)
      .map(it => `• ${it.productName || it.name || 'Towel Products'} (${it.quantity || it.qty || ''} ${it.unit || 'Pcs'})`)
      .join('\n');
  }

  return `Dear ${custName},

Greetings from ${COMPANY_NAME}!

It has been over 30 days since your purchase on *${billDate}*${invNo ? ` (Invoice: ${invNo})` : ''}. We hope you and your customers are delighted with our premium towel and textile products.

${itemsSummary ? `📦 *Items from your previous order:*\n${itemsSummary}\n` : ''}
We are checking in to see if you need to replenish your stock or place a fresh order for your upcoming requirements. We have fresh production batches of bath towels, hand towels, and specialized textile fabrics ready for prompt dispatch at competitive wholesale prices.

Please let us know your requirements. You can reach our admin team directly:
📞 Contact / WhatsApp: +91 ${ADMIN_MOBILE}
📧 Email: ${ADMIN_EMAIL}

We look forward to serving you again!

Warm regards,
*NSS-TEX (Towels & Textiles)*
Coimbatore, Tamil Nadu
Admin Contact: +91 ${ADMIN_MOBILE}`;
}

/**
 * Open WhatsApp Web / App with pre-filled message to the specified recipient phone number
 */
export function openWhatsAppChat(phone, message) {
  const cleanPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(message);
  
  // Uses WhatsApp universal direct link
  const url = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Open default Email client (mailto:) with subject and body
 */
export function openEmailClient(email, subject, body) {
  const cleanEmail = email ? email.trim() : '';
  const mailtoUrl = `mailto:${cleanEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailtoUrl, '_blank');
}
