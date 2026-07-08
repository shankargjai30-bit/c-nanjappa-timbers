import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserCheck, 
  ScanFace, 
  Wallet, 
  Clock, 
  FileText, 
  Settings,
  LogOut
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import './Sidebar.css';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/employees', label: 'Employees', icon: Users },
  { path: '/attendance', label: 'Attendance', icon: UserCheck },
  { path: '/face-biometrics', label: 'Face Biometrics', icon: ScanFace },
  { path: '/payroll', label: 'Payroll', icon: Wallet },
  { path: '/ot-management', label: 'OT Management', icon: Clock },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();
  const { managerProfile, logout } = useApp();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-mark">
            <img src="/cn-logo.webp" className="sidebar-logo-img" alt="CN Logo" />
          </div>
          <div className="logo-text">
            <h2>TimberPro</h2>
            <span>ERP System</span>
          </div>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        <ul>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <li key={item.path}>
                <NavLink 
                  to={item.path} 
                  className={`nav-link ${isActive ? 'active' : ''}`}
                >
                  <Icon size={20} className="nav-icon" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="sidebar-footer">
        <div className="user-profile-mini">
          {managerProfile?.photoURL ? (
            <img src={managerProfile.photoURL} alt="Profile" className="avatar" style={{ border: 'none', objectFit: 'cover', padding: 0 }} />
          ) : (
            <div className="avatar">{(managerProfile?.displayName || 'Manager').charAt(0)}</div>
          )}
          <div className="user-info">
            <span className="user-name" style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {managerProfile?.displayName || 'Manager'}
            </span>
            <span className="user-role" style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {managerProfile?.email || 'manager@nanjappa.com'}
            </span>
          </div>
          <button 
            onClick={logout} 
            title="Logout" 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#64748b', 
              cursor: 'pointer', 
              padding: '8px', 
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
