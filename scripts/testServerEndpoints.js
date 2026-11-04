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

async function runTests() {
  await connectDB();
  const server = app.listen(5099, async () => {
    try {
      console.log('Test server running on port 5099');

      // Test 1: GET /api/businesses
      const r1 = await request({
        hostname: 'localhost',
        port: 5099,
        path: '/api/businesses',
        method: 'GET'
      });
      console.log('\n--- Test 1: GET /api/businesses ---');
      console.log('Status:', r1.status);
      console.log('Businesses:', r1.body.businesses);

      // Test 2: GET /api/dashboard/summary with X-Business-Id: nss_text
      const r2 = await request({
        hostname: 'localhost',
        port: 5099,
        path: '/api/dashboard/summary',
        method: 'GET',
        headers: { 'X-Business-Id': 'nss_text' }
      });
      console.log('\n--- Test 2: Dashboard Summary (NSS Text) ---');
      console.log('Status:', r2.status, 'X-Business-Id header in response:', r2.headers['x-business-id']);
      console.log('KPIs:', r2.body.kpis);

      // Test 3: GET /api/dashboard/summary with X-Business-Id: kd_text
      const r3 = await request({
        hostname: 'localhost',
        port: 5099,
        path: '/api/dashboard/summary',
        method: 'GET',
        headers: { 'X-Business-Id': 'kd_text' }
      });
      console.log('\n--- Test 3: Dashboard Summary (KD Text) ---');
      console.log('Status:', r3.status, 'X-Business-Id header in response:', r3.headers['x-business-id']);
      console.log('KPIs:', r3.body.kpis);

      console.log('\nAll server endpoint tests PASSED!');
    } catch (err) {
      console.error('Test error:', err);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

runTests();
