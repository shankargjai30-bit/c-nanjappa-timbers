import { useState, useEffect, useMemo } from 'react';
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

export default function Dashboard() {
  const { employees, activityLogs, dailyPayrollHistory, otHistory, getAttendanceByMonth } = useApp();

  // IST Timezone calculations
  const getISTDateString = () => {
    const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    return formatter.format(new Date());
  };

  const getISTMonthString = () => {
    const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' } as const;
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    return formatter.format(new Date()); // YYYY-MM
  };

  const getISTMonthName = () => {
    const options = { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' } as const;
    const formatter = new Intl.DateTimeFormat('en-US', options);
    return formatter.format(new Date()); // e.g. "August 2026"
  };

  const todayStr = useMemo(() => getISTDateString(), []);
  const thisMonthStr = useMemo(() => getISTMonthString(), []);
  const currentMonthName = useMemo(() => getISTMonthName(), []);

  const totalStaff = employees.length;
  const presentToday = employees.filter(e => e.status === 'Present' || e.status === 'Half Day').length;
  const absentToday = employees.filter(e => e.status === 'Absent').length;
  const faceScansCount = employees.filter(e => e.verified).length;

  const todaysRecords = (dailyPayrollHistory || []).filter(r => r.date === todayStr);
  const thisMonthRecords = (dailyPayrollHistory || []).filter(r => r.date.startsWith(thisMonthStr));

  const todaysPayrollAmount = todaysRecords.reduce((sum, r) => sum + r.finalAmount, 0);
  const monthlyPayrollAmount = thisMonthRecords.reduce((sum, r) => sum + r.finalAmount, 0);
  const employeesPaidToday = todaysRecords.length;
  const pendingPayrollEntries = presentToday > employeesPaidToday ? presentToday - employeesPaidToday : 0;

  const monthlyOTAmount = (otHistory || [])
    .filter(r => r.month === currentMonthName && (r.status === 'Approved' || r.status === 'Paid'))
    .reduce((sum, r) => sum + r.finalAmount, 0);

  const pendingOTApprovals = (otHistory || [])
    .filter(r => r.status === 'Draft')
    .length;

  // Monthly Attendance logs fetch for dynamic charts
  const [monthlyAttendance, setMonthlyAttendance] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    getAttendanceByMonth(thisMonthStr).then(data => {
      if (active) {
        setMonthlyAttendance(data);
      }
    }).catch(err => {
      console.error("Dashboard failed to load attendance logs:", err);
    });
    return () => {
      active = false;
    };
  }, [thisMonthStr, getAttendanceByMonth]);

  // Dynamic Weekly Attendance calculations (last 6 calendar days)
  const last6Days = useMemo(() => {
    const dates = [];
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      const offset = 5.5 * 60 * 60 * 1000; // IST offset
      const istTime = new Date(d.getTime() + offset);
      istTime.setDate(istTime.getDate() - i);
      
      const year = istTime.getUTCFullYear();
      const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
      const day = String(istTime.getUTCDate()).padStart(2, '0');
      
      dates.push({
        dateStr: `${year}-${month}-${day}`,
        name: weekdayNames[istTime.getUTCDay()]
      });
    }
    return dates;
  }, []);

  const attendanceData = useMemo(() => {
    return last6Days.map(day => {
      const recordsForDay = monthlyAttendance.filter(r => r.date === day.dateStr);
      let present = 0;
      let absent = 0;
      
      if (recordsForDay.length > 0) {
        present = recordsForDay.filter(r => r.status === 'Present' || r.status === 'Half Day').length;
        absent = recordsForDay.filter(r => r.status === 'Absent').length;
        
        // Dynamic absent mapping for employees who checked-in neither Present/HalfDay nor Absent (e.g. absent defaults)
        const loggedEmpIds = new Set(recordsForDay.map(r => r.employeeId));
        employees.forEach(emp => {
          if (emp.status !== 'On Leave' && !loggedEmpIds.has(emp.id)) {
            absent += 1;
          }
        });
      } else {
        // Fallback for past days
        if (day.dateStr < todayStr) {
          absent = employees.filter(e => e.status !== 'On Leave').length;
        }
      }
      
      return {
        name: day.name,
        present,
        absent
      };
    });
  }, [last6Days, monthlyAttendance, employees, todayStr]);

  // Dynamic Biometric Scan Density calculations
  const parseHour = (timeStr: string) => {
    if (!timeStr || timeStr === '--') return null;
    const match = timeStr.match(/^(\d{2}):\d{2}\s+(AM|PM)$/i);
    if (!match) return null;
    let hour = parseInt(match[1], 10);
    const ampm = match[2].toUpperCase();
    if (ampm === 'PM' && hour !== 12) {
      hour += 12;
    }
    if (ampm === 'AM' && hour === 12) {
      hour = 0;
    }
    return hour;
  };

  const biometricsData = useMemo(() => {
    const todayRecords = monthlyAttendance.filter(r => r.date === todayStr);
    const slots = [
      { time: '08:00', hour: 8, success: 0 },
      { time: '09:00', hour: 9, success: 0 },
      { time: '10:00', hour: 10, success: 0 },
      { time: '11:00', hour: 11, success: 0 },
      { time: '12:00', hour: 12, success: 0 },
      { time: '13:00', hour: 13, success: 0 },
      { time: '14:00', hour: 14, success: 0 },
      { time: '15:00', hour: 15, success: 0 },
      { time: '16:00', hour: 16, success: 0 },
      { time: '17:00', hour: 17, success: 0 },
      { time: '18:00', hour: 18, success: 0 }
    ];

    todayRecords.forEach(r => {
      const inHour = parseHour(r.checkIn);
      const outHour = parseHour(r.checkOut);
      
      slots.forEach(slot => {
        if (inHour !== null && inHour === slot.hour) {
          slot.success += 1;
        }
        if (outHour !== null && outHour === slot.hour) {
          slot.success += 1;
        }
      });
    });

    return slots;
  }, [monthlyAttendance, todayStr]);

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
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip 
                  cursor={{ fill: 'var(--surface-hover)' }} 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} 
                />
                <Bar dataKey="present" name="Present" stackId="a" fill="var(--primary)" maxBarSize={36} radius={[0, 0, 4, 4]} />
                <Bar dataKey="absent" name="Absent" stackId="a" fill="var(--accent)" maxBarSize={36} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="activity-panel card">
          <div className="card-header">
            <h3>Recent Activity</h3>
          </div>
          <div className="activity-list">
            {activityLogs.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '1rem 0' }}>No recent activity</p>
            ) : (
              activityLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="activity-item">
                  <div className={`activity-indicator ${log.type}`}></div>
                  <div className="activity-details">
                    <p><strong>{log.employeeName}</strong> {log.action}</p>
                    <span>{formatTimeAgo(log.timestamp)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="chart-card card col-span-full">
          <div className="card-header">
            <h3>Biometric Scan Density</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={biometricsData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis 
                  dataKey="time" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="success" 
                  name="Scans"
                  stroke="var(--secondary)" 
                  strokeWidth={3} 
                  dot={{ r: 3, strokeWidth: 2, fill: 'var(--secondary)' }} 
                  activeDot={{ r: 6 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
