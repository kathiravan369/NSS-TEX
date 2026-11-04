const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/layout/Sidebar.jsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\r\n/g, '\n');

// 1. Add useBusiness import
const target1 = `import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import logoImg from '../../assets/logo.png';`;

const replacement1 = `import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import logoImg from '../../assets/logo.png';
import { useBusiness } from '../../context/BusinessContext';`;

if (!content.includes(target1)) {
  console.error('target1 not found in Sidebar.jsx');
  process.exit(1);
}
content = content.replace(target1, replacement1);

// 2. Add useBusiness hook and dynamic brand
const target2 = `export default function Sidebar() {
  const location = useLocation();`;

const replacement2 = `export default function Sidebar() {
  const location = useLocation();
  const { currentBusiness, openSelection } = useBusiness();

  const brandName = currentBusiness ? currentBusiness.name : 'NSS Text';
  const brandSub = currentBusiness ? currentBusiness.subtitle : 'Towels & Textiles ERP';
  const brandLogo = currentBusiness ? currentBusiness.logo : logoImg;
  const brandFallback = currentBusiness ? currentBusiness.fallbackLogo : './logo.png';`;

if (!content.includes(target2)) {
  console.error('target2 not found in Sidebar.jsx');
  process.exit(1);
}
content = content.replace(target2, replacement2);

// 3. Update Brand Header
const target3 = `      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo-container">
          <img
            src={logoImg}
            alt="NSS-TEX Logo"
            className="sidebar-logo-img"
            onError={(e) => {
              if (!e.currentTarget.src.endsWith('logo.png')) {
                e.currentTarget.src = './logo.png';
              }
            }}
          />
        </div>
        <div>
          <h1 className="sidebar-brand-title">NSS-TEX</h1>
          <p className="sidebar-brand-subtitle">Towels & Textiles ERP</p>
        </div>
      </div>`;

const replacement3 = `      {/* Brand Header */}
      <div className="sidebar-header" style={{ position: 'relative' }}>
        <div className="sidebar-logo-container">
          <img
            src={brandLogo}
            alt={\`\${brandName} Logo\`}
            className="sidebar-logo-img"
            onError={(e) => {
              if (brandFallback && e.currentTarget.src !== brandFallback) {
                e.currentTarget.src = brandFallback;
              }
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="sidebar-brand-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {brandName}
          </h1>
          <p className="sidebar-brand-subtitle" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {brandSub}
          </p>
        </div>
      </div>`;

if (!content.includes(target3)) {
  console.error('target3 not found in Sidebar.jsx');
  process.exit(1);
}
content = content.replace(target3, replacement3);

fs.writeFileSync(filePath, content.replace(/\n/g, '\r\n'), 'utf8');
console.log('Sidebar.jsx patched successfully!');
