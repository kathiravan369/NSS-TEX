const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/services/api.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add X-Business-Id in request()
const target1 = `  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {})
  };`;

const replacement1 = `  let currentBusinessId = 'nss_text';
  try {
    if (typeof window !== 'undefined') {
      currentBusinessId =
        window.sessionStorage?.getItem('nss_active_business_id') ||
        window.localStorage?.getItem('nss_last_business_id') ||
        'nss_text';
    }
  } catch (e) {}

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Business-Id': currentBusinessId,
    ...(options.headers || {})
  };`;

// normalize CRLF
content = content.replace(/\r\n/g, '\n');
if (!content.includes(target1)) {
  console.error('Target 1 not found!');
  process.exit(1);
}
content = content.replace(target1, replacement1);

// 2. Add businesses endpoint
const target2 = `export const api = {
  baseURL: API_BASE_URL,

  // 1. Dashboard Endpoints`;

const replacement2 = `export const api = {
  baseURL: API_BASE_URL,

  // 0. Multi-Business Endpoints
  businesses: {
    getAll() {
      return request('/businesses');
    },
    select(businessId) {
      return request('/businesses/select', {
        method: 'POST',
        body: JSON.stringify({ businessId })
      });
    }
  },

  // 1. Dashboard Endpoints`;

if (!content.includes(target2)) {
  console.error('Target 2 not found!');
  process.exit(1);
}
content = content.replace(target2, replacement2);

fs.writeFileSync(filePath, content.replace(/\n/g, '\r\n'), 'utf8');
console.log('src/services/api.js patched successfully!');
