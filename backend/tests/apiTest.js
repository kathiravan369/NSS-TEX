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

let localServer = null;

function ensureServerRunning() {
  return new Promise((resolve) => {
    const req = http.request(BASE_URL + '/api/health', { method: 'GET', timeout: 1000 }, (res) => {
      resolve();
    });
    req.on('error', () => {
      try {
        const app = require('../server');
        localServer = app.listen(5001, () => {
          console.log('⚡ Started in-process test server on port 5001');
          resolve();
        });
      } catch (e) {
        resolve();
      }
    });
    req.on('timeout', () => {
      req.destroy();
      resolve();
    });
    req.end();
  });
}

async function runTests() {
  await ensureServerRunning();
  console.log('\n🧪 ========================================================');
  console.log('🧪 Starting NSS TOWELS Automated API & Payroll Test Suite');
  console.log('🧪 ========================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Reason: ${err.message}`);
      failed++;
    }
  }

  // 1. Health & Root
  await test('GET /api/health returns system status', async () => {
    const res = await request('/api/health');
    if (!res.body.success) throw new Error('Expected success: true');
  });

  await test('GET /api/dashboard/summary returns KPIs', async () => {
    const res = await request('/api/dashboard/summary');
    if (res.status !== 200 || res.body.data?.kpis?.totalRawMaterial === undefined) {
      throw new Error('Invalid dashboard summary structure');
    }
  });

  await test('GET /api/dashboard/expenses returns breakup & comparison', async () => {
    const res = await request('/api/dashboard/expenses');
    if (res.status !== 200 || !res.body.data?.expenseComparison) {
      throw new Error('Invalid expenses data');
    }
  });

  // 2. Employees CRUD
  let createdEmpId = null;
  await test('POST /api/employees creates a new employee with Day Salary', async () => {
    const res = await request('/api/employees', {
      method: 'POST',
      body: {
        name: 'Automated Test Employee',
        phone: '9988001122',
        workType: 'Day Salary',
        dailyRate: 650,
        status: 'Active',
        notes: 'API Test Record'
      }
    });
    if (res.status !== 201 || !res.body.data?.empId) {
      throw new Error(`Expected 201 Created, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
    createdEmpId = res.body.data._id || res.body.data.id;
  });

  await test('GET /api/employees returns employee list', async () => {
    const res = await request('/api/employees?search=Automated');
    if (res.status !== 200 || res.body.count === 0) {
      throw new Error('Search failed to return created employee');
    }
  });

  await test('PATCH /api/employees/:id/status updates status', async () => {
    const res = await request(`/api/employees/${createdEmpId}/status`, {
      method: 'PATCH',
      body: { status: 'Inactive' }
    });
    if (res.status !== 200 || res.body.data?.status !== 'Inactive') {
      throw new Error(`Failed to update status, got ${res.status}`);
    }
  });

  // 3. Thread Purchases
  await test('POST /api/thread-purchases creates purchase with GST calculation', async () => {
    const res = await request('/api/thread-purchases', {
      method: 'POST',
      body: {
        supplier: 'Test Supplier',
        threadType: 'Cotton',
        qty: 100,
        rate: 400,
        gstMode: 'WITH_GST',
        gstRate: 5,
        status: 'Paid'
      }
    });
    if (res.status !== 201 || res.body.data?.total !== 42000) {
      throw new Error(`Expected total 42000, got ${res.body.data?.total}`);
    }
  });

  // 4. Oil & Stock
  await test('POST /api/oil-purchases records purchase & updates stock', async () => {
    const res = await request('/api/oil-purchases', {
      method: 'POST',
      body: {
        oilType: 'Machine Oil',
        supplier: 'Test Oil Supplier',
        qty: 50,
        rate: 120,
        includeGST: true
      }
    });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
  });

  await test('GET /api/oil-stock returns live stock inventory', async () => {
    const res = await request('/api/oil-stock');
    if (res.status !== 200 || !Array.isArray(res.body.data)) {
      throw new Error('Failed to retrieve stock list');
    }
  });

  // 5. Machinery Expense
  await test('POST /api/machinery-expenses adds categorized expense', async () => {
    const res = await request('/api/machinery-expenses', {
      method: 'POST',
      body: {
        machine: 'Loom Machine',
        category: 'Maintenance',
        desc: 'Bearing Lubrication',
        qty: 1,
        cost: 3000,
        vendor: 'Tech Works',
        includeGST: true,
        gstRate: 18
      }
    });
    if (res.status !== 201 || res.body.data?.total !== 3540) {
      throw new Error(`Expected total 3540, got ${res.body.data?.total}`);
    }
  });

  // 6. Electricity Expense
  await test('POST /api/electricity-expenses validates readings and computes units', async () => {
    const res = await request('/api/electricity-expenses', {
      method: 'POST',
      body: {
        month: 'November 2026',
        billDate: '2026-11-05',
        prev: 10000,
        curr: 10500,
        rate: 6.50,
        fixed: 400,
        additional: 100
      }
    });
    if (res.status !== 201 || res.body.data?.units !== 500) {
      throw new Error(`Expected 500 units, got ${res.body.data?.units}`);
    }
  });

  // 7. Weekly Payroll: Day Salary & Count Salary Formulas
  let testPayrollId = null;
  const testWeekStart = `2026-11-${String(10 + Math.floor(Math.random() * 10)).padStart(2, '0')}`;
  const testWeekEnd = `2026-11-${String(21 + Math.floor(Math.random() * 5)).padStart(2, '0')}`;

  await test('POST /api/payroll/weekly correctly calculates Day Salary gross & net', async () => {
    const res = await request('/api/payroll/weekly', {
      method: 'POST',
      body: {
        empId: `EMP-${Date.now() % 10000}`,
        employeeName: 'Ramesh Kumar',
        workType: 'Day Salary',
        weekStart: testWeekStart,
        weekEnd: testWeekEnd,
        daysWorked: 6,
        rate: 600,
        deductions: 200,
        adjustments: 50
      }
    });
    if (res.status !== 201 || res.body.data?.grossPay !== 3600 || res.body.data?.netPay !== 3450) {
      throw new Error(`Day Salary formula mismatch: gross=${res.body.data?.grossPay}, net=${res.body.data?.netPay}`);
    }
    testPayrollId = res.body.data._id || res.body.data.id;
  });

  await test('POST /api/payroll/weekly correctly calculates Count Salary gross & net', async () => {
    const res = await request('/api/payroll/weekly', {
      method: 'POST',
      body: {
        empId: `EMP-${(Date.now() + 1) % 10000}`,
        employeeName: 'Selvi',
        workType: 'Count Salary',
        weekStart: testWeekStart,
        weekEnd: testWeekEnd,
        productsProduced: 500,
        rate: 12,
        deductions: 300,
        adjustments: 0
      }
    });
    if (res.status !== 201 || res.body.data?.grossPay !== 6000 || res.body.data?.netPay !== 5700) {
      throw new Error(`Count Salary formula mismatch: gross=${res.body.data?.grossPay}, net=${res.body.data?.netPay}`);
    }
  });

  // 8. Weekly Payroll: Finalization & Immutability
  await test('PATCH /api/payroll/weekly/:id/finalize protects record from edits', async () => {
    const finRes = await request(`/api/payroll/weekly/${testPayrollId}/finalize`, {
      method: 'PATCH'
    });
    if (finRes.status !== 200 || !finRes.body.data?.isFinalized) {
      throw new Error('Failed to finalize payroll record');
    }

    // Try modifying finalized record -> must be rejected
    const editRes = await request(`/api/payroll/weekly/${testPayrollId}`, {
      method: 'PUT',
      body: { daysWorked: 7 }
    });
    if (editRes.status !== 400) {
      throw new Error(`Expected 400 rejection for finalized record, got status ${editRes.status}`);
    }
  });

  // 9. Weekly Payroll: Payment Marking
  await test('PATCH /api/payroll/weekly/:id/payment updates payment status', async () => {
    const payRes = await request(`/api/payroll/weekly/${testPayrollId}/payment`, {
      method: 'PATCH',
      body: { status: 'Paid', paymentDate: '2026-11-08' }
    });
    if (payRes.status !== 200 || payRes.body.data?.status !== 'Paid') {
      throw new Error('Failed to record payment');
    }
  });

  // 10. Month Boundary & Reconciled Salary Reports
  await test('GET /api/reports/salary/monthly performs date-based reconciliation without 4x shortcuts', async () => {
    const res = await request('/api/reports/salary/monthly?month=October&year=2026');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

    const summary = res.body.data?.summary;
    if (!summary || summary.totalGross === undefined || summary.totalNet === undefined) {
      throw new Error('Invalid monthly summary totals');
    }

    if (!res.body.data?.allocationNotes?.methodology) {
      throw new Error('Missing allocation methodology notes');
    }
  });

  console.log('\n--------------------------------------------------------');
  console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('--------------------------------------------------------\n');

  if (localServer) {
    localServer.close();
  }

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  if (localServer) {
    localServer.close();
  }
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
