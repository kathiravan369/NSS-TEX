const http = require('http');

const BASE_URL = 'http://localhost:5001';

function request(path, options = {}) {
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

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING NSS-TEX SALES MODULE END-TO-END TESTS');
  console.log('====================================================');

  try {
    // Test 1: Check Next Customer ID
    console.log('\n--- Test 1: Next Customer ID ---');
    const nextIdRes = await request('/api/sales/customers/next-id');
    assert(nextIdRes.status === 200, 'Next customer ID returns status 200');
    assert(nextIdRes.body.success === true, 'Response has success=true');
    assert(/^CUS-\d+$/.test(nextIdRes.body.nextId), `Next ID format is CUS-XXX (${nextIdRes.body.nextId})`);

    // Test 2: Create New Customer
    console.log('\n--- Test 2: Create Customer ---');
    const testCustPhone = `984${Math.floor(1000000 + Math.random() * 9000000)}`;
    const custPayload = {
      name: 'Apex Towels Corporation',
      customerType: 'Business',
      phone: testCustPhone,
      email: 'contact@apextowels.com',
      companyName: 'Apex Towels Corp Ltd',
      gstin: '33AAACA' + Math.floor(1000 + Math.random() * 9000) + 'A1Z5',
      pan: 'AAACA1234A',
      customerCategory: 'Wholesale',
      billingAddress: {
        addressLine: '124 Cotton Market',
        city: 'Tirupur',
        state: 'Tamil Nadu',
        pincode: '641604',
        country: 'India'
      },
      sameAsBilling: true,
      openingBalance: 10000,
      openingBalanceType: 'Debit',
      creditLimit: 300000,
      paymentTerms: '30 Days',
      priceList: 'Wholesale'
    };

    const createCustRes = await request('/api/sales/customers', {
      method: 'POST',
      body: custPayload
    });

    assert(createCustRes.status === 201, 'Customer created with status 201');
    assert(createCustRes.body.success === true, 'Customer create returns success');
    const createdCustomer = createCustRes.body.data;
    assert(createdCustomer.name === 'Apex Towels Corporation', 'Customer name is saved properly');
    assert(createdCustomer.customerId.startsWith('CUS-'), 'Customer ID is auto-assigned');

    // Test 3: Duplicate Customer Warning Check
    console.log('\n--- Test 3: Duplicate Customer Check ---');
    const dupCheck = await request(`/api/sales/customers/check-duplicate?phone=${testCustPhone}`);
    assert(dupCheck.status === 200, 'Duplicate check responds 200');
    assert(dupCheck.body.isDuplicate === true, 'Duplicate check correctly identifies existing customer');
    assert(dupCheck.body.duplicateField === 'Phone Number', 'Identifies duplicate field as Phone Number');

    // Test 4: List Customers with Search & Status Filter
    console.log('\n--- Test 4: List Customers ---');
    const listCustRes = await request('/api/sales/customers?search=Apex&status=Active');
    assert(listCustRes.status === 200, 'List customers responds 200');
    assert(listCustRes.body.data.length >= 1, 'Search finds created customer');

    // Test 5: Next Invoice Number
    console.log('\n--- Test 5: Next Invoice Number ---');
    const nextInvRes = await request('/api/sales/invoices/next-number');
    assert(nextInvRes.status === 200, 'Next invoice number responds 200');
    assert(/^INV-\d{4}-\d{4}$/.test(nextInvRes.body.nextNumber), `Invoice number format is INV-YYYY-XXXX (${nextInvRes.body.nextNumber})`);

    // Test 6: Decimal-safe Invoice Calculations (Intra-state Tamil Nadu)
    console.log('\n--- Test 6: Tax Calculation (Intra-state Tamil Nadu) ---');
    const calcPayload = {
      items: [
        { productName: 'Bath Towel - Large', quantity: 100, rate: 160, discount: 0, gstRate: 12 },
        { productName: 'Cotton Terry Hand Towel', quantity: 100, rate: 70, discount: 500, gstRate: 12 }
      ],
      extraDiscount: 500,
      customerSnapshot: {
        billingAddress: { state: 'Tamil Nadu' },
        gstin: '33AAACA1234A1Z5'
      }
    };
    const calcRes = await request('/api/sales/invoices/calculate', {
      method: 'POST',
      body: calcPayload
    });
    assert(calcRes.status === 200, 'Calculation responds 200');
    assert(calcRes.body.isIntraState === true, 'Correctly identifies Intra-state Tamil Nadu');
    assert(calcRes.body.subtotal === 23000, `Subtotal calculation: ${calcRes.body.subtotal} === 23000`);
    assert(calcRes.body.taxableAmount === 22000, `Taxable amount (23000 - 500 - 500): ${calcRes.body.taxableAmount} === 22000`);
    assert(calcRes.body.cgstAmount === 1320, `CGST 6%: ${calcRes.body.cgstAmount} === 1320`);
    assert(calcRes.body.sgstAmount === 1320, `SGST 6%: ${calcRes.body.sgstAmount} === 1320`);
    assert(calcRes.body.grandTotal === 24640, `Grand total: ${calcRes.body.grandTotal} === 24640`);

    // Test 7: Create Invoice
    console.log('\n--- Test 7: Create Invoice ---');
    const invoicePayload = {
      invoiceDate: '2026-10-18',
      dueDate: '2026-11-18',
      referenceNo: 'PO-TEST-99',
      customerId: createdCustomer.id,
      customerSnapshot: {
        id: createdCustomer.id,
        customerId: createdCustomer.customerId,
        name: createdCustomer.name,
        companyName: createdCustomer.companyName,
        phone: createdCustomer.phone,
        gstin: createdCustomer.gstin,
        billingAddress: createdCustomer.billingAddress,
        shippingAddress: createdCustomer.billingAddress
      },
      items: [
        { productName: 'Bath Towel - Large (30 × 60)', category: 'Towels', unit: 'Pcs', quantity: 100, rate: 160, discount: 0, gstRate: 12 },
        { productName: 'Cotton Terry Hand Towel (16 × 24)', category: 'Towels', unit: 'Pcs', quantity: 100, rate: 70, discount: 0, gstRate: 12 }
      ],
      initialPayment: 15000,
      paymentMode: 'Bank Transfer',
      paymentReference: 'NEFT-TEST-8812',
      invoiceStatus: 'Issued'
    };

    const createInvRes = await request('/api/sales/invoices', {
      method: 'POST',
      body: invoicePayload
    });

    assert(createInvRes.status === 201, 'Invoice created with status 201');
    assert(createInvRes.body.success === true, 'Invoice creation returns success');
    const createdInvoice = createInvRes.body.data;
    assert(createdInvoice.subtotal === 23000, 'Subtotal is 23,000');
    assert(createdInvoice.grandTotal === 25760, `Grand total with 12% GST is 25,760 (got ${createdInvoice.grandTotal})`);
    assert(createdInvoice.amountPaid === 15000, 'Amount paid is 15,000');
    assert(createdInvoice.balanceDue === 10760, `Balance due is 10,760 (got ${createdInvoice.balanceDue})`);
    assert(createdInvoice.paymentStatus === 'Partially Paid', 'Payment status is Partially Paid');

    // Test 8: Record Partial Payment
    console.log('\n--- Test 8: Record Settlement Payment ---');
    const payRes = await request(`/api/sales/invoices/${createdInvoice.id}/payments`, {
      method: 'POST',
      body: {
        amount: 10760,
        paymentMode: 'UPI',
        reference: 'UPI-SETTLE-001'
      }
    });

    assert(payRes.status === 200, 'Record payment responds 200');
    const updatedInvoice = payRes.body.data;
    assert(updatedInvoice.amountPaid === 25760, `Amount paid updated to 25,760 (got ${updatedInvoice.amountPaid})`);
    assert(updatedInvoice.balanceDue === 0, `Balance due cleared to 0 (got ${updatedInvoice.balanceDue})`);
    assert(updatedInvoice.paymentStatus === 'Paid', 'Status automatically updated to Paid');

    // Test 9: Sales Summary KPIs
    console.log('\n--- Test 9: Sales Summary KPIs ---');
    const summaryRes = await request('/api/sales/reports/summary');
    assert(summaryRes.status === 200, 'Sales summary responds 200');
    assert(summaryRes.body.data.totalSales > 0, `Total sales is positive (${summaryRes.body.data.totalSales})`);
    assert(summaryRes.body.data.amountReceived > 0, `Amount received is positive (${summaryRes.body.data.amountReceived})`);
    assert(summaryRes.body.data.invoiceCount >= 1, `Total invoice count reflects all invoices (${summaryRes.body.data.invoiceCount})`);

    // Test 10: Customer-wise Report
    console.log('\n--- Test 10: Customer-wise Sales Report ---');
    const custWiseRes = await request('/api/sales/reports/customer-wise');
    assert(custWiseRes.status === 200, 'Customer-wise report responds 200');
    assert(Array.isArray(custWiseRes.body.data), 'Returns data array');
    const apexRow = custWiseRes.body.data.find(r => r.customerName === 'Apex Towels Corporation');
    assert(!!apexRow, 'Contains customer record for Apex Towels');
    assert(apexRow.totalSales === 25760, `Customer total sales matches: ${apexRow?.totalSales}`);

    // Test 11: Product-wise Report
    console.log('\n--- Test 11: Product-wise Sales Report ---');
    const prodWiseRes = await request('/api/sales/reports/product-wise');
    assert(prodWiseRes.status === 200, 'Product-wise report responds 200');
    assert(prodWiseRes.body.data.length > 0, 'Contains product line sales records');

    // Test 12: GST Summary Report
    console.log('\n--- Test 12: GST Summary Report ---');
    const gstRes = await request('/api/sales/reports/gst');
    assert(gstRes.status === 200, 'GST report responds 200');
    assert(gstRes.body.data.taxableAmount > 0, 'Taxable amount calculated');
    assert(gstRes.body.data.cgstAmount > 0, 'CGST calculated');
    assert(gstRes.body.data.sgstAmount > 0, 'SGST calculated');

    // Test 13: Customer Deactivation Preserves Invoices
    console.log('\n--- Test 13: Customer Deactivation Preserves Historical Records ---');
    const deactRes = await request(`/api/sales/customers/${createdCustomer.id}/status`, {
      method: 'PATCH',
      body: { status: 'Inactive' }
    });
    assert(deactRes.status === 200, 'Deactivation responds 200');
    assert(deactRes.body.data.status === 'Inactive', 'Customer marked Inactive');

    // Verify invoice still intact
    const verifyInv = await request(`/api/sales/invoices/${createdInvoice.id}`);
    assert(verifyInv.status === 200, 'Invoice remains accessible after customer deactivation');
    assert(verifyInv.body.data.customerSnapshot.name === 'Apex Towels Corporation', 'Customer snapshot preserved on invoice');

    console.log('\n====================================================');
    console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
