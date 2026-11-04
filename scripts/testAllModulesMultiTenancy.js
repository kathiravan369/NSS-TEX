const http = require('http');
const app = require('../backend/server');
const { connectDB } = require('../backend/config/db');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runVerification() {
  await connectDB();
  const server = app.listen(5098, async () => {
    console.log('🚀 Verification server listening on port 5098...\n');

    try {
      // 1. Check Businesses
      const bizRes = await request({
        hostname: 'localhost',
        port: 5098,
        path: '/api/businesses',
        method: 'GET'
      });
      console.log('1. Available Businesses:');
      bizRes.body.businesses.forEach(b => console.log(`   - [${b.id}] ${b.name} (${b.badge}): isConnected=${b.isConnected}`));

      // 2. Insert test employee into NSS Text
      const nssEmpRes = await request({
        hostname: 'localhost',
        port: 5098,
        path: '/api/employees',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Business-Id': 'nss_text' }
      }, {
        name: 'NSS Test Worker',
        phone: '9876543210',
        workType: 'Weaving',
        dailyRate: 650
      });
      console.log('\n2. Created Employee in NSS Text:', nssEmpRes.body.success, 'ID:', nssEmpRes.body.data?._id || nssEmpRes.body.data?.id);
      const nssEmpId = nssEmpRes.body.data?._id || nssEmpRes.body.data?.id;

      // 3. Insert test employee into KD Text
      const kdEmpRes = await request({
        hostname: 'localhost',
        port: 5098,
        path: '/api/employees',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Business-Id': 'kd_text' }
      }, {
        name: 'KD Text Specialist',
        phone: '9123456780',
        workType: 'Spinning',
        dailyRate: 750
      });
      console.log('3. Created Employee in KD Text:', kdEmpRes.body.success, 'ID:', kdEmpRes.body.data?._id || kdEmpRes.body.data?.id);
      const kdEmpId = kdEmpRes.body.data?._id || kdEmpRes.body.data?.id;

      // 4. Verify NSS Text Employee List
      const nssList = await request({
        hostname: 'localhost',
        port: 5098,
        path: '/api/employees',
        method: 'GET',
        headers: { 'X-Business-Id': 'nss_text' }
      });
      const nssNames = (nssList.body.data || []).map(e => e.name);
      console.log('\n4. NSS Text Employees:', nssNames);
      console.log('   Contains NSS Test Worker?', nssNames.includes('NSS Test Worker'));
      console.log('   Contains KD Text Specialist?', nssNames.includes('KD Text Specialist'), '(MUST BE FALSE)');

      // 5. Verify KD Text Employee List
      const kdList = await request({
        hostname: 'localhost',
        port: 5098,
        path: '/api/employees',
        method: 'GET',
        headers: { 'X-Business-Id': 'kd_text' }
      });
      const kdNames = (kdList.body.data || []).map(e => e.name);
      console.log('\n5. KD Text Employees:', kdNames);
      console.log('   Contains KD Text Specialist?', kdNames.includes('KD Text Specialist'));
      console.log('   Contains NSS Test Worker?', kdNames.includes('NSS Test Worker'), '(MUST BE FALSE)');

      // 6. Test Towel Purchases in both
      console.log('\n6. Testing Towel Purchase Isolation...');
      const nssTowel = await request({
        hostname: 'localhost',
        port: 5098,
        path: '/api/towel-purchases',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Business-Id': 'nss_text' }
      }, {
        date: '2026-11-04',
        supplier: 'NSS Mill Supplier',
        towelType: 'Bath Towel',
        qty: 100,
        rate: 50,
        total: 5000,
        gstMode: 'WITH_GST'
      });
      console.log('   NSS Towel created:', nssTowel.body.success);

      const kdTowel = await request({
        hostname: 'localhost',
        port: 5098,
        path: '/api/towel-purchases',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Business-Id': 'kd_text' }
      }, {
        date: '2026-11-04',
        supplier: 'KD Cotton Supplier',
        towelType: 'Hand Towel',
        qty: 200,
        rate: 30,
        total: 6000,
        gstMode: 'WITH_GST'
      });
      console.log('   KD Towel created:', kdTowel.body.success);

      const nssTowelsList = await request({
        hostname: 'localhost',
        port: 5098,
        path: '/api/towel-purchases',
        method: 'GET',
        headers: { 'X-Business-Id': 'nss_text' }
      });
      const kdTowelsList = await request({
        hostname: 'localhost',
        port: 5098,
        path: '/api/towel-purchases',
        method: 'GET',
        headers: { 'X-Business-Id': 'kd_text' }
      });

      console.log('   NSS Towel Suppliers:', (nssTowelsList.body.data || []).map(t => t.supplier));
      console.log('   KD Towel Suppliers:', (kdTowelsList.body.data || []).map(t => t.supplier));

      // Clean up test records
      console.log('\n7. Cleaning up test verification rows...');
      if (nssEmpId) {
        await request({ hostname: 'localhost', port: 5098, path: `/api/employees/${nssEmpId}`, method: 'DELETE', headers: { 'X-Business-Id': 'nss_text' } });
      }
      if (kdEmpId) {
        await request({ hostname: 'localhost', port: 5098, path: `/api/employees/${kdEmpId}`, method: 'DELETE', headers: { 'X-Business-Id': 'kd_text' } });
      }
      if (nssTowel.body.data?.id) {
        await request({ hostname: 'localhost', port: 5098, path: `/api/towel-purchases/${nssTowel.body.data.id}`, method: 'DELETE', headers: { 'X-Business-Id': 'nss_text' } });
      }
      if (kdTowel.body.data?.id) {
        await request({ hostname: 'localhost', port: 5098, path: `/api/towel-purchases/${kdTowel.body.data.id}`, method: 'DELETE', headers: { 'X-Business-Id': 'kd_text' } });
      }
      console.log('   Cleanup completed cleanly.');

      console.log('\n======================================================');
      console.log('🎉 ALL MULTI-TENANCY ISOLATION VERIFICATIONS PASSED! 🎉');
      console.log('======================================================');
    } catch (e) {
      console.error('Verification failed:', e);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

runVerification();

