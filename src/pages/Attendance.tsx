import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Calendar, UserCheck, UserX, Clock, Percent } from 'lucide-react';
import attendanceBg from '../assets/dashboard-backgrounds/attendance-bg.webp';
import './Attendance.css';

export default function Attendance() {
  const { employees } = useApp();
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('monthly');
  const [searchQuery, setSearchQuery] = useState('');

  const totalStaff = employees.length;
  const presentToday = employees.filter(e => e.status === 'Present' || e.status === 'Half Day').length;
  const absentToday = employees.filter(e => e.status === 'Absent').length;
  
  // Calculate average compliance
  const totalPresentDays = employees.reduce((sum, e) => sum + e.presentDays, 0);
  const totalPossibleDays = employees.reduce((sum, e) => sum + e.totalWorkingDays, 0);
  const averageCompliance = totalPossibleDays > 0 
    ? Math.round((totalPresentDays / totalPossibleDays) * 100) 
    : 100;

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="dashboard-bg-wrapper" style={{ backgroundImage: `url(${attendanceBg})` }}></div>
      <div className="dashboard-bg-overlay"></div>
      <div className="attendance-page" style={{ position: 'relative', zIndex: 1 }}>
        <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Management</h1>
          <p className="page-subtitle">Track daily logs and review monthly attendance sheets</p>
        </div>
        <div className="tab-buttons">
          <button 
            className={`tab-btn ${activeTab === 'monthly' ? 'active' : ''}`}
            onClick={() => setActiveTab('monthly')}
          >
            Monthly Summary
          </button>
          <button 
            className={`tab-btn ${activeTab === 'daily' ? 'active' : ''}`}
            onClick={() => setActiveTab('daily')}
          >
            Daily Check-ins
          </button>
        </div>
      </div>

      {/* Attendance Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon success"><UserCheck size={24} /></div>
          <div className="stat-info">
            <h3>Present Today</h3>
            <p className="stat-value">{presentToday} / {totalStaff}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon danger"><UserX size={24} /></div>
          <div className="stat-info">
            <h3>Absent / Leave</h3>
            <p className="stat-value">{absentToday}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon warning"><Clock size={24} /></div>
          <div className="stat-info">
            <h3>Half Days</h3>
            <p className="stat-value">{employees.filter(e => e.status === 'Half Day').length}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon primary"><Percent size={24} /></div>
          <div className="stat-info">
            <h3>Monthly Compliance</h3>
            <p className="stat-value">{averageCompliance}%</p>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="table-card card">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by name, ID or dept..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="date-badge">
            <Calendar size={16} />
            <span>May 2026</span>
          </div>
        </div>

        {activeTab === 'monthly' ? (
          /* Tab 1: Monthly Summary Report */
          <div className="table-responsive">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>ID</th>
                  <th>Department</th>
                  <th>Present Days</th>
                  <th>Absent Days</th>
                  <th>Total Work Days</th>
                  <th>Attendance Rate</th>
                  <th>Compliance</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => {
                  const rate = emp.totalWorkingDays > 0 ? Math.round((emp.presentDays / emp.totalWorkingDays) * 100) : 0;
                  let statusClass = 'high';
                  if (rate < 80) statusClass = 'low';
                  else if (rate < 90) statusClass = 'medium';

                  return (
                    <tr key={emp.id}>
                      <td>
                        <div className="employee-cell">
                          <div 
                            className="employee-avatar" 
                            style={{ backgroundColor: emp.avatarColor || 'var(--primary-light)' }}
                          >
                            {emp.name.charAt(0)}
                          </div>
                          <div className="employee-details">
                            <span className="employee-name">{emp.name}</span>
                            <span className="employee-role">{emp.role}</span>
                          </div>
                        </div>
                      </td>
                      <td><span className="text-muted font-medium">{emp.id}</span></td>
                      <td>{emp.department}</td>
                      <td><strong className="text-success">{emp.presentDays} days</strong></td>
                      <td><strong className="text-danger">{emp.absentDays} days</strong></td>
                      <td><span className="text-muted font-medium">{emp.totalWorkingDays} days</span></td>
                      <td>
                        <div className="progress-bar-wrapper">
                          <div className="progress-bar-container">
                            <div 
                              className={`progress-bar ${statusClass}`} 
                              style={{ width: `${rate}%` }}
                            ></div>
                          </div>
                          <span className="rate-text">{rate}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill compliance-pill ${statusClass}`}>
                          {rate >= 90 ? 'Excellent' : rate >= 80 ? 'Good' : 'Needs Review'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Tab 2: Daily Check-ins Log */
          <div className="table-responsive">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>ID</th>
                  <th>Department</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Verification</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id}>
                    <td>
                      <div className="employee-cell">
                        <div 
                          className="employee-avatar" 
                          style={{ backgroundColor: emp.avatarColor || 'var(--primary-light)' }}
                        >
                          {emp.name.charAt(0)}
                        </div>
                        <div className="employee-details">
                          <span className="employee-name">{emp.name}</span>
                          <span className="employee-role">{emp.role}</span>
                        </div>
                      </div>
                    </td>
                    <td><span className="text-muted font-medium">{emp.id}</span></td>
                    <td>{emp.department}</td>
                    <td>
                      <span className={`check-time check-in-time ${emp.status !== 'Absent' ? 'text-success' : 'text-muted'}`}>
                        {emp.checkIn}
                      </span>
                    </td>
                    <td>
                      <span className="check-time check-out-time text-muted">
                        {emp.checkOut}
                      </span>
                    </td>
                    <td>
                      {emp.verified ? (
                        <span className="badge badge-success">Face Verified</span>
                      ) : emp.status !== 'Absent' ? (
                        <span className="badge badge-warning">Manual Override</span>
                      ) : (
                        <span className="badge text-muted">--</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-pill ${emp.status.toLowerCase().replace(' ', '-')}`}>
                        {emp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
