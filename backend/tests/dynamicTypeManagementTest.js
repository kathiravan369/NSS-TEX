const http = require('http');

const PORT = 5001;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: encodeURI(path),
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(dataString ? { 'Content-Length': Buffer.byteLength(dataString) } : {})
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: responseBody });
        }
      });
    });

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('   DYNAMIC TYPE MANAGEMENT COMPREHENSIVE TEST SUITE   ');
  console.log('====================================================\n');

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

  try {
    // 1. Fetch Types by Category
    console.log('--- Test 1: Query Category & Initial State ---');
    const res1 = await request('GET', '/api/types?category=thread_type');
    assert(res1.status === 200, 'GET /api/types returns 200');
    assert(res1.body.success === true, 'Response success is true');
    console.log(`  Info: thread_type count = ${res1.body.count}`);

    // 2. Add New Type
    console.log('\n--- Test 2: Add New Dynamic Type ---');
    const testTypeName = `Silk Thread Test ${Date.now()}`;
    const addRes = await request('POST', '/api/types', {
      category: 'thread_type',
      name: testTypeName,
      code: 'ST-01',
      description: 'High tensile silk thread for border embroidery'
    });
    assert(addRes.status === 201, `Created new type "${testTypeName}" with status 201`);
    assert(addRes.body.data && addRes.body.data.name === testTypeName, 'Returned newly created type record');
    const createdId = addRes.body.data.id;

    // 3. Duplicate Name Validation (Case Insensitive)
    console.log('\n--- Test 3: Duplicate-Name Validation ---');
    const dupRes = await request('POST', '/api/types', {
      category: 'thread_type',
      name: testTypeName.toLowerCase(), // case-insensitive check
      code: 'DUP-01'
    });
    assert(dupRes.status === 400, 'Duplicate type name rejected with status 400');
    assert(dupRes.body.success === false, 'Duplicate response indicates failure');

    // 4. Edit / Rename Type
    console.log('\n--- Test 4: Editing / Renaming a Type ---');
    const updatedName = `${testTypeName} - Renamed`;
    const editRes = await request('PUT', `/api/types/${createdId}`, {
      name: updatedName,
      description: 'Updated description for renamed type'
    });
    assert(editRes.status === 200, `Type updated with status 200`);
    assert(editRes.body.data.name === updatedName, `Type name updated to "${updatedName}"`);

    // 5. Deactivate & Reactivate Type
    console.log('\n--- Test 5: Deactivate & Status Toggle ---');
    const toggleRes = await request('PATCH', `/api/types/${createdId}/toggle-status`);
    assert(toggleRes.status === 200, 'Toggle status returns 200');
    assert(toggleRes.body.data.isActive === false, 'Type is now deactivated (isActive = false)');

    // Verify it is excluded from active-only query
    const activeCheck = await request('GET', `/api/types?category=thread_type`);
    const isExcluded = !activeCheck.body.data.some(t => t.id === createdId);
    assert(isExcluded, 'Deactivated type is excluded from standard active types list');

    // Verify it is included when includeInactive=true
    const inactiveCheck = await request('GET', `/api/types?category=thread_type&includeInactive=true`);
    const isIncluded = inactiveCheck.body.data.some(t => t.id === createdId);
    assert(isIncluded, 'Deactivated type is included when includeInactive=true');

    // Reactivate
    const reactivateRes = await request('PATCH', `/api/types/${createdId}/toggle-status`);
    assert(reactivateRes.body.data.isActive === true, 'Type successfully reactivated');

    // 6. Adding 20+ Types in Bulk without Limit
    console.log('\n--- Test 6: Bulk 20+ Types & Long List Handling ---');
    const bulkCategory = `test_bulk_${Date.now()}`;
    const bulkCount = 22;
    let bulkSuccess = 0;
    for (let i = 1; i <= bulkCount; i++) {
      const bRes = await request('POST', '/api/types', {
        category: bulkCategory,
        name: `Dynamic Option ${String(i).padStart(2, '0')}`,
        code: `OPT-${i}`
      });
      if (bRes.status === 201) bulkSuccess++;
    }
    assert(bulkSuccess === bulkCount, `Successfully added ${bulkCount} dynamic entries without 4-item limit`);

    // Verify pagination and search on long lists
    const page1 = await request('GET', `/api/types?category=${bulkCategory}&page=1&limit=10`);
    assert(page1.body.data.length === 10, 'Page 1 correctly returns 10 items');
    assert(page1.body.total === bulkCount, `Total count matches ${bulkCount}`);

    const searchRes = await request('GET', `/api/types?category=${bulkCategory}&search=Option 15`);
    assert(searchRes.body.data.length === 1 && searchRes.body.data[0].name === 'Dynamic Option 15', 'Search successfully isolates specific item in long list');

    // 7. Verify Product Catalog with Extra Data
    console.log('\n--- Test 7: Product Catalog Type with Extra Data ---');
    const testProduct = `Special Terry Towel ${Date.now()}`;
    const prodRes = await request('POST', '/api/types', {
      category: 'product',
      name: testProduct,
      code: 'TWL-SPEC-01',
      description: 'Export grade 500 GSM bath towel',
      extraData: {
        category: 'Towels',
        unit: 'Pcs',
        rate: 195,
        gstRate: 12
      }
    });
    assert(prodRes.status === 201, 'Created reusable product catalog item');
    assert(prodRes.body.data.extraData?.rate === 195, 'Extra data (rate, unit, gstRate) preserved in JSONB');

    // 8. Verify Existing Data & Database Relationships Integrity
    console.log('\n--- Test 8: Historical Records & Transaction Integrity ---');
    const threadPurchases = await request('GET', '/api/thread-purchases');
    assert(threadPurchases.status === 200, 'Thread purchases endpoint operational');
    
    const oilPurchases = await request('GET', '/api/oil-purchases');
    assert(oilPurchases.status === 200, 'Oil purchases endpoint operational');

    const machineryExpenses = await request('GET', '/api/machinery-expenses');
    assert(machineryExpenses.status === 200, 'Machinery expenses endpoint operational');

    const invoices = await request('GET', '/api/sales/invoices');
    assert(invoices.status === 200, 'Sales invoices endpoint operational');

    console.log('\n====================================================');
    console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED   `);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
