import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppContextProvider, useApp } from './context/AppContext';
import MainLayout from './components/Layout/MainLayout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Employees = lazy(() => import('./pages/Employees'));
const FaceBiometrics = lazy(() => import('./pages/FaceBiometrics'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Payroll = lazy(() => import('./pages/Payroll'));
const OTManagement = lazy(() => import('./pages/OTManagement'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, authLoading, managerProfile } = useApp();
  
  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc', color: '#1e293b' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 500 }}>Authenticating Manager Session...</h2>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated || !managerProfile) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const GlobalToasts = () => {
  const { toasts, removeToast } = useApp();
  if (!toasts || toasts.length === 0) return null;
  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: '12px 20px', 
          borderRadius: '8px', 
          background: t.type === 'error' ? '#fee2e2' : t.type === 'success' ? '#dcfce7' : t.type === 'warning' ? '#fef3c7' : '#e0e7ff',
          color: t.type === 'error' ? '#991b1b' : t.type === 'success' ? '#166534' : t.type === 'warning' ? '#92400e' : '#3730a3',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minWidth: '250px',
          fontWeight: 500
        }}>
          <span>{t.message}</span>
          <button onClick={() => removeToast(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'inherit', opacity: 0.7, padding: '0 0 0 15px' }}>&times;</button>
        </div>
      ))}
    </div>
  );
};

function App() {
  return (
    <AppContextProvider>
      <GlobalToasts />
      <Router>
        <Routes>
          <Route path="/login" element={
            <Suspense fallback={
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              </div>
            }>
              <Login />
            </Suspense>
          } />
          
          <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="employees" element={<Employees />} />
            <Route path="face-biometrics" element={<FaceBiometrics />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="ot-management" element={<OTManagement />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </Router>
    </AppContextProvider>
  );
}

export default App;

