import React from 'react';
import { Outlet } from 'react-router-dom';
import { useBusiness } from '../../context/BusinessContext';
import Sidebar from './Sidebar';
import TopNav from './TopNav';

export default function Layout() {
  const { selectedBusinessId } = useBusiness();

  return (
    <div className="app-container" key={selectedBusinessId || 'default'}>
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
