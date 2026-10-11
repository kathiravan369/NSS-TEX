import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNav from './TopNav';

export default function Layout() {
  return (
    <div className="app-container">
      {/* Fixed Dark Navy Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <TopNav />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
