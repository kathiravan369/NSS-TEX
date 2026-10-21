const http = require('http');

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:5001${path}`);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Thread Purchase Cotton Rate Details Integration Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Test 1: Create Thread Purchase with GST with the exact items from the screenshot:
    // White Cotton: 10 x 100 = 1000
    // Red Cotton: 5 x 120 = 600
    // Blue Cotton: 8 x 110 = 880
    // Total Subtotal = 2480, Total Qty = 23, GST 5% = 124, Total = 2604
    const res1 = await request('POST', '/api/thread-purchases', {
      supplier: 'Premier Cotton Mills',
      unit: 'Kg',
      gstMode: 'WITH_GST',
      gstRate: 5,
      items: [
        { name: 'White Cotton', qty: 10, rate: 100 },
        { name: 'Red Cotton', qty: 5, rate: 120 },
        { name: 'Blue Cotton', qty: 8, rate: 110 }
      ],
      paidAmount: 2604,
      notes: 'Cotton varieties rate card test'
    });

    assert(res1.status === 201 && res1.data.success, 'Create Thread Purchase (With GST) succeeded');
    const item1 = res1.data.data;
    assert(Number(item1.subtotal) === 2480, `Subtotal is 2480 (got ${item1.subtotal})`);
    assert(Number(item1.qty) === 23, `Total Qty is 23 (got ${item1.qty})`);
    assert(Number(item1.total) === 2604, `Total is 2604 with 5% GST (got ${item1.total})`);
    assert(Array.isArray(item1.items) && item1.items.length === 3, 'Items array preserved with 3 varieties');
    assert(item1.status === 'Paid', `Payment status is Paid (got ${item1.status})`);

    // Test 2: Update Thread Purchase (Edit roundtrip)
    const updateRes = await request('PUT', `/api/thread-purchases/${item1.id || item1._id}`, {
      items: [
        { name: 'White Cotton', qty: 12, rate: 100 }, // 1200
        { name: 'Red Cotton', qty: 5, rate: 120 },    // 600
        { name: 'Blue Cotton', qty: 10, rate: 110 }   // 1100 => Subtotal 2900, Qty 27, GST 5% = 145 => Total 3045
      ],
      paidAmount: 2000
    });

    assert(updateRes.status === 200 && updateRes.data.success, 'Update Thread Purchase succeeded');
    const updated = updateRes.data.data;
    assert(Number(updated.subtotal) === 2900, `Updated subtotal is 2900 (got ${updated.subtotal})`);
    assert(Number(updated.qty) === 27, `Updated total qty is 27 (got ${updated.qty})`);
    assert(Number(updated.total) === 3045, `Updated total is 3045 (got ${updated.total})`);
    assert(Number(updated.balanceAmount) === 1045, `Updated balance is 1045 (got ${updated.balanceAmount})`);
    assert(updated.status === 'Pending', `Updated status is Pending (got ${updated.status})`);

    // Test 3: Create Thread Purchase Without GST
    const res2 = await request('POST', '/api/thread-purchases', {
      supplier: 'Sree Yarn Traders',
      unit: 'Kg',
      gstMode: 'WITHOUT_GST',
      items: [
        { name: 'White Cotton', qty: 20, rate: 95 },
        { name: 'Red Cotton', qty: 10, rate: 115 }
      ],
      paidAmount: 0
    });

    assert(res2.status === 201 && res2.data.success, 'Create Thread Purchase (Without GST) succeeded');
    const item2 = res2.data.data;
    assert(Number(item2.total) === 3050, `No GST total is 3050 (got ${item2.total})`);
    assert(Number(item2.balanceAmount) === 3050, `Balance is 3050 (got ${item2.balanceAmount})`);

    console.log(`\n========================================`);
    console.log(`Summary: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

runTests();
