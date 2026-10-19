/**
 * NSS-TEX Manufacturing & Sales Management System
 * Comprehensive System-Wide QA Test Suite
 * Covers Positive and Negative Scenarios across All System Modules:
 * - Customers (Validations, Duplicates, Formats, CRUD)
 * - Invoices & GST Tax Engine (Intra/Inter-state, math, payments, settlement, locks)
 * - Thread Purchases GST & No-GST (Calculations, dates, validations)
 * - Oil Purchases & Stock (Inventory updates, validation)
 * - Machinery Expenses (Tax computation, categories)
 * - Electricity Costs (Meter readings curr > prev validation, charges)
 * - Employees (Day, Count, Size work types, validations)
 * - Weekly Payroll (Salary engine, deductions, 24h locked immutability)
 * - Salary Reports (Calendar month strict reconciliation)
 * - Sales Reports (KPIs, customer-wise, product-wise, GST summary)
 */

const http = require('http');

const BASE_URL = 'http://localhost:5001';

function apiRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

let passedCount = 0;
let failedCount = 0;
const failures = [];

function check(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
    failedCount++;
    failures.push({ testName, details });
  }
}

async function runAllTests() {
  console.log('================================================================');
  console.log('🧪 NSS-TEX COMPREHENSIVE QA AUDIT: POSITIVE & NEGATIVE SCENARIOS');
  console.log('================================================================');

  try {
    // -------------------------------------------------------------
    // SUITE 1: CUSTOMER VALIDATION & OPERATIONS (Positive & Negative)
    // -------------------------------------------------------------
    console.log('\n--- SUITE 1: Customer Validation & Operations ---');

    // Neg 1: Missing Customer Name
    const resNegName = await apiRequest('/api/sales/customers', {
      method: 'POST',
      body: { phone: '9842199999' }
    });
    check(resNegName.status === 400, 'Negative: Customer missing name is rejected with 400', `Status: ${resNegName.status}`);

    // Neg 2: Missing Phone Number
    const resNegPhone = await apiRequest('/api/sales/customers', {
      method: 'POST',
      body: { name: 'Acme Textiles' }
    });
    check(resNegPhone.status === 400, 'Negative: Customer missing phone is rejected with 400', `Status: ${resNegPhone.status}`);

    // Neg 3: Invalid Phone Format (Too short or alphabetic)
    const resNegPhoneFormat = await apiRequest('/api/sales/customers', {
      method: 'POST',
      body: { name: 'Acme Textiles', phone: '12345' }
    });
    check(resNegPhoneFormat.status === 400, 'Negative: Invalid phone format (<10 digits) is rejected with 400', `Status: ${resNegPhoneFormat.status}`);

    // Neg 4: Invalid GSTIN Format
    const resNegGstin = await apiRequest('/api/sales/customers', {
      method: 'POST',
      body: { name: 'Acme Textiles', phone: '9842188888', gstin: 'INVALID_GSTIN_123' }
    });
    check(resNegGstin.status === 400, 'Negative: Malformed GSTIN string is rejected with 400', `Status: ${resNegGstin.status}`);

    // Neg 5: Invalid PAN Format
    const resNegPan = await apiRequest('/api/sales/customers', {
      method: 'POST',
      body: { name: 'Acme Textiles', phone: '9842188888', pan: 'BAD_PAN' }
    });
    check(resNegPan.status === 400, 'Negative: Malformed PAN string is rejected with 400', `Status: ${resNegPan.status}`);

    // Pos 1: Valid Customer Creation
    const uniquePhone1 = `984${Math.floor(1000000 + Math.random() * 9000000)}`;
    const uniqueGstin1 = `33AAACA${Math.floor(1000 + Math.random() * 9000)}A1Z5`;
    const resPosCust = await apiRequest('/api/sales/customers', {
      method: 'POST',
      body: {
        name: 'Vibrant Weaves Pvt Ltd',
        customerType: 'Business',
        phone: uniquePhone1,
        email: 'info@vibrantweaves.com',
        companyName: 'Vibrant Weaves',
        gstin: uniqueGstin1,
        pan: 'AAACA1234A',
        billingAddress: {
          addressLine: '88 Textile Park',
          city: 'Coimbatore',
          state: 'Tamil Nadu',
          pincode: '641001',
          country: 'India'
        },
        sameAsBilling: true,
        openingBalance: 5000,
        openingBalanceType: 'Debit',
        creditLimit: 500000,
        paymentTerms: '30 Days'
      }
    });
    check(resPosCust.status === 201, 'Positive: Valid customer created with 201', `Status: ${resPosCust.status}`);
    const customer1 = resPosCust.body.data;
    check(customer1 && customer1.name === 'Vibrant Weaves Pvt Ltd', 'Positive: Customer data stored correctly');
    check(customer1 && customer1.customerId.startsWith('CUS-'), 'Positive: Customer ID generated automatically');

    // Neg 6: Duplicate Phone Warning / Conflict Detection
    const resDupCheck = await apiRequest(`/api/sales/customers/check-duplicate?phone=${uniquePhone1}`);
    check(resDupCheck.status === 200, 'Positive: Duplicate checking endpoint responds 200');
    check(resDupCheck.body.isDuplicate === true, 'Positive: Duplicate checker detects already registered phone number');
    check(resDupCheck.body.duplicateField === 'Phone Number', 'Positive: Duplicate checker flags Phone Number as conflicting field');

    // Neg 7: Direct creation with duplicate phone without force flag
    const resDupCreate = await apiRequest('/api/sales/customers', {
      method: 'POST',
      body: {
        name: 'Another Company',
        phone: uniquePhone1
      }
    });
    check(resDupCreate.status === 409 || resDupCreate.status === 400, 'Negative: Creating customer with existing phone rejected with 409/400', `Status: ${resDupCreate.status}`);

    // Pos 2: Customer Status Deactivation & Activation
    const resDeact = await apiRequest(`/api/sales/customers/${customer1.id}/status`, {
      method: 'PATCH',
      body: { status: 'Inactive' }
    });
    check(resDeact.status === 200 && resDeact.body.data.status === 'Inactive', 'Positive: Customer status toggled to Inactive');

    const resReactivate = await apiRequest(`/api/sales/customers/${customer1.id}/status`, {
      method: 'PATCH',
      body: { status: 'Active' }
    });
    check(resReactivate.status === 200 && resReactivate.body.data.status === 'Active', 'Positive: Customer status reactivated to Active');

    // -------------------------------------------------------------
    // SUITE 2: INVOICES & GST TAX ENGINE (Intra/Inter-State Math, Settlement)
    // -------------------------------------------------------------
    console.log('\n--- SUITE 2: Invoice Engine & Tax Computations ---');

    // Neg 8: Invoice Creation with empty items array
    const resCreateEmpty = await apiRequest('/api/sales/invoices', {
      method: 'POST',
      body: { customerId: customer1.id, items: [] }
    });
    check(resCreateEmpty.status === 400, 'Negative: Invoice creation with empty items returns 400', `Status: ${resCreateEmpty.status}`);

    // Pos 3: Intra-State Tax Calculation (Tamil Nadu -> Tamil Nadu)
    const resIntraCalc = await apiRequest('/api/sales/invoices/calculate', {
      method: 'POST',
      body: {
        customerSnapshot: { billingAddress: { state: 'Tamil Nadu' } },
        items: [
          { productName: 'Bath Towels (White)', hsnCode: '6302', quantity: 200, rate: 150, discount: 5, gstRate: 12 },
          { productName: 'Hand Towels (Blue)', hsnCode: '6302', quantity: 100, rate: 80, discount: 0, gstRate: 12 }
        ],
        extraDiscount: 500
      }
    });
    check(resIntraCalc.status === 200, 'Positive: Intra-state calculation responds 200');
    check(resIntraCalc.body.isIntraState === true, 'Positive: Correctly classified as INTRA_STATE (CGST + SGST)');
    check(resIntraCalc.body.cgstAmount > 0 && resIntraCalc.body.sgstAmount > 0, 'Positive: CGST and SGST both computed');
    check(resIntraCalc.body.igstAmount === 0, 'Positive: IGST is 0 for Intra-state sale');

    // Pos 4: Inter-State Tax Calculation (Tamil Nadu -> Karnataka)
    const resInterCalc = await apiRequest('/api/sales/invoices/calculate', {
      method: 'POST',
      body: {
        shippingAddress: { state: 'Karnataka' },
        customerSnapshot: { billingAddress: { state: 'Karnataka' } },
        items: [
          { productName: 'Hotel Luxury Bath Towels', hsnCode: '6302', quantity: 150, rate: 200, discount: 0, gstRate: 12 }
        ]
      }
    });
    check(resInterCalc.status === 200, 'Positive: Inter-state calculation responds 200');
    check(resInterCalc.body.isIntraState === false, 'Positive: Correctly classified as INTER_STATE (IGST only)');
    check(resInterCalc.body.cgstAmount === 0 && resInterCalc.body.sgstAmount === 0, 'Positive: CGST/SGST are 0 for Inter-state sale');
    check(resInterCalc.body.igstAmount > 0, 'Positive: IGST is correctly computed');

    // Neg 9: Invoice Creation with negative quantity
    const resNegQty = await apiRequest('/api/sales/invoices', {
      method: 'POST',
      body: {
        customerId: customer1.id,
        items: [
          { productName: 'Towels', quantity: -5, rate: 100 }
        ]
      }
    });
    check(resNegQty.status === 400, 'Negative: Negative item quantity rejected with 400', `Status: ${resNegQty.status}`);

    // Pos 5: Valid Invoice Creation with Partial Payment
    const resCreateInv = await apiRequest('/api/sales/invoices', {
      method: 'POST',
      body: {
        customerId: customer1.id,
        invoiceDate: '2026-10-18',
        dueDate: '2026-11-18',
        paymentTerms: '30 Days',
        billingAddress: customer1.billingAddress,
        items: [
          { productName: 'Premium Bath Sheet 30x60', hsnCode: '6302', quantity: 100, rate: 200, gstRate: 12 }
        ],
        initialPayment: 10000,
        paymentMode: 'Bank Transfer'
      }
    });
    check(resCreateInv.status === 201, 'Positive: Invoice created with 201', `Status: ${resCreateInv.status}`);
    const invoice1 = resCreateInv.body.data;
    check(invoice1 && invoice1.grandTotal === 22400, 'Positive: Grand Total computed correctly (20,000 + 12% GST = 22,400)');
    check(invoice1 && invoice1.amountPaid === 10000, 'Positive: Partial payment of 10,000 recorded');
    check(invoice1 && invoice1.balanceDue === 12400, 'Positive: Remaining balance due is 12,400');
    check(invoice1 && invoice1.paymentStatus === 'Partially Paid', 'Positive: Status marked as Partially Paid');

    // Neg 11: Recording payment exceeding remaining balance
    const resOverpay = await apiRequest(`/api/sales/invoices/${invoice1.id}/payments`, {
      method: 'POST',
      body: {
        amount: 999999, // Exceeds balance
        paymentMode: 'Cash'
      }
    });
    check(resOverpay.status === 400, 'Negative: Overpayment exceeding remaining balance rejected with 400', `Status: ${resOverpay.status}`);

    // Pos 6: Settle Exact Remaining Balance
    const resSettle = await apiRequest(`/api/sales/invoices/${invoice1.id}/payments`, {
      method: 'POST',
      body: {
        amount: 12400,
        paymentMode: 'NEFT',
        reference: 'NEFT-TEX-20261018'
      }
    });
    check(resSettle.status === 200, 'Positive: Settlement payment accepted with 200');
    check(resSettle.body.data.amountPaid === 22400, 'Positive: Total amount paid equals grand total (22,400)');
    check(resSettle.body.data.balanceDue === 0, 'Positive: Balance due cleared to 0');
    check(resSettle.body.data.paymentStatus === 'Paid', 'Positive: Payment status automatically promoted to Paid');

    // -------------------------------------------------------------
    // SUITE 3: THREAD PURCHASES (GST & No-GST)
    // -------------------------------------------------------------
    console.log('\n--- SUITE 3: Thread Purchases (GST & No-GST) ---');

    // Neg 12: Missing supplier or invalid rate
    const resNegThread = await apiRequest('/api/thread-purchases', {
      method: 'POST',
      body: { threadType: '2/40 Cotton', qty: 100, rate: 0 }
    });
    check(resNegThread.status === 400, 'Negative: Thread purchase with missing supplier / zero rate rejected with 400', `Status: ${resNegThread.status}`);

    // Pos 7: Thread Purchase With GST (5% GST calculation)
    const resThreadGst = await apiRequest('/api/thread-purchases', {
      method: 'POST',
      body: {
        date: '2026-10-18',
        supplier: 'Kongu Cotton Mills Ltd',
        threadType: '2/40 Bleached White',
        color: 'Pure White',
        boxBag: 'Bag',
        qty: 150,
        rate: 320,
        gstMode: 'WITH_GST',
        gstRate: 5,
        billNumber: `BILL-GST-${Date.now().toString().slice(-4)}`,
        billDate: '2026-10-18',
        dueDate: '2026-11-18',
        status: 'Pending'
      }
    });
    check(resThreadGst.status === 201, 'Positive: Thread Purchase With GST created with 201');
    check(resThreadGst.body.data.subtotal === 48000, 'Positive: Subtotal computed: 150 * 320 = 48,000');
    check(resThreadGst.body.data.gstAmount === 2400, 'Positive: GST 5% computed: 2,400');
    check(resThreadGst.body.data.total === 50400, 'Positive: Final total computed: 50,400');

    // Pos 8: Thread Purchase Without GST
    const resThreadNoGst = await apiRequest('/api/thread-purchases', {
      method: 'POST',
      body: {
        date: '2026-10-18',
        supplier: 'Tirupur Spun Threads',
        threadType: 'Grey Yarn 20s',
        color: 'Grey',
        boxBag: 'Box',
        qty: 100,
        rate: 250,
        gstMode: 'WITHOUT_GST',
        billNumber: `BILL-NOGST-${Date.now().toString().slice(-4)}`,
        billDate: '2026-10-18',
        dueDate: '2026-11-18',
        status: 'Paid',
        payDate: '2026-10-18'
      }
    });
    check(resThreadNoGst.status === 201, 'Positive: Thread Purchase Without GST created with 201');
    check(resThreadNoGst.body.data.gstAmount === 0, 'Positive: GST amount is 0 for Without-GST purchase');
    check(resThreadNoGst.body.data.total === 25000, 'Positive: Total is strictly Qty * Rate (25,000)');

    // -------------------------------------------------------------
    // SUITE 4: OIL PURCHASES & INVENTORY STOCK
    // -------------------------------------------------------------
    console.log('\n--- SUITE 4: Oil Purchases & Stock Tracking ---');

    // Neg 13: Oil purchase with negative liters
    const resNegOil = await apiRequest('/api/oil-purchases', {
      method: 'POST',
      body: { oilType: 'Spindle Lubricant', qty: -20, rate: 120 }
    });
    check(resNegOil.status === 400, 'Negative: Negative oil quantity rejected with 400', `Status: ${resNegOil.status}`);

    // Pos 9: Valid Oil Purchase and Stock increment
    const resOilPos = await apiRequest('/api/oil-purchases', {
      method: 'POST',
      body: {
        date: '2026-10-18',
        supplier: 'PetroLube Distributors',
        oilType: 'Heavy Spindle Oil 68',
        qty: 60,
        rate: 140,
        includeGST: true,
        gstRate: 18,
        status: 'Paid'
      }
    });
    check(resOilPos.status === 201, 'Positive: Oil purchase created with 201');
    check(resOilPos.body.data.final === 9912, 'Positive: Cost calculated: 60 * 140 + 18% GST = 9,912');

    // Verify stock endpoint responds
    const resOilStock = await apiRequest('/api/oil-stock');
    check(resOilStock.status === 200, 'Positive: Oil stock inventory queried with 200');

    // -------------------------------------------------------------
    // SUITE 5: MACHINERY EXPENSES
    // -------------------------------------------------------------
    console.log('\n--- SUITE 5: Machinery Expenses ---');

    // Neg 14: Machinery expense missing machine name
    const resNegMach = await apiRequest('/api/machinery-expenses', {
      method: 'POST',
      body: { cost: 5000 }
    });
    check(resNegMach.status === 400, 'Negative: Machinery expense missing machine name rejected with 400', `Status: ${resNegMach.status}`);

    // Pos 10: Valid Machinery Expense
    const resMachPos = await apiRequest('/api/machinery-expenses', {
      method: 'POST',
      body: {
        date: '2026-10-18',
        machine: 'Air Jet Loom #04',
        category: 'Maintenance',
        desc: 'Main bearing replacement and oil seal servicing',
        vendor: 'Precision Loom Spares',
        cost: 6500,
        includeGST: true,
        gstRate: 18,
        status: 'Pending'
      }
    });
    check(resMachPos.status === 201, 'Positive: Machinery expense recorded with 201');
    check(resMachPos.body.data.total === 7670, 'Positive: Machinery total computed: 6,500 + 18% (1,170) = 7,670');

    // -------------------------------------------------------------
    // SUITE 6: ELECTRICITY EXPENSES & METER VALIDATION
    // -------------------------------------------------------------
    console.log('\n--- SUITE 6: Electricity Expenses & Meter Reading Validation ---');

    // Neg 15: Current reading less than previous reading
    const resNegMeter = await apiRequest('/api/electricity-expenses', {
      method: 'POST',
      body: {
        month: 'October 2026',
        billDate: '2026-10-18',
        prev: 18000,
        curr: 17500, // Invalid: curr < prev
        rate: 8.5
      }
    });
    check(resNegMeter.status === 400, 'Negative: Current reading < Previous reading rejected with 400', `Status: ${resNegMeter.status}`);

    // Pos 11: Valid Electricity Bill with auto unit calculation
    const resElecPos = await apiRequest('/api/electricity-expenses', {
      method: 'POST',
      body: {
        month: 'October 2026',
        billDate: '2026-10-18',
        prev: 20000,
        curr: 21200,
        rate: 8.5,
        fixed: 850,
        additional: 150,
        status: 'Pending'
      }
    });
    check(resElecPos.status === 201, 'Positive: Electricity bill created with 201');
    check(resElecPos.body.data.units === 1200, 'Positive: Consumed units computed: 21,200 - 20,000 = 1,200');
    check(resElecPos.body.data.total === 11200, 'Positive: Total bill computed: (1200 * 8.5 = 10200) + 850 + 150 = 11,200');

    // -------------------------------------------------------------
    // SUITE 7: EMPLOYEE MANAGEMENT & WORK TYPES
    // -------------------------------------------------------------
    console.log('\n--- SUITE 7: Employee Management & Work Types ---');

    // Neg 16: Employee with missing name
    const resNegEmp = await apiRequest('/api/employees', {
      method: 'POST',
      body: { type: 'Day Salary', dailyRate: 600 }
    });
    check(resNegEmp.status === 400, 'Negative: Employee missing name rejected with 400', `Status: ${resNegEmp.status}`);

    // Pos 12: Day Salary Employee
    const empPhone1 = `978${Math.floor(1000000 + Math.random() * 9000000)}`;
    const resEmpDay = await apiRequest('/api/employees', {
      method: 'POST',
      body: {
        name: 'Murugan K',
        phone: empPhone1,
        type: 'Day Salary',
        dailyRate: 700,
        joinDate: '2026-01-15',
        status: 'Active'
      }
    });
    check(resEmpDay.status === 201, 'Positive: Day Salary employee created with 201');
    const dayEmp = resEmpDay.body.data;
    check(dayEmp && dayEmp.dailyRate === 700, 'Positive: Day salary rate stored as 700');

    // Pos 13: Count Salary Employee
    const empPhone2 = `979${Math.floor(1000000 + Math.random() * 9000000)}`;
    const resEmpCount = await apiRequest('/api/employees', {
      method: 'POST',
      body: {
        name: 'Palanisamy V',
        phone: empPhone2,
        type: 'Count Salary',
        pieceRate: 16,
        productType: 'Jacquard Bath Towels',
        joinDate: '2026-02-01',
        status: 'Active'
      }
    });
    check(resEmpCount.status === 201, 'Positive: Count Salary employee created with 201');
    const countEmp = resEmpCount.body.data;
    check(countEmp && countEmp.pieceRate === 16, 'Positive: Count salary piece rate stored as 16');

    // -------------------------------------------------------------
    // SUITE 8: WEEKLY PAYROLL ENGINE & IMMUTABILITY PROTECTION
    // -------------------------------------------------------------
    console.log('\n--- SUITE 8: Weekly Payroll Engine & Immutability Locks ---');

    // Pos 14: Record Weekly Payroll for Day Worker
    const weekStart1 = `2026-${String(Math.floor(10 + Math.random() * 2)).padStart(2, '0')}-${String(Math.floor(1 + Math.random() * 20)).padStart(2, '0')}`;
    const weekEnd1 = '2026-10-25';
    const resPayDay = await apiRequest('/api/payroll/weekly', {
      method: 'POST',
      body: {
        empId: dayEmp.empId,
        employeeName: dayEmp.name,
        workType: 'Day Salary',
        daysWorked: 6,
        rate: 700,
        deductions: 250,
        adjustments: 50,
        weekStart: weekStart1,
        weekEnd: weekEnd1
      }
    });
    check(resPayDay.status === 201, 'Positive: Weekly payroll for Day worker created with 201');
    const payRecDay = resPayDay.body.data;
    check(payRecDay.grossPay === 4200, 'Positive: Day worker gross computed: 6 * 700 = 4,200');
    check(payRecDay.netPay === 4000, 'Positive: Day worker net computed: 4,200 - 250 + 50 = 4,000');

    // Pos 15: Record Weekly Payroll for Count Worker
    const resPayCount = await apiRequest('/api/payroll/weekly', {
      method: 'POST',
      body: {
        empId: countEmp.empId,
        employeeName: countEmp.name,
        workType: 'Count Salary',
        productsProduced: 350,
        rate: 16,
        deductions: 300,
        adjustments: 0,
        weekStart: weekStart1,
        weekEnd: weekEnd1
      }
    });
    check(resPayCount.status === 201, 'Positive: Weekly payroll for Count worker created with 201');
    const payRecCount = resPayCount.body.data;
    check(payRecCount.grossPay === 5600, 'Positive: Count worker gross computed: 350 * 16 = 5,600');
    check(payRecCount.netPay === 5300, 'Positive: Count worker net computed: 5,600 - 300 = 5,300');

    // Neg 17: Attempt duplicate payroll for same employee and same week period
    const resDupPayroll = await apiRequest('/api/payroll/weekly', {
      method: 'POST',
      body: {
        empId: dayEmp.empId,
        employeeName: dayEmp.name,
        workType: 'Day Salary',
        daysWorked: 5,
        rate: 700,
        weekStart: weekStart1,
        weekEnd: weekEnd1
      }
    });
    check(resDupPayroll.status === 400, 'Negative: Duplicate payroll for same employee and week period rejected with 400', `Status: ${resDupPayroll.status}`);

    // Pos 16: Finalize Payroll Record
    const resFinalize = await apiRequest(`/api/payroll/weekly/${payRecDay.id}/finalize`, {
      method: 'PATCH'
    });
    check(resFinalize.status === 200, 'Positive: Payroll record finalized successfully');

    // Neg 18: Attempt to modify finalized / locked payroll record
    const resEditLocked = await apiRequest(`/api/payroll/weekly/${payRecDay.id}`, {
      method: 'PUT',
      body: { daysWorked: 7 }
    });
    check(resEditLocked.status === 400, 'Negative: Attempting to edit a finalized/locked payroll record rejected with 400', `Status: ${resEditLocked.status}`);

    // -------------------------------------------------------------
    // SUITE 9: SALARY REPORTS & CALENDAR RECONCILIATION
    // -------------------------------------------------------------
    console.log('\n--- SUITE 9: Salary Reports & Calendar Month Reconciliation ---');

    const resMonthlySalary = await apiRequest('/api/reports/salary/monthly?month=October&year=2026');
    check(resMonthlySalary.status === 200, 'Positive: Monthly salary report queried with 200');
    check(resMonthlySalary.body.data && resMonthlySalary.body.data.summary && resMonthlySalary.body.data.summary.totalNet > 0, 'Positive: Summary reflects active payroll records');
    check(resMonthlySalary.body.data && resMonthlySalary.body.data.allocationNotes && resMonthlySalary.body.data.allocationNotes.methodology.includes('Strict date-based'), 'Positive: Adheres to strict date reconciliation without 4x multipliers');

    // -------------------------------------------------------------
    // SUITE 10: SALES ANALYTICS & REPORTS ENDPOINTS
    // -------------------------------------------------------------
    console.log('\n--- SUITE 10: Sales Analytics & Periodic Reports ---');

    // Summary KPIs
    const resSummary = await apiRequest('/api/sales/reports/summary');
    check(resSummary.status === 200, 'Positive: Sales summary KPI endpoint responds 200');
    check(resSummary.body.data.totalSales > 0, 'Positive: Total sales KPI is positive');
    check(resSummary.body.data.invoiceCount >= 1, 'Positive: Total invoice count is at least 1');

    // Customer-wise sales
    const resCustWise = await apiRequest('/api/sales/reports/customer-wise');
    check(resCustWise.status === 200, 'Positive: Customer-wise report responds 200');
    check(Array.isArray(resCustWise.body.data), 'Positive: Customer-wise report returns an array');

    // Product-wise sales
    const resProdWise = await apiRequest('/api/sales/reports/product-wise');
    check(resProdWise.status === 200, 'Positive: Product-wise report responds 200');
    check(Array.isArray(resProdWise.body.data), 'Positive: Product-wise report returns an array');

    // GST summary report
    const resGstSummary = await apiRequest('/api/sales/reports/gst');
    check(resGstSummary.status === 200, 'Positive: GST summary report responds 200');
    check(resGstSummary.body.data.taxableAmount > 0, 'Positive: GST summary reflects taxable amount');

    // -------------------------------------------------------------
    // FINAL AUDIT SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`📊 FINAL QA AUDIT SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('================================================================');

    if (failures.length > 0) {
      console.log('\n❌ Failed Tests:');
      failures.forEach((f, idx) => {
        console.log(`  ${idx + 1}. ${f.testName} (${f.details})`);
      });
    }

    process.exit(failedCount === 0 ? 0 : 1);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runAllTests();
