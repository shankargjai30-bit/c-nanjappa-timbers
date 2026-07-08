import { useState, useRef, useEffect } from 'react';
import { Bell, Search, CheckCircle, AlertCircle, Info, Clock, Check, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import './Topbar.css';

const formatTimeAgo = (timestamp: number) => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} mins ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
};

export default function Topbar() {
  const { activityLogs, markAllLogsRead, clearLogs } = useApp();
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = activityLogs.filter(log => !log.read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  const getIcon = (type: string) => {
    if (type === 'success') return <CheckCircle size={16} className="text-success" />;
    if (type === 'warning') return <AlertCircle size={16} className="text-warning" />;
    return <Info size={16} className="text-primary" />;
  };

  return (
    <header className="topbar">
      <div className="topbar-search">
        <Search size={18} className="search-icon" />
        <input type="text" placeholder="Search employees, reports, etc..." />
      </div>
      
      <div className="topbar-actions">
        <div className="notification-wrapper" ref={dropdownRef}>
          <button className="icon-btn" onClick={toggleNotifications}>
            <Bell size={20} />
            {unreadCount > 0 && <span className="badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>

          {showNotifications && (
            <div className="notification-dropdown slide-down-animation">
              <div className="notification-header">
                <h3>Notifications {unreadCount > 0 && <span className="count-badge">{unreadCount} New</span>}</h3>
                <div className="notification-actions">
                  <button onClick={markAllLogsRead} className="action-link" title="Mark all as read">
                    <Check size={16} />
                  </button>
                  <button onClick={clearLogs} className="action-link text-danger" title="Clear all">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="notification-body">
                {activityLogs.length === 0 ? (
                  <div className="empty-notifications">
                    <Bell size={24} className="text-muted" />
                    <p>No recent activity</p>
                  </div>
                ) : (
                  <div className="notification-list">
                    {activityLogs.map((log) => (
                      <div key={log.id} className={`notification-item ${!log.read ? 'unread' : ''}`}>
                        <div className="notification-icon-wrapper">
                          {getIcon(log.type)}
                        </div>
                        <div className="notification-content">
                          <p><strong>{log.employeeName}</strong> {log.action}</p>
                          <span className="notification-time">
                            <Clock size={12} />
                            {formatTimeAgo(log.timestamp)}
                          </span>
                        </div>
                        {!log.read && <div className="unread-dot"></div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="notification-footer">
                <button className="view-all-btn">View All Activity</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
