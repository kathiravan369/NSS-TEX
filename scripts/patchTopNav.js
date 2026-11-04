const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/layout/TopNav.jsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\r\n/g, '\n');

// 1. Add imports
const target1 = `import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  ChevronRight,
  Home,
  User,
  Menu,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { storageService } from '../../services/storageService';`;

const replacement1 = `import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  ChevronRight,
  Home,
  User,
  Menu,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2,
  Database
} from 'lucide-react';
import { storageService } from '../../services/storageService';
import { useBusiness } from '../../context/BusinessContext';`;

if (!content.includes(target1)) {
  console.error('target1 not found in TopNav.jsx');
  process.exit(1);
}
content = content.replace(target1, replacement1);

// 2. Add state and hooks in TopNav()
const target2 = `export default function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isNotifOpen, setIsNotifOpen] = useState(false);`;

const replacement2 = `export default function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentBusiness, businesses, switchBusiness, openSelection } = useBusiness();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isBizMenuOpen, setIsBizMenuOpen] = useState(false);`;

if (!content.includes(target2)) {
  console.error('target2 not found in TopNav.jsx');
  process.exit(1);
}
content = content.replace(target2, replacement2);

// 3. Add Business Switcher before user profile pill
const target3 = `        {/* User Pill */}
        <div className="top-user-profile">`;

const replacement3 = `        {/* Business Switcher */}
        <div className="business-switcher-wrapper" style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsBizMenuOpen(!isBizMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '8px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              cursor: 'pointer',
              fontSize: '0.825rem',
              fontWeight: 600,
              color: '#0f172a',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #e2e8f0',
              overflow: 'hidden'
            }}>
              <img
                src={currentBusiness?.logo || './logo.png'}
                alt="Logo"
                style={{ width: '18px', height: '18px', objectFit: 'contain' }}
                onError={(e) => { e.currentTarget.src = './logo.png'; }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: 1.15 }}>
              <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500 }}>Current Business:</span>
              <span style={{ fontSize: '0.825rem', color: currentBusiness?.accentColor || '#2563eb', fontWeight: 700 }}>
                {currentBusiness?.name || 'NSS Text'}
              </span>
            </div>
            <span style={{
              fontSize: '0.65rem',
              padding: '0.15rem 0.45rem',
              borderRadius: '9999px',
              backgroundColor: '#ecfdf5',
              color: '#059669',
              border: '1px solid #a7f3d0',
              fontWeight: 600,
              marginLeft: '0.2rem'
            }}>
              Connected
            </span>
            <ChevronDown size={14} color="#64748b" />
          </button>

          {/* Business Switcher Dropdown */}
          {isBizMenuOpen && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 6px)',
              width: '270px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              padding: '0.5rem',
              zIndex: 1000
            }}>
              <div style={{
                padding: '0.4rem 0.6rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Switch Business
              </div>

              {businesses.map((b) => {
                const isSelected = b.id === currentBusiness?.id;
                return (
                  <div
                    key={b.id}
                    onClick={async () => {
                      setIsBizMenuOpen(false);
                      if (!isSelected) {
                        await switchBusiness(b.id);
                        await storageService.reloadAllCollections();
                        navigate('/');
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#f1f5f9' : 'transparent',
                      transition: 'background-color 0.15s ease',
                      marginBottom: '2px'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '3px'
                    }}>
                      <img
                        src={b.logo}
                        alt={b.name}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        onError={(e) => { e.currentTarget.src = './logo.png'; }}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                        {b.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        Database: {b.dbName}
                      </div>
                    </div>

                    {isSelected && (
                      <CheckCircle2 size={16} color="#16a34a" />
                    )}
                  </div>
                );
              })}

              <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '0.4rem 0' }} />

              <div
                onClick={() => {
                  setIsBizMenuOpen(false);
                  openSelection();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#2563eb',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Building2 size={15} />
                <span>Change Business (Select Screen)</span>
              </div>
            </div>
          )}
        </div>

        {/* User Pill */}
        <div className="top-user-profile">`;

if (!content.includes(target3)) {
  console.error('target3 not found in TopNav.jsx');
  process.exit(1);
}
content = content.replace(target3, replacement3);

fs.writeFileSync(filePath, content.replace(/\n/g, '\r\n'), 'utf8');
console.log('TopNav.jsx patched successfully!');

