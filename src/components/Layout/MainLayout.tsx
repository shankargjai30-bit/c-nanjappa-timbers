import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import ErrorBoundary from '../ErrorBoundary';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import './MainLayout.css';

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%', minHeight: '300px' }}>
    <div style={{ width: '30px', height: '30px', border: '3px solid #e2e8f0', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
  </div>
);

export default function MainLayout() {
  return (
    <div className="main-layout">
      <Sidebar />
      <div className="layout-content">
        <Topbar />
        <main className="page-container">
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
