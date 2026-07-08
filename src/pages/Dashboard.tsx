import { Users, UserCheck, UserX, Clock, Wallet, ScanFace } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useApp } from '../context/AppContext';
import dashboardBg from '../assets/dashboard-backgrounds/elephant-log.webp';
import './Dashboard.css';

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

const attendanceData = [
  { name: 'Mon', present: 4, absent: 1 },
  { name: 'Tue', present: 4, absent: 1 },
  { name: 'Wed', present: 5, absent: 0 },
  { name: 'Thu', present: 4, absent: 1 },
  { name: 'Fri', present: 5, absent: 0 },
  { name: 'Sat', present: 3, absent: 2 },
];

const biometricsData = [
  { time: '08:00', success: 2 },
  { time: '09:00', success: 3 },
  { time: '10:00', success: 0 },
  { time: '11:00', success: 0 },
  { time: '12:00', success: 0 },
];

export default function Dashboard() {
  const { employees, activityLogs, dailyPayrollHistory, otHistory } = useApp();

  const totalStaff = employees.length;
  const presentToday = employees.filter(e => e.status === 'Present' || e.status === 'Half Day').length;
  const absentToday = employees.filter(e => e.status === 'Absent').length;
  const faceScansCount = employees.filter(e => e.verified).length;

  const todayStr = new Date().toISOString().split('T')[0];
  const thisMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  
  const todaysRecords = (dailyPayrollHistory || []).filter(r => r.date === todayStr);
  const thisMonthRecords = (dailyPayrollHistory || []).filter(r => r.date.startsWith(thisMonthStr));

  const todaysPayrollAmount = todaysRecords.reduce((sum, r) => sum + r.finalAmount, 0);
  const monthlyPayrollAmount = thisMonthRecords.reduce((sum, r) => sum + r.finalAmount, 0);
  const employeesPaidToday = todaysRecords.length;
  const pendingPayrollEntries = presentToday > employeesPaidToday ? presentToday - employeesPaidToday : 0;

  // OT calculations
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentMonthName = `${monthNames[new Date().getMonth()]} ${new Date().getFullYear()}`;
  
  const monthlyOTAmount = (otHistory || [])
    .filter(r => r.month === currentMonthName && r.status === 'Approved')
    .reduce((sum, r) => sum + r.finalAmount, 0);

  const pendingOTApprovals = (otHistory || [])
    .filter(r => r.status === 'Draft')
    .length;

  return (
    <>
      <div className="dashboard-bg-wrapper" style={{ backgroundImage: `url(${dashboardBg})`, backgroundPosition: 'center center' }}></div>
      <div className="dashboard-bg-overlay"></div>
      <div className="dashboard-page">
        <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Overview</h1>
          <p className="page-subtitle">Welcome back to TimberPro ERP</p>
        </div>
        <div className="date-picker-mock">
          Today: {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon primary"><Users size={24} /></div>
          <div className="stat-info">
            <h3>Total Staff</h3>
            <p className="stat-value">{totalStaff}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon success"><UserCheck size={24} /></div>
          <div className="stat-info">
            <h3>Present Today</h3>
            <p className="stat-value">{presentToday}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon danger"><UserX size={24} /></div>
          <div className="stat-info">
            <h3>Absent</h3>
            <p className="stat-value">{absentToday}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon secondary"><ScanFace size={24} /></div>
          <div className="stat-info">
            <h3>Face Scans</h3>
            <p className="stat-value">{faceScansCount}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon warning"><Wallet size={24} /></div>
          <div className="stat-info">
            <h3>Today's Payroll</h3>
            <p className="stat-value">₹{todaysPayrollAmount.toLocaleString('en-IN')}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon primary"><Wallet size={24} /></div>
          <div className="stat-info">
            <h3>Monthly Payroll</h3>
            <p className="stat-value">₹{monthlyPayrollAmount.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon success"><UserCheck size={24} /></div>
          <div className="stat-info">
            <h3>Paid Today</h3>
            <p className="stat-value">{employeesPaidToday}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon danger"><Clock size={24} /></div>
          <div className="stat-info">
            <h3>Pending Payroll</h3>
            <p className="stat-value">{pendingPayrollEntries}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon primary"><Wallet size={24} /></div>
          <div className="stat-info">
            <h3>Monthly OT Amount</h3>
            <p className="stat-value">₹{monthlyOTAmount.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon warning"><Clock size={24} /></div>
          <div className="stat-info">
            <h3>Pending OT Approvals</h3>
            <p className="stat-value">{pendingOTApprovals}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-content-grid">
        <div className="chart-card card col-span-2">
          <div className="card-header">
            <h3>Weekly Attendance</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: 'var(--surface-hover)'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)'}} />
                <Bar dataKey="present" stackId="a" fill="var(--primary)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="absent" stackId="a" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="activity-panel card">
          <div className="card-header">
            <h3>Recent Activity</h3>
          </div>
          <div className="activity-list">
            {activityLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="activity-item">
                <div className={`activity-indicator ${log.type}`}></div>
                <div className="activity-details">
                  <p><strong>{log.employeeName}</strong> {log.action}</p>
                  <span>{formatTimeAgo(log.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card card col-span-2">
          <div className="card-header">
            <h3>Biometric Scan Density</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={biometricsData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)'}} />
                <Line type="monotone" dataKey="success" stroke="var(--secondary)" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
