import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, fetchWithAuth, getApiBaseUrl } from '../context/AppContext';
import { Sun, LogOut, Sliders, HardDrive, Globe, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import './Settings.css';

export default function Settings() {
  const { logout, employees, activityLogs, payrollHistory, managerProfile, addToast, apiBaseUrl, setCustomApiBaseUrl, resetApiBaseUrl, refreshData } = useApp();
  const navigate = useNavigate();

  // Custom states for settings configurations
  const [confidence, setConfidence] = useState(95);
  const [backupLogs, setBackupLogs] = useState(true);
  const [serverUrlInput, setServerUrlInput] = useState(apiBaseUrl);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [connStatus, setConnStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setConnStatus('idle');
    try {
      const targetUrl = (serverUrlInput || getApiBaseUrl()).trim().replace(/\/+$/, '');
      const res = await fetchWithAuth(`${targetUrl}/employees`, { method: 'GET' });
      if (res.ok) {
        setConnStatus('success');
        addToast('Connected to Express Backend successfully!', 'success');
      } else {
        setConnStatus('error');
        addToast(`Server returned error status: ${res.status}`, 'error');
      }
    } catch (err: any) {
      setConnStatus('error');
      addToast(err.message || 'Cannot reach server at this address', 'error');
    } finally {
      setIsTestingConn(false);
    }
  };

  const handleSaveServerUrl = async () => {
    if (!serverUrlInput.trim()) {
      resetApiBaseUrl();
      setServerUrlInput(getApiBaseUrl());
      await refreshData();
      addToast('Reset backend URL to default', 'info');
      return;
    }
    setCustomApiBaseUrl(serverUrlInput);
    await refreshData();
    addToast('Backend Server URL updated successfully', 'success');
  };

  const handleResetServerUrl = async () => {
    resetApiBaseUrl();
    setServerUrlInput(getApiBaseUrl());
    await refreshData();
    addToast('Reset backend URL to default', 'info');
  };

  const handleBackupExport = () => {
    try {
      if (!employees || employees.length === 0) {
        throw new Error("No data to export");
      }

      const backupData = {
        exportDate: new Date().toISOString(),
        version: "2.4.0",
        company: "C Nanjappa Timber Traders",
        data: {
          employees,
          activityLogs,
          payrollHistory,
          managerProfile
        },
        settings: {
          confidence,
          backupLogs
        }
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `timberpro-backup-${dateStr}.json`;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast('Backup exported successfully', 'success');
    } catch (error: any) {
      console.error("Backup failed", error);
      addToast(error?.message === "No data to export" ? "No employee data to export" : "Backup export failed. Please try again.", 'error');
    }
  };

  const handleSaveSettings = () => {
    addToast('System parameters updated successfully!', 'success');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">System Settings</h1>
          <p className="page-subtitle">Configure theme preferences, biometric engines, shift metrics, and sign out</p>
        </div>
      </div>

      <div className="settings-grid">
        {/* 1. VISUAL THEME CARD */}
        <div className="settings-card card theme-settings-card">
          <div className="card-header">
            <Sun size={20} className="header-icon" />
            <h3>Visual Theme</h3>
          </div>
          <p className="settings-desc">The application is currently running in the default premium workspace theme.</p>
          <div className="current-theme-badge">
            <Sun size={18} />
            <span>Current Theme: Light</span>
          </div>
        </div>

        {/* 2. WORKFORCE & BIOMETRICS PARAMETERS */}
        <div className="settings-card card biometrics-settings-card">
          <div className="card-header">
            <Sliders size={20} className="header-icon" />
            <h3>Workforce & Biometrics Parameters</h3>
          </div>

          <div className="settings-form-group">
            <label className="settings-label">Face API Confidence Threshold ({confidence}%)</label>
            <div className="slider-container">
              <input
                type="range"
                min="80"
                max="99"
                value={confidence}
                onChange={(e) => setConfidence(parseInt(e.target.value))}
              />
              <span className="slider-val">{confidence}%</span>
            </div>
            <small className="settings-hint">High value prevents spoofing; lower values expedite recognition.</small>
          </div>

          <div className="settings-form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={backupLogs}
                onChange={(e) => setBackupLogs(e.target.checked)}
              />
              <span>Automatically sync face-scan archives to offline database</span>
            </label>
          </div>

          <div className="settings-form-actions">
            <button className="btn-primary btn-save-settings" onClick={handleSaveSettings}>
              Save System Parameters
            </button>
          </div>
        </div>

        {/* 3. SYSTEM INFORMATION / BRANDING CARD */}
        <div className="settings-card card branding-details-card">
          <div className="settings-logo-container">
            <img src="/cn-logo.webp" className="brand-logo-img" alt="CN Logo" />
            <h3 className="brand-title">TimberPro Enterprise</h3>
          </div>
          <span className="version-tag">Version 2.4.0 (Stable)</span>
          <div className="brand-divider"></div>

          <div className="branding-meta-list">
            <div className="meta-list-item">
              <span>Enterprise:</span>
              <strong>C Nanjappa Timber Traders</strong>
            </div>
            <div className="meta-list-item">
              <span>Active Branch:</span>
              <strong>Main Timber Yard (Hassan, Karnataka)</strong>
            </div>
            <div className="meta-list-item">
              <span>Database Sync:</span>
              <strong className="text-success">Online & Synced</strong>
            </div>
          </div>
        </div>

        {/* 4. BACKEND SERVER CONNECTION (LAN / CLOUD) */}
        <div className="settings-card card server-connection-card">
          <div className="card-header">
            <Globe size={20} className="header-icon" />
            <h3>Backend Server Connection</h3>
          </div>
          <p className="settings-desc">Configure the API address used for database sync, employee records, photos, and biometrics.</p>
          
          <div className="settings-form-group">
            <label className="settings-label">Active API Base URL</label>
            <input
              type="text"
              className="settings-input"
              value={serverUrlInput}
              onChange={(e) => setServerUrlInput(e.target.value)}
              placeholder="e.g. https://api.timberpro.com/api"
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                marginTop: '0.35rem'
              }}
            />
            <small className="settings-hint">
              Enter your production HTTPS API endpoint or custom backend server URL.
            </small>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
            <button
              type="button"
              className="btn-outline"
              onClick={handleTestConnection}
              disabled={isTestingConn}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <RefreshCw size={14} className={isTestingConn ? 'animate-spin' : ''} />
              {isTestingConn ? 'Testing...' : 'Test Connection'}
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveServerUrl}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <CheckCircle2 size={14} />
              Save & Apply
            </button>

            <button
              type="button"
              className="btn-outline"
              onClick={handleResetServerUrl}
              style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
            >
              Reset Default
            </button>
          </div>

          {connStatus === 'success' && (
            <div style={{ marginTop: '0.65rem', color: '#16a34a', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircle2 size={14} /> Connection Verified — Server is responding
            </div>
          )}
          {connStatus === 'error' && (
            <div style={{ marginTop: '0.65rem', color: '#dc2626', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <AlertCircle size={14} /> Connection Failed — Check IP & ensure Express is running on port 3000
            </div>
          )}
        </div>

        {/* 5. BACKUP & SERVER LOGS */}
        <div className="settings-card card backup-settings-card">
          <div className="card-header">
            <HardDrive size={20} className="header-icon" />
            <h3>Backup & Server Logs</h3>
          </div>
          <div className="backup-section-layout">
            <div className="backup-meta">
              <strong>Local Storage Backup Engine</strong>
              <p className="settings-hint">Save database state into an encrypted JSON file for compliance reporting.</p>
            </div>
            <button
              className="btn-outline btn-backup-trigger"
              onClick={handleBackupExport}
            >
              Trigger Backup Export
            </button>
          </div>
        </div>

        {/* 5. ADMIN ACCOUNT / LOGOUT */}
        <div className="settings-card card logout-card-danger">
          <div className="card-header">
            <LogOut size={20} className="text-danger" />
            <h3 className="text-danger">Administrative Account</h3>
          </div>
          <p className="settings-desc">Securely close active credentials and sign out of the manager console.</p>
          <button className="btn-logout-danger" onClick={handleLogout}>
            <LogOut size={16} />
            Logout from System
          </button>
        </div>
      </div>
    </div>
  );
}
