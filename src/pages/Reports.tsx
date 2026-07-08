import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Search, FileDown, Download, Award, ShieldAlert, BarChart3, Filter, IndianRupee } from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import reportsBg from '../assets/dashboard-backgrounds/reports-bg.webp';
import './Reports.css';

export default function Reports() {
  const { employees, dailyPayrollHistory, otHistory, addToast } = useApp();
  const [selectedDept, setSelectedDept] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  // Extract unique departments dynamically
  const departments = ['All', ...Array.from(new Set(employees.map(e => e.department)))];

  // Perform filtering based on search query and department dropdown selection
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          emp.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === 'All' || emp.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  // Calculate monthly aggregates for filtered employees
  const reportData = useMemo(() => {
    // Determine month string matching format in otHistory (e.g. "May 2026")
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const [year, monthNum] = selectedMonth.split('-');
    const currentMonthName = `${monthNames[parseInt(monthNum, 10) - 1]} ${year}`;

    return filteredEmployees.map(emp => {
      const records = dailyPayrollHistory.filter(r => r.employeeId === emp.id && r.date.startsWith(selectedMonth));
      const otRecords = (otHistory || []).filter(r => r.employeeId === emp.id && r.month === currentMonthName && (r.status === 'Approved' || r.status === 'Paid'));
      
      const daysWorked = records.length;
      const totalDailyWage = records.reduce((sum, r) => sum + r.dailyWage, 0);
      const totalBonus = records.reduce((sum, r) => sum + r.bonus, 0);
      const totalDeduction = records.reduce((sum, r) => sum + r.deduction, 0);
      const totalOT = otRecords.reduce((sum, r) => sum + r.finalAmount, 0);
      const netPay = records.reduce((sum, r) => sum + r.finalAmount, 0) + totalOT;

      return {
        ...emp,
        daysWorked,
        totalDailyWage,
        totalBonus,
        totalDeduction,
        totalOT,
        netPay
      };
    });
  }, [filteredEmployees, dailyPayrollHistory, otHistory, selectedMonth]);

  // Calculate high-level aggregates across filtered list
  const activeStaff = reportData.filter(e => e.daysWorked > 0).length;
  const netExpenditure = reportData.reduce((sum, e) => sum + e.netPay, 0);
  
  // Calculate average attendance for this month (days worked / days in month)
  const daysInMonth = new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).getDate();
  const averageAttendanceRate = activeStaff > 0 
    ? Math.round(reportData.filter(e => e.daysWorked > 0).reduce((sum, e) => sum + (e.daysWorked / daysInMonth) * 100, 0) / activeStaff)
    : 0;

  // Handle mock export mechanisms that give active visual feedback
  const triggerExport = (format: 'pdf' | 'excel') => {
    setExporting(format);
    setTimeout(() => {
      setExporting(null);
      if (format === 'pdf') {
        try {
          const doc = new jsPDF();
          
          doc.setFontSize(18);
          doc.setFont("helvetica", "bold");
          doc.text("C NANJAPPA TIMBER TRADERS", 14, 22);
          
          doc.setFontSize(11);
          doc.setFont("helvetica", "normal");
          doc.text(`Monthly Payroll Report: ${selectedMonth}`, 14, 30);
          
          doc.setFontSize(9);
          doc.setTextColor(100);
          doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 36);
          doc.text(`Active Employees in period: ${activeStaff}`, 14, 41);

          const tableData = reportData.filter(e => e.daysWorked > 0 || e.totalOT > 0).map(emp => {
            return [
              emp.name,
              emp.id,
              emp.department,
              emp.daysWorked.toString(),
              `Rs. ${emp.totalDailyWage.toLocaleString('en-IN')}`,
              `Rs. ${emp.totalBonus.toLocaleString('en-IN')}`,
              `Rs. ${emp.totalOT.toLocaleString('en-IN')}`,
              `Rs. ${emp.totalDeduction.toLocaleString('en-IN')}`,
              `Rs. ${emp.netPay.toLocaleString('en-IN')}`
            ];
          });

          autoTable(doc, {
            startY: 48,
            head: [['Employee Name', 'ID', 'Department', 'Days Worked', 'Total Wages', 'Bonus', 'OT Amount', 'Deductions', 'Net Payout']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255 },
            styles: { fontSize: 8, cellPadding: 3 },
          });

          doc.save(`payroll-report-${selectedMonth}.pdf`);
          if (addToast) addToast('Payroll Report PDF Downloaded Successfully', 'success');
        } catch (error) {
          if (addToast) addToast('Failed to generate PDF', 'error');
          console.error("PDF Export error:", error);
        }
      } else {
        try {
          const headers = [
            'Employee ID',
            'Employee Name',
            'Department',
            'Role',
            'Payment Type',
            'Days Worked',
            'Total Wages (INR)',
            'Total Bonus (INR)',
            'OT Amount (INR)',
            'Total Deductions (INR)',
            'Net Payout (INR)'
          ];

          const rows = reportData.map(emp => {
            return [
              `"${emp.id}"`,
              `"${emp.name}"`,
              `"${emp.department}"`,
              `"${emp.role}"`,
              `"${emp.paymentType || 'Daily Wage'}"`,
              emp.daysWorked,
              emp.totalDailyWage,
              emp.totalBonus,
              emp.totalOT,
              emp.totalDeduction,
              emp.netPay
            ].join(',');
          });

          const csvContent = [headers.join(','), ...rows].join('\n');
          const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const downloadAnchor = document.createElement('a');
          
          downloadAnchor.setAttribute('href', url);
          downloadAnchor.setAttribute('download', `payroll-report-${selectedMonth}.csv`);
          document.body.appendChild(downloadAnchor);
          downloadAnchor.click();
          document.body.removeChild(downloadAnchor);
          URL.revokeObjectURL(url);
          
          if (addToast) addToast('CSV Export Downloaded Successfully', 'success');
        } catch (error) {
          if (addToast) addToast('Failed to generate CSV export', 'error');
          console.error("Export error:", error);
        }
      }
    }, 1500);
  };

  return (
    <>
      <div className="dashboard-bg-wrapper" style={{ backgroundImage: `url(${reportsBg})` }}></div>
      <div className="dashboard-bg-overlay"></div>
      <div className="reports-page" style={{ position: 'relative', zIndex: 1 }}>
        <div className="page-header">
        <div>
          <h1 className="page-title">Payroll Reports</h1>
          <p className="page-subtitle">Consolidated logs syncing real-time daily wage data</p>
        </div>
        
        {/* Export Buttons */}
        <div className="export-actions">
          <button 
            className="btn-outline" 
            disabled={exporting !== null}
            onClick={() => triggerExport('excel')}
          >
            <Download size={18} />
            {exporting === 'excel' ? 'Generating Sheet...' : 'Export Excel'}
          </button>
          <button 
            className="btn-primary" 
            disabled={exporting !== null}
            onClick={() => triggerExport('pdf')}
          >
            <FileDown size={18} />
            {exporting === 'pdf' ? 'Preparing PDF...' : 'Print PDF Report'}
          </button>
        </div>
      </div>

      {/* Aggregate metrics box */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon primary"><BarChart3 size={24} /></div>
          <div className="stat-info">
            <h3>Active Workforce</h3>
            <p className="stat-value">{activeStaff} staff paid</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon success"><Award size={24} /></div>
          <div className="stat-info">
            <h3>Avg. Attendance Rate</h3>
            <p className="stat-value">{averageAttendanceRate}%</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon primary"><IndianRupee size={24} /></div>
          <div className="stat-info">
            <h3>Total Net Cash Outflow</h3>
            <p className="stat-value">₹{netExpenditure.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Audit Report Sheet */}
      <div className="table-card card">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by name or ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="toolbar-actions filter-toolbar-action">
            <input 
              type="month" 
              className="filter-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ marginRight: '1rem', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
            />
            <Filter size={18} className="filter-icon" />
            <select 
              className="dept-select-input"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === 'All' ? 'All Departments' : `${dept} Dept`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {reportData.length === 0 ? (
          <div className="empty-reports-state">
            <ShieldAlert size={48} />
            <h3>No Records Found</h3>
            <p>Modify your department filter, month, or search criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="enterprise-table reports-audit-table">
              <thead>
                <tr>
                  <th>Employee Info</th>
                  <th>Dept & Role</th>
                  <th>Days Worked</th>
                  <th>Wages Earned</th>
                  <th>Total Bonus</th>
                  <th>OT Amount</th>
                  <th>Total Deductions</th>
                  <th>Net Payout</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((emp) => {
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
                            <span className="employee-role text-muted">{emp.id}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="dept-cell">
                          <span>{emp.department}</span>
                          <small className="text-muted">{emp.role}</small>
                        </div>
                      </td>
                      <td>
                        <strong className={emp.daysWorked > 0 ? 'text-success' : 'text-muted'}>
                          {emp.daysWorked} days
                        </strong>
                      </td>
                      <td>₹{emp.totalDailyWage.toLocaleString('en-IN')}</td>
                      <td className="text-success">+₹{emp.totalBonus.toLocaleString('en-IN')}</td>
                      <td className="text-success">+₹{emp.totalOT.toLocaleString('en-IN')}</td>
                      <td className="text-danger">-₹{emp.totalDeduction.toLocaleString('en-IN')}</td>
                      <td>
                        <strong className="final-net-highlight">
                          ₹{emp.netPay.toLocaleString('en-IN')}
                        </strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
