const mongoose = require('mongoose');
const { Invoice, Customer, SalesPayment } = require('../models');
const { query } = require('../config/db');
const runtimeStore = require('../utils/runtimeStore');

function round2(val) {
  const num = Number(val) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// @desc    Get Sales Dashboard Summary KPIs
// @route   GET /api/sales/reports/summary
// @access  Public
exports.getSalesSummary = async (req, res, next) => {
  try {
    const { startDate, endDate, customerId, salesperson, invoiceStatus } = req.query;
    const isDb = mongoose.connection.readyState === 1;

    let totalSales = 0;
    let amountReceived = 0;
    let outstanding = 0;
    let invoiceCount = 0;
    let paidInvoices = 0;
    let partialInvoices = 0;
    let unpaidInvoices = 0;

    if (isDb) {
      let conditions = ["invoice_status != 'Cancelled'"];
      const params = [];

      if (startDate) {
        params.push(startDate);
        conditions.push(`invoice_date >= $${params.length}`);
      }
      if (endDate) {
        params.push(endDate);
        conditions.push(`invoice_date <= $${params.length}`);
      }
      if (customerId && customerId !== 'All' && customerId !== 'All Customers') {
        params.push(customerId);
        conditions.push(`customer_id::text = $${params.length}`);
      }
      if (salesperson && salesperson !== 'All') {
        params.push(salesperson);
        conditions.push(`salesperson = $${params.length}`);
      }
      if (invoiceStatus && invoiceStatus !== 'All' && invoiceStatus !== 'All Status') {
        params.push(invoiceStatus);
        conditions.push(`invoice_status = $${params.length}`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(grand_total), 0) as total_sales,
          COALESCE(SUM(amount_paid), 0) as amount_received,
          COALESCE(SUM(balance_due), 0) as outstanding,
          COUNT(CASE WHEN payment_status = 'Paid' THEN 1 END) as paid_count,
          COUNT(CASE WHEN payment_status = 'Partially Paid' THEN 1 END) as partial_count,
          COUNT(CASE WHEN payment_status = 'Unpaid' OR payment_status = 'Overdue' THEN 1 END) as unpaid_count
        FROM invoices
        ${where}
      `;

      const result = await query(sql, params);
      const row = result.rows[0];

      totalSales = round2(row.total_sales);
      amountReceived = round2(row.amount_received);
      outstanding = round2(row.outstanding);
      invoiceCount = Number(row.count);
      paidInvoices = Number(row.paid_count);
      partialInvoices = Number(row.partial_count);
      unpaidInvoices = Number(row.unpaid_count);
    } else {
      let list = runtimeStore.invoices.filter(i => i.invoiceStatus !== 'Cancelled');
      if (startDate) list = list.filter(i => new Date(i.invoiceDate) >= new Date(startDate));
      if (endDate) list = list.filter(i => new Date(i.invoiceDate) <= new Date(endDate));
      if (customerId && customerId !== 'All' && customerId !== 'All Customers') {
        list = list.filter(i => String(i.customerId) === String(customerId));
      }

      invoiceCount = list.length;
      totalSales = round2(list.reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0));
      amountReceived = round2(list.reduce((sum, i) => sum + (Number(i.amountPaid) || 0), 0));
      outstanding = round2(list.reduce((sum, i) => sum + (Number(i.balanceDue) || 0), 0));
      paidInvoices = list.filter(i => i.paymentStatus === 'Paid').length;
      partialInvoices = list.filter(i => i.paymentStatus === 'Partially Paid').length;
      unpaidInvoices = list.filter(i => i.paymentStatus === 'Unpaid' || i.paymentStatus === 'Overdue').length;
    }

    res.json({
      success: true,
      data: {
        totalSales,
        amountReceived,
        outstanding,
        invoiceCount,
        paidInvoices,
        partialInvoices,
        unpaidInvoices
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Customer-wise Sales Report
// @route   GET /api/sales/reports/customer-wise
// @access  Public
exports.getCustomerWiseSales = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const isDb = mongoose.connection.readyState === 1;

    if (isDb) {
      let conditions = ["i.invoice_status != 'Cancelled'"];
      const params = [];

      if (startDate) {
        params.push(startDate);
        conditions.push(`i.invoice_date >= $${params.length}`);
      }
      if (endDate) {
        params.push(endDate);
        conditions.push(`i.invoice_date <= $${params.length}`);
      }

      const where = `WHERE ${conditions.join(' AND ')}`;
      const sql = `
        SELECT 
          COALESCE(c.id, i.customer_id) as customer_id,
          COALESCE(c.customer_id, i.customer_code, 'N/A') as customer_code,
          COALESCE(c.name, i.customer_name, 'Unknown Customer') as customer_name,
          COALESCE(c.company_name, '') as company_name,
          COALESCE(c.phone, '') as phone,
          COUNT(i.id) as invoice_count,
          COALESCE(SUM(i.taxable_amount), 0) as taxable_amount,
          COALESCE(SUM(i.gst_amount), 0) as gst_amount,
          COALESCE(SUM(i.grand_total), 0) as total_sales,
          COALESCE(SUM(i.amount_paid), 0) as amount_paid,
          COALESCE(SUM(i.balance_due), 0) as balance_due
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
        ${where}
        GROUP BY c.id, c.customer_id, c.name, c.company_name, c.phone, i.customer_id, i.customer_code, i.customer_name
        ORDER BY total_sales DESC
      `;

      const result = await query(sql, params);
      const data = result.rows.map(r => ({
        customerId: r.customer_id,
        customerCode: r.customer_code,
        customerName: r.customer_name,
        companyName: r.company_name,
        phone: r.phone,
        invoiceCount: Number(r.invoice_count),
        taxableAmount: round2(r.taxable_amount),
        gstAmount: round2(r.gst_amount),
        totalSales: round2(r.total_sales),
        amountPaid: round2(r.amount_paid),
        balanceDue: round2(r.balance_due)
      }));

      return res.json({ success: true, count: data.length, data });
    }

    // Memory aggregation fallback
    const map = new Map();
    for (const inv of runtimeStore.invoices) {
      if (inv.invoiceStatus === 'Cancelled') continue;
      const key = String(inv.customerId || inv.customerName || 'Other');
      if (!map.has(key)) {
        map.set(key, {
          customerId: inv.customerId,
          customerCode: inv.customerCode || 'N/A',
          customerName: inv.customerName || 'Unknown',
          companyName: '',
          phone: '',
          invoiceCount: 0,
          taxableAmount: 0,
          gstAmount: 0,
          totalSales: 0,
          amountPaid: 0,
          balanceDue: 0
        });
      }
      const entry = map.get(key);
      entry.invoiceCount++;
      entry.taxableAmount = round2(entry.taxableAmount + (Number(inv.taxableAmount) || 0));
      entry.gstAmount = round2(entry.gstAmount + (Number(inv.gstAmount) || 0));
      entry.totalSales = round2(entry.totalSales + (Number(inv.grandTotal) || 0));
      entry.amountPaid = round2(entry.amountPaid + (Number(inv.amountPaid) || 0));
      entry.balanceDue = round2(entry.balanceDue + (Number(inv.balanceDue) || 0));
    }

    res.json({ success: true, count: map.size, data: Array.from(map.values()) });
  } catch (error) {
    next(error);
  }
};

// @desc    Product-wise Sales Report
// @route   GET /api/sales/reports/product-wise
// @access  Public
exports.getProductWiseSales = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const isDb = mongoose.connection.readyState === 1;

    if (isDb) {
      let conditions = ["invoice_status != 'Cancelled'"];
      const params = [];

      if (startDate) {
        params.push(startDate);
        conditions.push(`invoice_date >= $${params.length}`);
      }
      if (endDate) {
        params.push(endDate);
        conditions.push(`invoice_date <= $${params.length}`);
      }

      const where = `WHERE ${conditions.join(' AND ')}`;
      const sql = `
        SELECT 
          elem->>'productName' as product_name,
          COALESCE(elem->>'category', 'Textiles') as category,
          COALESCE(elem->>'unit', 'Pcs') as unit,
          SUM(CAST(COALESCE(elem->>'quantity', '0') AS NUMERIC)) as quantity_sold,
          SUM(CAST(COALESCE(elem->>'taxableAmount', elem->>'total', '0') AS NUMERIC)) as taxable_revenue,
          SUM(CAST(COALESCE(elem->>'total', '0') AS NUMERIC)) as total_revenue
        FROM invoices,
        jsonb_array_elements(items) as elem
        ${where}
        GROUP BY elem->>'productName', elem->>'category', elem->>'unit'
        ORDER BY total_revenue DESC
      `;

      const result = await query(sql, params);
      const data = result.rows.map(r => ({
        productName: r.product_name,
        category: r.category,
        unit: r.unit,
        quantitySold: Number(r.quantity_sold) || 0,
        taxableRevenue: round2(r.taxable_revenue),
        totalRevenue: round2(r.total_revenue),
        averageRate: Number(r.quantity_sold) > 0 ? round2(r.total_revenue / r.quantity_sold) : 0
      }));

      return res.json({ success: true, count: data.length, data });
    }

    // Memory aggregation
    const map = new Map();
    for (const inv of runtimeStore.invoices) {
      if (inv.invoiceStatus === 'Cancelled') continue;
      const items = Array.isArray(inv.items) ? inv.items : [];
      for (const it of items) {
        const name = it.productName || 'Unspecified Product';
        if (!map.has(name)) {
          map.set(name, {
            productName: name,
            category: it.category || 'Towels',
            unit: it.unit || 'Pcs',
            quantitySold: 0,
            taxableRevenue: 0,
            totalRevenue: 0
          });
        }
        const entry = map.get(name);
        const qty = Number(it.quantity || it.qty || 0);
        const tot = Number(it.total || 0);
        const tax = Number(it.taxableAmount || tot);
        entry.quantitySold += qty;
        entry.taxableRevenue = round2(entry.taxableRevenue + tax);
        entry.totalRevenue = round2(entry.totalRevenue + tot);
      }
    }

    const data = Array.from(map.values()).map(e => ({
      ...e,
      averageRate: e.quantitySold > 0 ? round2(e.totalRevenue / e.quantitySold) : 0
    }));

    res.json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Periodic Sales Report (Daily, Weekly, Monthly)
// @route   GET /api/sales/reports/periodic
// @access  Public
exports.getPeriodicSalesReport = async (req, res, next) => {
  try {
    const { period = 'monthly', startDate, endDate } = req.query;
    const isDb = mongoose.connection.readyState === 1;

    let groupByExpr = "TO_CHAR(invoice_date, 'YYYY-MM')";
    if (period === 'daily') groupByExpr = "TO_CHAR(invoice_date, 'YYYY-MM-DD')";
    else if (period === 'weekly') groupByExpr = "TO_CHAR(DATE_TRUNC('week', invoice_date), 'YYYY-MM-DD')";

    if (isDb) {
      let conditions = ["invoice_status != 'Cancelled'"];
      const params = [];

      if (startDate) {
        params.push(startDate);
        conditions.push(`invoice_date >= $${params.length}`);
      }
      if (endDate) {
        params.push(endDate);
        conditions.push(`invoice_date <= $${params.length}`);
      }

      const where = `WHERE ${conditions.join(' AND ')}`;
      const sql = `
        SELECT 
          ${groupByExpr} as period_key,
          COUNT(*) as invoice_count,
          COALESCE(SUM(taxable_amount), 0) as taxable_amount,
          COALESCE(SUM(gst_amount), 0) as gst_amount,
          COALESCE(SUM(grand_total), 0) as total_sales,
          COALESCE(SUM(amount_paid), 0) as amount_paid,
          COALESCE(SUM(balance_due), 0) as balance_due
        FROM invoices
        ${where}
        GROUP BY ${groupByExpr}
        ORDER BY period_key DESC
      `;

      const result = await query(sql, params);
      const data = result.rows.map(r => ({
        periodKey: r.period_key,
        invoiceCount: Number(r.invoice_count),
        taxableAmount: round2(r.taxable_amount),
        gstAmount: round2(r.gst_amount),
        totalSales: round2(r.total_sales),
        amountPaid: round2(r.amount_paid),
        balanceDue: round2(r.balance_due)
      }));

      return res.json({ success: true, count: data.length, data });
    }

    res.json({ success: true, count: 0, data: [] });
  } catch (error) {
    next(error);
  }
};

// @desc    Outstanding Payments Report
// @route   GET /api/sales/reports/outstanding
// @access  Public
exports.getOutstandingPaymentsReport = async (req, res, next) => {
  try {
    const isDb = mongoose.connection.readyState === 1;

    if (isDb) {
      const sql = `
        SELECT 
          i.id,
          i.invoice_no,
          i.invoice_date,
          i.due_date,
          i.customer_id,
          i.customer_code,
          i.customer_name,
          COALESCE(c.phone, i.customer_snapshot->>'phone', '') as phone,
          COALESCE(c.company_name, i.customer_snapshot->>'companyName', '') as company_name,
          i.grand_total,
          i.amount_paid,
          i.balance_due,
          i.payment_status,
          GREATEST(0, (CURRENT_DATE - i.due_date)) as days_overdue
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
        WHERE i.balance_due > 0 AND i.invoice_status != 'Cancelled'
        ORDER BY i.due_date ASC NULLS LAST
      `;

      const result = await query(sql);
      const data = result.rows.map(r => ({
        id: r.id,
        invoiceNo: r.invoice_no,
        invoiceDate: r.invoice_date,
        dueDate: r.due_date,
        customerId: r.customer_id,
        customerCode: r.customer_code,
        customerName: r.customer_name,
        phone: r.phone,
        companyName: r.company_name,
        grandTotal: round2(r.grand_total),
        amountPaid: round2(r.amount_paid),
        balanceDue: round2(r.balance_due),
        paymentStatus: r.payment_status,
        daysOverdue: Number(r.days_overdue) || 0
      }));

      return res.json({ success: true, count: data.length, data });
    }

    const today = new Date();
    const data = runtimeStore.invoices
      .filter(i => (Number(i.balanceDue) || 0) > 0 && i.invoiceStatus !== 'Cancelled')
      .map(i => {
        const dueDate = i.dueDate ? new Date(i.dueDate) : today;
        const diffDays = Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)));
        return {
          id: i.id,
          invoiceNo: i.invoiceNo,
          invoiceDate: i.invoiceDate,
          dueDate: i.dueDate,
          customerId: i.customerId,
          customerCode: i.customerCode,
          customerName: i.customerName,
          phone: i.customerSnapshot?.phone || '',
          companyName: i.customerSnapshot?.companyName || '',
          grandTotal: round2(i.grandTotal),
          amountPaid: round2(i.amountPaid),
          balanceDue: round2(i.balanceDue),
          paymentStatus: i.paymentStatus,
          daysOverdue: diffDays
        };
      });

    res.json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// @desc    GST Summary Report (Taxable, CGST, SGST, IGST)
// @route   GET /api/sales/reports/gst
// @access  Public
exports.getGSTSummaryReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const isDb = mongoose.connection.readyState === 1;

    if (isDb) {
      let conditions = ["invoice_status != 'Cancelled'"];
      const params = [];

      if (startDate) {
        params.push(startDate);
        conditions.push(`invoice_date >= $${params.length}`);
      }
      if (endDate) {
        params.push(endDate);
        conditions.push(`invoice_date <= $${params.length}`);
      }

      const where = `WHERE ${conditions.join(' AND ')}`;
      const sql = `
        SELECT 
          COUNT(*) as invoice_count,
          COALESCE(SUM(taxable_amount), 0) as total_taxable,
          COALESCE(SUM(cgst_amount), 0) as total_cgst,
          COALESCE(SUM(sgst_amount), 0) as total_sgst,
          COALESCE(SUM(igst_amount), 0) as total_igst,
          COALESCE(SUM(gst_amount), 0) as total_gst,
          COALESCE(SUM(grand_total), 0) as total_gross
        FROM invoices
        ${where}
      `;

      const result = await query(sql, params);
      const row = result.rows[0];

      return res.json({
        success: true,
        data: {
          invoiceCount: Number(row.invoice_count),
          taxableAmount: round2(row.total_taxable),
          cgstAmount: round2(row.total_cgst),
          sgstAmount: round2(row.total_sgst),
          igstAmount: round2(row.total_igst),
          gstAmount: round2(row.total_gst),
          grandTotal: round2(row.total_gross)
        }
      });
    }

    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
