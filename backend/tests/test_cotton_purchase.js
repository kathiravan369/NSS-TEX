const http = require('http');

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Cotton Purchase & Dynamic Varieties Integration Tests...\n');
  let createdCottonId = null;
  let createdOilId = null;

  try {
    // Test 1: Standard Machine Oil Purchase (Preserve Existing Functionality)
    console.log('Test 1: Recording standard Machine Oil purchase...');
    const oilPayload = {
      date: new Date().toISOString().split('T')[0],
      oilType: 'Machine Oil',
      supplier: 'Test Oil Supplier',
      qty: 20,
      unit: 'Litre',
      rate: 150,
      includeGST: true,
      gstRate: 5,
      paidAmount: 3150,
      status: 'Paid',
      notes: 'Standard oil regression test'
    };

    const resOil = await makeRequest({
      hostname: 'localhost',
      port: 5001,
      path: '/api/oil-purchases',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, oilPayload);

    if (resOil.status === 201 && resOil.data?.success) {
      createdOilId = resOil.data.data.id || resOil.data.data._id;
      console.log(`✅ Machine Oil created successfully! ID: ${createdOilId}, Cost: ₹${resOil.data.data.cost}, Final: ₹${resOil.data.data.final}`);
      if (resOil.data.data.cost !== 3000 || resOil.data.data.final !== 3150) {
        throw new Error(`Unexpected calculations for oil: cost=${resOil.data.data.cost}, final=${resOil.data.data.final}`);
      }
    } else {
      throw new Error(`Failed to create oil purchase: ${JSON.stringify(resOil)}`);
    }

    // Test 2: Validation of Cotton Purchase without varieties
    console.log('\nTest 2: Validating rejection when Cotton has no varieties...');
    const invalidCottonPayload = {
      date: new Date().toISOString().split('T')[0],
      oilType: 'Cotton',
      supplier: 'Apex Cotton Traders',
      items: []
    };

    const resInvalid = await makeRequest({
      hostname: 'localhost',
      port: 5001,
      path: '/api/oil-purchases',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, invalidCottonPayload);

    if (resInvalid.status === 400 && !resInvalid.data.success) {
      console.log(`✅ Correctly rejected empty cotton varieties: "${resInvalid.data.error}"`);
    } else {
      throw new Error(`Expected 400 error for empty cotton varieties but got: ${resInvalid.status}`);
    }

    // Test 3: Validation of Cotton Purchase with negative rate or invalid qty
    console.log('\nTest 3: Validating rejection on negative rate or 0 qty...');
    const invalidRowPayload = {
      date: new Date().toISOString().split('T')[0],
      oilType: 'Cotton',
      supplier: 'Apex Cotton Traders',
      items: [
        { name: 'Red Cotton', qty: -5, unit: 'Kg', rate: 100 }
      ]
    };

    const resInvalidRow = await makeRequest({
      hostname: 'localhost',
      port: 5001,
      path: '/api/oil-purchases',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, invalidRowPayload);

    if (resInvalidRow.status === 400 && !resInvalidRow.data.success) {
      console.log(`✅ Correctly rejected invalid quantity: "${resInvalidRow.data.error}"`);
    } else {
      throw new Error(`Expected 400 error for invalid row but got: ${resInvalidRow.status}`);
    }

    // Test 4: Creating Dynamic Cotton Purchase matching the exact prompt reference:
    // White Cotton: 10 × 100 = 1000
    // Red Cotton: 5 × 120 = 600
    // Blue Cotton: 8 × 110 = 880
    // Subtotal = 1000 + 600 + 880 = 2480, Total Qty = 23, GST (5%) = 124, Final = 2604, Balance = 604
    console.log('\nTest 4: Creating Cotton Purchase with dynamic varieties (White, Red, Blue)...');
    const cottonPayload = {
      date: new Date().toISOString().split('T')[0],
      oilType: 'Cotton',
      supplier: 'Apex Cotton Mills',
      items: [
        { name: 'White Cotton', qty: 10, unit: 'Kg', rate: 100 },
        { name: 'Red Cotton', qty: 5, unit: 'Kg', rate: 120 },
        { name: 'Blue Cotton', qty: 8, unit: 'Kg', rate: 110 }
      ],
      includeGST: true,
      gstRate: 5,
      paidAmount: 2000,
      notes: 'First batch of multi-color cotton'
    };

    const resCotton = await makeRequest({
      hostname: 'localhost',
      port: 5001,
      path: '/api/oil-purchases',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, cottonPayload);

    if (resCotton.status === 201 && resCotton.data?.success) {
      const saved = resCotton.data.data;
      createdCottonId = saved.id || saved._id;
      console.log(`✅ Cotton purchase created! ID: ${createdCottonId}`);
      console.log(`   Total Qty: ${saved.qty} (expected 23)`);
      console.log(`   Subtotal Cost: ₹${saved.cost} (expected 2480)`);
      console.log(`   GST (5%): ₹${saved.gst} (expected 124)`);
      console.log(`   Final Total: ₹${saved.final} (expected 2604)`);
      console.log(`   Balance: ₹${saved.balanceAmount} (expected 604)`);
      console.log(`   Status: ${saved.status} (expected Pending)`);
      console.log(`   Items persisted count: ${saved.items?.length} (expected 3)`);

      if (saved.qty !== 23 || saved.cost !== 2480 || saved.gst !== 124 || saved.final !== 2604) {
        throw new Error(`Calculations do not match expected values: qty=${saved.qty}, cost=${saved.cost}, gst=${saved.gst}, final=${saved.final}`);
      }
      if (!Array.isArray(saved.items) || saved.items.length !== 3) {
        throw new Error(`Items were not persisted properly as an array: ${JSON.stringify(saved.items)}`);
      }
    } else {
      throw new Error(`Failed to create cotton purchase: ${JSON.stringify(resCotton)}`);
    }

    // Test 5: Fetch purchases and verify items are returned
    console.log('\nTest 5: Fetching cotton purchase via GET /api/oil-purchases...');
    const resGet = await makeRequest({
      hostname: 'localhost',
      port: 5001,
      path: `/api/oil-purchases?oilType=Cotton`,
      method: 'GET'
    });

    if (resGet.status === 200 && resGet.data?.success) {
      const match = (resGet.data.data || []).find(x => String(x.id) === String(createdCottonId) || String(x._id) === String(createdCottonId));
      if (!match) {
        throw new Error('Created cotton purchase not found in GET response');
      }
      console.log(`✅ Found cotton purchase in GET list. Items count: ${match.items?.length}`);
      match.items.forEach(it => {
        console.log(`   - Variety: ${it.name}, Qty: ${it.qty} ${it.unit}, Rate: ₹${it.rate}, Subtotal: ₹${it.subtotal}`);
      });
    } else {
      throw new Error(`Failed to GET oil purchases: ${JSON.stringify(resGet)}`);
    }

    // Test 6: Edit Cotton Purchase (Add a new variety, edit White Cotton, remove Red Cotton)
    console.log('\nTest 6: Editing cotton purchase (editing White, removing Red, adding Green Cotton)...');
    const updatePayload = {
      oilType: 'Cotton',
      supplier: 'Apex Cotton Mills Updated',
      items: [
        { name: 'White Cotton', qty: 15, unit: 'Kg', rate: 100 }, // was 10
        { name: 'Blue Cotton', qty: 8, unit: 'Kg', rate: 110 },
        { name: 'Green Cotton', qty: 4, unit: 'Kg', rate: 125 }  // new variety: 4 * 125 = 500
      ],
      // Expected new subtotal: (15*100) + (8*110) + (4*125) = 1500 + 880 + 500 = 2880
      // Qty = 15 + 8 + 4 = 27
      // GST (5%) = 144
      // Final = 2880 + 144 = 3024
      // Pay full: 3024 => Balance = 0, Status = Paid
      includeGST: true,
      gstRate: 5,
      paidAmount: 3024
    };

    const resUpdate = await makeRequest({
      hostname: 'localhost',
      port: 5001,
      path: `/api/oil-purchases/${createdCottonId}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, updatePayload);

    if (resUpdate.status === 200 && resUpdate.data?.success) {
      const updated = resUpdate.data.data;
      console.log(`✅ Cotton purchase updated successfully!`);
      console.log(`   Updated Qty: ${updated.qty} (expected 27)`);
      console.log(`   Updated Cost: ₹${updated.cost} (expected 2880)`);
      console.log(`   Updated GST: ₹${updated.gst} (expected 144)`);
      console.log(`   Updated Final: ₹${updated.final} (expected 3024)`);
      console.log(`   Updated Balance: ₹${updated.balanceAmount} (expected 0)`);
      console.log(`   Updated Status: ${updated.status} (expected Paid)`);
      console.log(`   Updated Items Count: ${updated.items?.length} (expected 3)`);

      if (updated.qty !== 27 || updated.cost !== 2880 || updated.final !== 3024 || updated.status !== 'Paid') {
        throw new Error(`Calculations on update do not match: qty=${updated.qty}, cost=${updated.cost}, final=${updated.final}, status=${updated.status}`);
      }
    } else {
      throw new Error(`Failed to update cotton purchase: ${JSON.stringify(resUpdate)}`);
    }

    console.log('\n🎉 ALL COTTON VARIETIES INTEGRATION TESTS PASSED PERFECTLY! 🎉\n');
  } catch (err) {
    console.error(`\n❌ TEST FAILED: ${err.message}`);
    process.exit(1);
  } finally {
    // Cleanup test records
    if (createdCottonId) {
      await makeRequest({
        hostname: 'localhost',
        port: 5001,
        path: `/api/oil-purchases/${createdCottonId}`,
        method: 'DELETE'
      }).catch(() => {});
    }
    if (createdOilId) {
      await makeRequest({
        hostname: 'localhost',
        port: 5001,
        path: `/api/oil-purchases/${createdOilId}`,
        method: 'DELETE'
      }).catch(() => {});
    }
  }
}

runTests();
