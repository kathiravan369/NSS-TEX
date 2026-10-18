import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  ChevronDown,
  ChevronRight,
  Layers,
  Zap,
  Users,
  CalendarDays,
  FileSpreadsheet,
  Cpu,
  DollarSign,
  Calendar,
  ShoppingCart,
  ShoppingBag,
  Receipt,
  TrendingUp,
  BarChart3,
  Settings,
  FileBarChart
} from 'lucide-react';

export default function Sidebar() {
  const location = useLocation();

  // Master sections
  const [purchasesOpen, setPurchasesOpen] = useState(true);
  const [salesGroupOpen, setSalesGroupOpen] = useState(true);

  // Sub-sections inside Purchases
  const [productionOpen, setProductionOpen] = useState(true);
  const [rawMaterialsOpen, setRawMaterialsOpen] = useState(true);
  const [salaryOpen, setSalaryOpen] = useState(true);

  // Sub-sections inside Sales
  const [salesSubOpen, setSalesSubOpen] = useState(true);
  const [reportsSubOpen, setReportsSubOpen] = useState(true);

  const isPurchasesRoute =
    location.pathname === '/' ||
    location.pathname.startsWith('/raw-materials') ||
    location.pathname.startsWith('/machinery-cost') ||
    location.pathname.startsWith('/electricity-cost') ||
    location.pathname.startsWith('/salary');

  const isSalesRoute =
    location.pathname.startsWith('/sales') ||
    location.pathname.startsWith('/reports');

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo-container">
          <img src="/logo.png" alt="NSS-TEX Logo" className="sidebar-logo-img" />
        </div>
        <div>
          <h1 className="sidebar-brand-title">NSS-TEX</h1>
          <p className="sidebar-brand-subtitle">Towels & Textiles ERP</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        {/* ======================================================== */}
        {/* MASTER SECTION 1: PURCHASES                             */}
        {/* Inside: Dashboard, Production, Salary                    */}
        {/* ======================================================== */}
        <button
          type="button"
          className={`nav-master-group ${isPurchasesRoute ? 'active' : ''}`}
          onClick={() => setPurchasesOpen(!purchasesOpen)}
        >
          <div className="nav-item-left">
            <ShoppingBag size={17} color={isPurchasesRoute ? '#60a5fa' : '#38bdf8'} />
            <span>Purchases</span>
          </div>
          {purchasesOpen ? <ChevronDown size={14} color="#94a3b8" /> : <ChevronRight size={14} color="#94a3b8" />}
        </button>

        {purchasesOpen && (
          <div className="master-submenu">
            {/* 1. Dashboard */}
            <NavLink
              to="/"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              end
            >
              <div className="nav-item-left">
                <LayoutDashboard size={16} />
                <span>Dashboard</span>
              </div>
            </NavLink>

            {/* 2. Production */}
            <button
              type="button"
              className="nav-item"
              onClick={() => setProductionOpen(!productionOpen)}
            >
              <div className="nav-item-left">
                <Boxes size={16} />
                <span>Production</span>
              </div>
              {productionOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {productionOpen && (
              <div className="submenu">
                {/* Nested: Raw Materials */}
                <button
                  type="button"
                  className="nav-item"
                  style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}
                  onClick={() => setRawMaterialsOpen(!rawMaterialsOpen)}
                >
                  <div className="nav-item-left">
                    <Layers size={14} />
                    <span>Raw Materials</span>
                  </div>
                  {rawMaterialsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>

                {rawMaterialsOpen && (
                  <div className="nested-submenu">
                    <NavLink
                      to="/raw-materials/thread-gst"
                      className={({ isActive }) => `nested-submenu-item ${isActive ? 'active' : ''}`}
                    >
                      › Thread — With GST
                    </NavLink>
                    <NavLink
                      to="/raw-materials/thread-no-gst"
                      className={({ isActive }) => `nested-submenu-item ${isActive ? 'active' : ''}`}
                    >
                      › Thread — Without GST
                    </NavLink>
                    <NavLink
                      to="/raw-materials/oil"
                      className={({ isActive }) => `nested-submenu-item ${isActive ? 'active' : ''}`}
                    >
                      › Oil
                    </NavLink>
                  </div>
                )}

                {/* Machinery Cost */}
                <NavLink
                  to="/machinery-cost"
                  className={({ isActive }) => `submenu-item ${isActive ? 'active' : ''}`}
                >
                  <Cpu size={14} />
                  <span>Machinery Cost</span>
                </NavLink>

                {/* Electricity Cost */}
                <NavLink
                  to="/electricity-cost"
                  className={({ isActive }) => `submenu-item ${isActive ? 'active' : ''}`}
                >
                  <Zap size={14} />
                  <span>Electricity Cost</span>
                </NavLink>
              </div>
            )}

            {/* 3. Salary */}
            <button
              type="button"
              className="nav-item"
              onClick={() => setSalaryOpen(!salaryOpen)}
            >
              <div className="nav-item-left">
                <DollarSign size={16} />
                <span>Salary</span>
              </div>
              {salaryOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {salaryOpen && (
              <div className="submenu">
                <NavLink
                  to="/salary/employees"
                  className={({ isActive }) => `submenu-item ${isActive ? 'active' : ''}`}
                >
                  <Users size={14} />
                  <span>Add Employee</span>
                </NavLink>
                <NavLink
                  to="/salary/weekly"
                  className={({ isActive }) => `submenu-item ${isActive ? 'active' : ''}`}
                >
                  <CalendarDays size={14} />
                  <span>Weekly Salary</span>
                </NavLink>
                <NavLink
                  to="/salary/weekly-report"
                  className={({ isActive }) => `submenu-item ${isActive ? 'active' : ''}`}
                >
                  <FileSpreadsheet size={14} />
                  <span>Weekly Report</span>
                </NavLink>
                <NavLink
                  to="/salary/reports"
                  className={({ isActive }) => `submenu-item ${isActive ? 'active' : ''}`}
                >
                  <Calendar size={14} />
                  <span>Monthly Report</span>
                </NavLink>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* MASTER SECTION 2: SALES                                 */}
        {/* Inside: Sales, Reports                                  */}
        {/* ======================================================== */}
        <button
          type="button"
          className={`nav-master-group ${isSalesRoute ? 'active' : ''}`}
          style={{ marginTop: '0.85rem' }}
          onClick={() => setSalesGroupOpen(!salesGroupOpen)}
        >
          <div className="nav-item-left">
            <TrendingUp size={17} color={isSalesRoute ? '#34d399' : '#10b981'} />
            <span>Sales</span>
          </div>
          {salesGroupOpen ? <ChevronDown size={14} color="#94a3b8" /> : <ChevronRight size={14} color="#94a3b8" />}
        </button>

        {salesGroupOpen && (
          <div className="master-submenu">
            {/* 1. Sales */}
            <button
              type="button"
              className="nav-item"
              onClick={() => setSalesSubOpen(!salesSubOpen)}
            >
              <div className="nav-item-left">
                <ShoppingCart size={16} />
                <span>Sales</span>
              </div>
              {salesSubOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {salesSubOpen && (
              <div className="submenu">
                <NavLink
                  to="/sales/customers"
                  className={({ isActive }) => `submenu-item ${isActive ? 'active' : ''}`}
                >
                  <Users size={14} />
                  <span>Customer Details</span>
                </NavLink>
                <NavLink
                  to="/sales/invoices"
                  className={({ isActive }) => `submenu-item ${isActive ? 'active' : ''}`}
                >
                  <Receipt size={14} />
                  <span>Invoice Details</span>
                </NavLink>
                <NavLink
                  to="/sales/reports"
                  className={({ isActive }) => `submenu-item ${isActive ? 'active' : ''}`}
                >
                  <BarChart3 size={14} />
                  <span>Sales Details</span>
                </NavLink>
              </div>
            )}

            {/* 2. Reports */}
            <button
              type="button"
              className="nav-item"
              onClick={() => setReportsSubOpen(!reportsSubOpen)}
            >
              <div className="nav-item-left">
                <FileBarChart size={16} />
                <span>Reports</span>
              </div>
              {reportsSubOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {reportsSubOpen && (
              <div className="submenu">
                <NavLink
                  to="/salary/reports"
                  className={({ isActive }) => `submenu-item ${isActive ? 'active' : ''}`}
                >
                  <Calendar size={14} />
                  <span>Salary Reports</span>
                </NavLink>
                <NavLink
                  to="/sales/reports"
                  className={({ isActive }) => `submenu-item ${isActive ? 'active' : ''}`}
                >
                  <TrendingUp size={14} />
                  <span>Sales Summary</span>
                </NavLink>
              </div>
            )}
          </div>
        )}

        {/* Divider & Settings */}
        <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <div className="nav-item-left">
              <Settings size={17} />
              <span>Settings</span>
            </div>
          </NavLink>
        </div>
      </nav>

      {/* User Footer Profile */}
      <div className="sidebar-footer">
        <div className="user-avatar">AD</div>
        <div className="user-info">
          <div className="user-name">Admin</div>
          <div className="user-role">admin@nsstowels.com</div>
        </div>
      </div>
    </aside>
  );
}
