const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/services/storageService.js');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\r\n/g, '\n');

const target1 = `function getStorage(key, fallback = []) {
  try {
    const item = localStorage.getItem(\`nsstowels_\${key}\`);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
}

function setStorage(key, val) {
  try {
    localStorage.setItem(\`nsstowels_\${key}\`, JSON.stringify(val));
  } catch (e) {
    console.error('Storage save error:', e);
  }
}`;

const replacement1 = `export function getActiveBusinessPrefix() {
  try {
    if (typeof window !== 'undefined') {
      const biz =
        window.sessionStorage?.getItem('nss_active_business_id') ||
        window.localStorage?.getItem('nss_last_business_id') ||
        'nss_text';
      return \`nsstowels_\${biz}\`;
    }
  } catch (e) {}
  return 'nsstowels_nss_text';
}

function getStorage(key, fallback = []) {
  try {
    const prefix = getActiveBusinessPrefix();
    const item = localStorage.getItem(\`\${prefix}_\${key}\`);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
}

function setStorage(key, val) {
  try {
    const prefix = getActiveBusinessPrefix();
    localStorage.setItem(\`\${prefix}_\${key}\`, JSON.stringify(val));
  } catch (e) {
    console.error('Storage save error:', e);
  }
}`;

if (!content.includes(target1)) {
  console.error('target1 not found in storageService.js!');
  process.exit(1);
}
content = content.replace(target1, replacement1);

// Add reloadAllCollections to storageService object
const target2 = `  // Async Live Fetchers for direct DB & API population
  async fetchLiveCollection(key, params = {}) {`;

const replacement2 = `  // Reload all active business collections from PostgreSQL DB
  async reloadAllCollections() {
    const keys = [
      'threadGST',
      'threadNoGST',
      'towelGST',
      'towelNoGST',
      'oil',
      'machinery',
      'electricity',
      'employees',
      'weeklyPayroll',
      'customers',
      'invoices'
    ];
    await Promise.allSettled(keys.map(k => this.fetchLiveCollection(k)));
    return true;
  },

  // Async Live Fetchers for direct DB & API population
  async fetchLiveCollection(key, params = {}) {`;

if (!content.includes(target2)) {
  console.error('target2 not found in storageService.js!');
  process.exit(1);
}
content = content.replace(target2, replacement2);

fs.writeFileSync(filePath, content.replace(/\n/g, '\r\n'), 'utf8');
console.log('src/services/storageService.js patched successfully!');

