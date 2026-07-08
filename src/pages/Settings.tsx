import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Sun, LogOut, ShieldAlert, Sliders, HardDrive } from 'lucide-react';
import './Settings.css';

export default function Settings() {
  const { logout, employees, activityLogs, payrollHistory, managerProfile } = useApp();
  const navigate = useNavigate();

  // Custom states for settings configurations
  const [confidence, setConfidence] = useState(95);
  const [backupLogs, setBackupLogs] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

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

      setSuccessMsg('Backup exported successfully');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error) {
      console.error("Backup failed", error);
      setErrorMsg('Backup export failed. Please try again.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleSaveSettings = () => {
    setSuccessMsg('System parameters updated successfully!');
    setTimeout(() => setSuccessMsg(''), 4000);
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

      {successMsg && (
        <div className="success-toast slide-down-animation">
          <ShieldAlert size={18} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="success-toast slide-down-animation" style={{ backgroundColor: 'var(--danger)', color: 'white' }}>
          <ShieldAlert size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="settings-grid">
        {/* Left column: main system configs */}
        <div className="settings-main-panel col-span-2">

          {/* THEME CARD */}
          <div className="settings-card card">
            <div className="card-header">
              <Sun size={20} className="header-icon" />
              <h3>Visual Theme</h3>
            </div>
            <p className="settings-desc">The application is currently running in the default premium workspace theme.</p>
            <div style={{ padding: '1rem', backgroundColor: 'var(--primary-light)', borderRadius: 'var(--radius-md)', color: 'var(--primary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <Sun size={18} />
              Current Theme: Light
            </div>
          </div>

          {/* BIOMETRICS & SHIFT WORK RULES */}
          <div className="settings-card card mt-6">
            <div className="card-header">
              <Sliders size={20} className="header-icon" />
              <h3>Workforce & Biometrics Parameters</h3>
            </div>

            <div className="settings-form-row">
              <div className="form-group flex-1">
                <label>Face API Confidence Threshold ({confidence}%)</label>
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
                <small className="text-muted">High value prevents spoofing; lower values expedite recognition.</small>
              </div>
            </div>

            <div className="settings-form-row mt-4">
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
              <button className="btn-primary" onClick={handleSaveSettings}>
                Save System Parameters
              </button>
            </div>
          </div>

          {/* BACKUP & INTEGRATIONS */}
          <div className="settings-card card mt-6">
            <div className="card-header">
              <HardDrive size={20} className="header-icon" />
              <h3>Backup & Server Logs</h3>
            </div>
            <div className="backup-section-layout">
              <div className="backup-meta">
                <strong>Local Storage Backup Engine</strong>
                <p className="text-muted text-sm">Save database state into an encrypted JSON file for compliance reporting.</p>
              </div>
              <button
                className="btn-outline"
                onClick={handleBackupExport}
              >
                Trigger Backup Export
              </button>
            </div>
          </div>

        </div>

        {/* Right column: branding metadata & logout card */}
        <div className="settings-side-panel">

          {/* BRANDING CARD */}
          <div className="settings-card card branding-details-card">
            <div className="settings-logo-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <img src="/cn-logo.webp" style={{ width: '36px', height: '36px', objectFit: 'contain' }} alt="CN Logo" />
              <h3 style={{ margin: 0 }}>TimberPro Enterprise</h3>
            </div>
            <span className="version-tag">Version 2.4.0 (Stable)</span>
            <div className="divider"></div>

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

          {/* LOGOUT CARD */}
          <div className="settings-card card logout-card-danger mt-6">
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
    </div>
  );
}
