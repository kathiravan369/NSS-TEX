import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Layers,
  CircleGauge,
  Zap,
  Users,
  CalendarDays,
  FileSpreadsheet,
  Cpu,
  Package2,
  DollarSign
} from 'lucide-react';

export default function Sidebar() {
  const location = useLocation();
  const [productionOpen, setProductionOpen] = useState(true);
  const [rawMaterialsOpen, setRawMaterialsOpen] = useState(true);
  const [salaryOpen, setSalaryOpen] = useState(true);

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
        {/* Dashboard */}
        <NavLink
          to="/"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          end
        >
          <div className="nav-item-left">
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </div>
        </NavLink>

        {/* Section: Production */}
        <button
          type="button"
          className="nav-item"
          onClick={() => setProductionOpen(!productionOpen)}
        >
          <div className="nav-item-left">
            <Boxes size={18} />
            <span>Production</span>
          </div>
          {productionOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
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
                <Layers size={15} />
                <span>Raw Materials</span>
              </div>
              {rawMaterialsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
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
              <Cpu size={15} />
              <span>Machinery Cost</span>
            </NavLink>

            {/* Electricity Cost */}
            <NavLink
              to="/electricity-cost"
              className={({ isActive }) => `submenu-item ${isActive ? 'active' : ''}`}
            >
              <Zap size={15} />
              <span>Electricity Cost</span>
            </NavLink>
          </div>
        )}

        {/* Section: Salary */}
        <button
          type="button"
          className="nav-item"
          onClick={() => setSalaryOpen(!salaryOpen)}
        >
          <div className="nav-item-left">
            <DollarSign size={18} />
            <span>Salary</span>
          </div>
          {salaryOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>

        {salaryOpen && (
          <div className="submenu">
            <NavLink
              to="/salary/employees"
              className={({ isActive }) => `submenu-item ${isActive ? 'active' : ''}`}
            >
              <Users size={15} />
              <span>Employee Management</span>
            </NavLink>
            <NavLink
              to="/salary/weekly"
              className={({ isActive }) => `submenu-item ${isActive ? 'active' : ''}`}
            >
              <CalendarDays size={15} />
              <span>Weekly Salary</span>
            </NavLink>
            <NavLink
              to="/salary/reports"
              className={({ isActive }) => `submenu-item ${isActive ? 'active' : ''}`}
            >
              <FileSpreadsheet size={15} />
              <span>Salary Reports</span>
            </NavLink>
          </div>
        )}
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
