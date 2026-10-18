import React, { useState, useEffect } from 'react';
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
import { storageService } from '../../services/storageService';
import { isOverdue, formatINR } from '../../utils/formatters';

export default function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [overdueSummary, setOverdueSummary] = useState({
    threadGST: [],
    threadNoGST: [],
    machinery: []
  });

  useEffect(() => {
    const checkOverdues = () => {
      const tg = storageService.getCollection('threadGST').filter(x => isOverdue(x));
      const tng = storageService.getCollection('threadNoGST').filter(x => isOverdue(x));
      const mach = storageService.getCollection('machinery').filter(x => isOverdue(x));
      setOverdueSummary({
        threadGST: tg,
        threadNoGST: tng,
        machinery: mach
      });
    };

    checkOverdues();
    const interval = setInterval(checkOverdues, 10000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  const totalOverdues =
    overdueSummary.threadGST.length +
    overdueSummary.threadNoGST.length +
    overdueSummary.machinery.length;

  // Helper to build breadcrumb segments
  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path === '/') return [{ label: 'Dashboard', path: '/' }];

    if (path === '/raw-materials/thread-gst') {
      return [
        { label: 'Production', path: '#' },
        { label: 'Raw Materials', path: '#' },
        { label: 'Thread (With GST)', path: '/raw-materials/thread-gst' }
      ];
    }
    if (path === '/raw-materials/thread-no-gst') {
      return [
        { label: 'Production', path: '#' },
        { label: 'Raw Materials', path: '#' },
        { label: 'Thread (Without GST)', path: '/raw-materials/thread-no-gst' }
      ];
    }
    if (path === '/raw-materials/oil') {
      return [
        { label: 'Production', path: '#' },
        { label: 'Raw Materials', path: '#' },
        { label: 'Oil', path: '/raw-materials/oil' }
      ];
    }
    if (path === '/machinery-cost') {
      return [
        { label: 'Production', path: '#' },
        { label: 'Machinery Cost', path: '/machinery-cost' }
      ];
    }
    if (path === '/electricity-cost') {
      return [
        { label: 'Production', path: '#' },
        { label: 'Electricity Cost', path: '/electricity-cost' }
      ];
    }
    if (path === '/salary/employees') {
      return [
        { label: 'Salary', path: '#' },
        { label: 'Employee Management', path: '/salary/employees' }
      ];
    }
    if (path === '/salary/weekly') {
      return [
        { label: 'Salary', path: '#' },
        { label: 'Weekly Salary', path: '/salary/weekly' }
      ];
    }
    if (path === '/salary/reports') {
      return [
        { label: 'Salary', path: '#' },
        { label: 'Salary Reports', path: '/salary/reports' }
      ];
    }
    if (path === '/sales/customers') {
      return [
        { label: 'Sales', path: '#' },
        { label: 'Customer Details', path: '/sales/customers' }
      ];
    }
    if (path === '/sales/invoices/new') {
      return [
        { label: 'Sales', path: '#' },
        { label: 'Invoice Details', path: '/sales/invoices' },
        { label: 'Create Invoice', path: '/sales/invoices/new' }
      ];
    }
    if (path.startsWith('/sales/invoices/') && path.includes('/edit')) {
      return [
        { label: 'Sales', path: '#' },
        { label: 'Invoice Details', path: '/sales/invoices' },
        { label: 'Edit Invoice', path: '#' }
      ];
    }
    if (path.startsWith('/sales/invoices/') && path !== '/sales/invoices') {
      return [
        { label: 'Sales', path: '#' },
        { label: 'Invoice Details', path: '/sales/invoices' },
        { label: 'View Invoice', path: '#' }
      ];
    }
    if (path === '/sales/invoices') {
      return [
        { label: 'Sales', path: '#' },
        { label: 'Invoice Details', path: '/sales/invoices' }
      ];
    }
    if (path === '/sales/reports' || path === '/sales/details') {
      return [
        { label: 'Sales', path: '#' },
        { label: 'Sales Details', path: '/sales/reports' }
      ];
    }

    return [{ label: 'Dashboard', path: '/' }];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="top-nav">
      {/* Breadcrumb Navigation */}
      <div className="top-nav-left">
        <button type="button" className="icon-button" title="Menu Toggle">
          <Menu size={18} />
        </button>
        <div className="breadcrumbs">
          <Link to="/" style={{ color: 'inherit', display: 'flex', alignItems: 'center' }}>
            <Home size={15} />
          </Link>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.label}>
              <ChevronRight size={13} style={{ opacity: 0.5 }} />
              {idx === breadcrumbs.length - 1 ? (
                <span className="current">{crumb.label}</span>
              ) : (
                <span>{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Search, Notifications, Admin Profile */}
      <div className="top-nav-right">
        {/* Global Search Input */}
        <div className="search-box">
          <Search size={15} />
          <input type="text" placeholder="Search anything..." />
          <span className="shortcut-badge">Ctrl + K</span>
        </div>

        {/* Notifications */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="icon-button"
            title="Notifications"
            onClick={() => setIsNotifOpen(prev => !prev)}
            style={{
              backgroundColor: totalOverdues > 0 ? '#fff1f2' : undefined,
              borderColor: totalOverdues > 0 ? '#fecdd3' : undefined
            }}
          >
            <Bell size={18} color={totalOverdues > 0 ? '#e11d48' : 'currentColor'} />
            {totalOverdues > 0 && (
              <span
                className="badge-counter"
                style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
              >
                {totalOverdues}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {isNotifOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '320px',
                backgroundColor: '#ffffff',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                border: '1px solid var(--border-color)',
                zIndex: 1000,
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: '0.5rem',
                  borderBottom: '1px solid var(--border-color)'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                  Notifications & Alerts
                </div>
                {totalOverdues > 0 ? (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor: '#fee2e2',
                      color: '#b91c1c',
                      padding: '2px 8px',
                      borderRadius: '9999px'
                    }}
                  >
                    {totalOverdues} Overdue
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: '#16a34a',
                      fontWeight: 600
                    }}
                  >
                    All Clear
                  </span>
                )}
              </div>

              {totalOverdues > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {overdueSummary.threadGST.length > 0 && (
                    <div
                      onClick={() => {
                        setIsNotifOpen(false);
                        navigate('/raw-materials/thread-gst');
                      }}
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: '#fff1f2',
                        border: '1px solid #fecdd3',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#be123c', fontWeight: 600, fontSize: '0.8rem' }}>
                        <AlertTriangle size={14} /> Thread (With GST)
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#881337', marginTop: '2px' }}>
                        {overdueSummary.threadGST.length} purchase(s) have passed the 45-day due date.
                      </div>
                    </div>
                  )}

                  {overdueSummary.threadNoGST.length > 0 && (
                    <div
                      onClick={() => {
                        setIsNotifOpen(false);
                        navigate('/raw-materials/thread-no-gst');
                      }}
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: '#fff1f2',
                        border: '1px solid #fecdd3',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#be123c', fontWeight: 600, fontSize: '0.8rem' }}>
                        <AlertTriangle size={14} /> Thread (Without GST)
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#881337', marginTop: '2px' }}>
                        {overdueSummary.threadNoGST.length} purchase(s) have passed the 45-day due date.
                      </div>
                    </div>
                  )}

                  {overdueSummary.machinery.length > 0 && (
                    <div
                      onClick={() => {
                        setIsNotifOpen(false);
                        navigate('/machinery-cost');
                      }}
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: '#fff1f2',
                        border: '1px solid #fecdd3',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#be123c', fontWeight: 600, fontSize: '0.8rem' }}>
                        <AlertTriangle size={14} /> Machinery Cost
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#881337', marginTop: '2px' }}>
                        {overdueSummary.machinery.length} expense(s) have passed the 45-day due date.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                  <CheckCircle2 size={24} color="#16a34a" style={{ margin: '0 auto 0.4rem' }} />
                  <div>No pending overdue payments!</div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>All 45-day supplier dues are on schedule.</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Pill */}
        <div className="top-user-profile">
          <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '0.75rem' }}>
            AD
          </div>
          <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main)' }}>Admin</span>
          <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
        </div>
      </div>
    </header>
  );
}

