import { useState, useMemo, useEffect } from 'react';
import { useApp, type DailyPayrollRecord, type PayrollRecord } from '../context/AppContext';
import { Search, Save, Calendar, History, TrendingUp, CheckCircle, Lock, Wallet, Clock, Check } from 'lucide-react';
import payrollBg from '../assets/dashboard-backgrounds/payroll-bg.webp';
import './Payroll.css';

export default function Payroll() {
  const { 
    employees, 
    dailyPayrollHistory, 
    saveBulkDailyPayrollRecords, 
    managerProfile, 
    addToast, 
    getAttendanceByDate,
    payrollHistory,
    otHistory,
    processSalary,
    markSalaryPaid,
    getAttendanceByMonth,
    searchQuery,
    setSearchQuery
  } = useApp();
  
  const [activeTab, setActiveTab] = useState<'daily' | 'history' | 'monthly'>('daily');

  // Date state for Daily Entry (Asia/Kolkata IST)
  const [selectedDate, setSelectedDate] = useState(() => {
    const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    return formatter.format(new Date());
  });

  // History filters
  const [historyEmployeeFilter, setHistoryEmployeeFilter] = useState('');
  const [historyMonthFilter, setHistoryMonthFilter] = useState(() => {
    const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' } as const;
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    return formatter.format(new Date());
  });

  const getFriendlyMonth = (monthStr: string) => {
    if (!monthStr || !monthStr.includes('-')) return '';
    const [year, monthNum] = monthStr.split('-');
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${monthNames[parseInt(monthNum, 10) - 1]} ${year}`;
  };

  const selectedDateMonth = useMemo(() => {
    const monthStr = selectedDate.substring(0, 7); // YYYY-MM
    return getFriendlyMonth(monthStr);
  }, [selectedDate]);

  const isEmployeeLocked = (employeeId: string) => {
    const record = payrollHistory.find(r => r.employeeId === employeeId && r.month === selectedDateMonth);
    return record && (record.status === 'Approved' || record.status === 'Paid');
  };

  const [monthlyAttendance, setMonthlyAttendance] = useState<any[]>([]);
  const [loadingMonthlySummary, setLoadingMonthlySummary] = useState(false);

  useEffect(() => {
    let active = true;
    if (activeTab === 'monthly') {
      setLoadingMonthlySummary(true);
      getAttendanceByMonth(historyMonthFilter).then(data => {
        if (active) {
          setMonthlyAttendance(data);
          setLoadingMonthlySummary(false);
        }
      }).catch(err => {
        console.error(err);
        if (active) setLoadingMonthlySummary(false);
      });
    }
    return () => {
      active = false;
    };
  }, [historyMonthFilter, activeTab, getAttendanceByMonth]);

  // Daily Entry state (Bulk edit)
  const [entryData, setEntryData] = useState<Record<string, Partial<DailyPayrollRecord>>>({});

  // Attendance records state for selected date
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingAttendance(true);
    getAttendanceByDate(selectedDate).then(data => {
      if (active) {
        setAttendanceRecords(data);
        setLoadingAttendance(false);
      }
    }).catch(err => {
      console.error(err);
      if (active) setLoadingAttendance(false);
    });
    return () => {
      active = false;
    };
  }, [selectedDate, getAttendanceByDate]);

  // Calculate Present Employees for the selected date from authoritative AttendanceRecords
  const presentEmployees = useMemo(() => {
    const activeRecords = attendanceRecords.filter(r => 
      r.status === 'Present' || r.status === 'Half Day'
    );
    
    return activeRecords.map(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      return {
        id: r.employeeId,
        name: emp?.name || (r.employee && r.employee.name) || 'Unknown',
        department: emp?.department || (r.employee && r.employee.department) || '',
        role: emp?.role || (r.employee && r.employee.role) || '',
        avatarColor: emp?.avatarColor || (r.employee && r.employee.avatarColor) || 'var(--primary-light)',
        status: r.status
      };
    });
  }, [attendanceRecords, employees]);

  const filteredPresentEmployees = useMemo(() => {
    return presentEmployees.filter(e => 
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      e.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [presentEmployees, searchQuery]);

  // Handle Daily Entry Input Changes
  const handleEntryChange = (empId: string, field: keyof DailyPayrollRecord, value: string | number) => {
    setEntryData(prev => {
      const current = prev[empId] || { dailyWage: 0, bonus: 0, deduction: 0, timberQuantity: null, ratePerUnit: null, remarks: '' };
      const updated = { ...current, [field]: value };
      
      // Auto-calculate logic
      let wage = Number(updated.dailyWage) || 0;
      if (field === 'timberQuantity' || field === 'ratePerUnit') {
        const qty = field === 'timberQuantity' ? Number(value) : Number(updated.timberQuantity || 0);
        const rate = field === 'ratePerUnit' ? Number(value) : Number(updated.ratePerUnit || 0);
        if (qty > 0 && rate > 0) {
          wage = qty * rate;
          updated.dailyWage = wage;
        }
      }
      
      const bns = Number(updated.bonus) || 0;
      const ded = Number(updated.deduction) || 0;
      updated.finalAmount = wage + bns - ded;
      
      return { ...prev, [empId]: updated };
    });
  };

  const [isSaving, setIsSaving] = useState(false);

  const saveAllEntries = async () => {
    setIsSaving(true);
    const recordsToSave: DailyPayrollRecord[] = [];
    let hasInvalidData = false;
    
    for (const emp of filteredPresentEmployees) {
      if (isEmployeeLocked(emp.id)) continue;
      const data = entryData[emp.id];
      if (!data) continue;

      const isInvalid = (val: number | undefined | null) => 
        val !== undefined && val !== null && (val < 0 || isNaN(val) || !isFinite(val));

      const q = data.timberQuantity !== null && data.timberQuantity !== undefined ? Number(data.timberQuantity) : undefined;
      const r = data.ratePerUnit !== null && data.ratePerUnit !== undefined ? Number(data.ratePerUnit) : undefined;
      const w = data.dailyWage !== null && data.dailyWage !== undefined ? Number(data.dailyWage) : undefined;
      const b = data.bonus !== null && data.bonus !== undefined ? Number(data.bonus) : undefined;
      const d = data.deduction !== null && data.deduction !== undefined ? Number(data.deduction) : undefined;

      if (isInvalid(q) || isInvalid(r) || isInvalid(w) || isInvalid(b) || isInvalid(d)) {
        addToast(`Invalid numeric values found for ${emp.name}`, 'error');
        hasInvalidData = true;
        break;
      }

      if (w !== undefined || b !== undefined || d !== undefined || q !== undefined || r !== undefined) {
        recordsToSave.push({
          id: `DP_${emp.id}_${selectedDate}`,
          employeeId: emp.id,
          date: selectedDate,
          attendanceStatus: emp.status,
          dailyWage: w || 0,
          timberQuantity: q !== undefined ? q : null,
          ratePerUnit: r !== undefined ? r : null,
          bonus: b || 0,
          deduction: d || 0,
          finalAmount: Number(data.finalAmount) || 0,
          remarks: data.remarks || '',
          createdBy: managerProfile?.displayName || 'Admin',
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
    }

    if (hasInvalidData) {
      setIsSaving(false);
      return;
    }

    if (recordsToSave.length === 0) {
      addToast('Please enter payroll data for at least one employee before saving.', 'warning');
      setIsSaving(false);
      return;
    }

    try {
      await saveBulkDailyPayrollRecords(recordsToSave);
      setEntryData({}); // clear after save
      // Success toast is handled in saveBulkDailyPayrollRecords
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getRecordForDisplay = (empId: string) => {
    // Check if we have unsaved local data
    const local = entryData[empId];
    if (local) return local;
    
    // Check history if already saved for this date
    const saved = dailyPayrollHistory.find(r => r.employeeId === empId && r.date === selectedDate);
    if (saved) return saved;
    
    return { dailyWage: '', bonus: '', deduction: '', finalAmount: 0, timberQuantity: '', ratePerUnit: '', remarks: '' };
  };

  const isAlreadySaved = (empId: string) => {
    return dailyPayrollHistory.some(r => r.employeeId === empId && r.date === selectedDate);
  };

  // HISTORY TAB LOGIC
  const historyRecords = useMemo(() => {
    return dailyPayrollHistory.filter(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      const matchesEmp = historyEmployeeFilter ? (r.employeeId === historyEmployeeFilter) : true;
      const matchesMonth = historyMonthFilter ? r.date.startsWith(historyMonthFilter) : true;
      const matchesSearch = searchQuery ? (emp?.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.employeeId.toLowerCase().includes(searchQuery.toLowerCase())) : true;
      return matchesEmp && matchesMonth && matchesSearch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dailyPayrollHistory, historyEmployeeFilter, historyMonthFilter, searchQuery, employees]);

  const currentMonthName = useMemo(() => getFriendlyMonth(historyMonthFilter), [historyMonthFilter]);

  // MONTHLY SUMMARY & APPROVAL LOGIC
  const monthlySummary = useMemo(() => {
    return employees.map(emp => {
      // 1. Get daily wages for selected month
      const empDailyWages = dailyPayrollHistory.filter(r => 
        r.employeeId === emp.id && r.date.startsWith(historyMonthFilter)
      );
      const totalBonus = empDailyWages.reduce((sum, r) => sum + r.bonus, 0);
      const totalDeduction = empDailyWages.reduce((sum, r) => sum + r.deduction, 0);
      const workedWages = empDailyWages.reduce((sum, r) => sum + r.finalAmount, 0);

      // 2. Count presentDays from AttendanceRecord for this month
      const empAttendance = monthlyAttendance.filter(r => 
        r.employeeId === emp.id && (r.status === 'Present' || r.status === 'Half Day')
      );
      const presentDays = empAttendance.length;

      // 3. Get OT payout from otHistory
      const otRecord = otHistory.find(r => 
        r.employeeId === emp.id && 
        r.month === currentMonthName && 
        (r.status === 'Approved' || r.status === 'Paid')
      );
      const otHours = otRecord ? otRecord.otHours : 0;
      const otAmount = otRecord ? otRecord.finalAmount : 0;

      // 4. Base rates
      const basicSalary = emp.basicSalary || 0;
      const allowances = emp.allowances || 0;
      const deductions = emp.deductions || 0;

      // 5. Net Pay calculation: workedWages (piece rate daily payroll) + basicSalary + allowances + otAmount - deductions
      const netPay = workedWages + basicSalary + allowances + otAmount - deductions;

      // 6. Existing Payroll status
      const existingPayroll = payrollHistory.find(r => 
        r.employeeId === emp.id && r.month === currentMonthName
      );
      const status = existingPayroll ? existingPayroll.status : 'Unsaved';

      return {
        id: emp.id,
        name: emp.name,
        dept: emp.department,
        role: emp.role || '',
        avatarColor: emp.avatarColor || 'var(--primary-light)',
        basicSalary,
        allowances,
        deductions,
        otHours,
        otAmount,
        presentDays,
        workedWages,
        totalBonus,
        totalDeduction,
        netPay,
        status,
        existingRecord: existingPayroll
      };
    }).filter(row => 
      row.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      row.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [employees, dailyPayrollHistory, monthlyAttendance, otHistory, payrollHistory, currentMonthName, historyMonthFilter, searchQuery]);

  // Approval Handlers
  const handleSaveDraft = async (row: any) => {
    const recordPayload: PayrollRecord = {
      id: `PR_${row.id}_${historyMonthFilter}`,
      employeeId: row.id,
      employeeName: row.name,
      department: row.dept,
      role: row.role || '',
      avatarColor: row.avatarColor || '',
      month: currentMonthName,
      basicSalary: row.basicSalary,
      otHours: row.otHours,
      otAmount: row.otAmount,
      allowances: row.allowances,
      deductions: row.deductions,
      netPay: row.netPay,
      status: 'Draft',
      presentDays: row.presentDays,
      totalWorkingDays: 26
    };
    await processSalary(recordPayload);
    addToast(`Saved draft payroll for ${row.name}`, 'success');
  };

  const handleApprove = async (row: any) => {
    const recordPayload: PayrollRecord = {
      id: `PR_${row.id}_${historyMonthFilter}`,
      employeeId: row.id,
      employeeName: row.name,
      department: row.dept,
      role: row.role || '',
      avatarColor: row.avatarColor || '',
      month: currentMonthName,
      basicSalary: row.basicSalary,
      otHours: row.otHours,
      otAmount: row.otAmount,
      allowances: row.allowances,
      deductions: row.deductions,
      netPay: row.netPay,
      status: 'Approved',
      presentDays: row.presentDays,
      totalWorkingDays: 26,
      approvedBy: managerProfile?.displayName || 'Manager',
      approvalTime: new Date().toISOString()
    };
    await processSalary(recordPayload);
  };

  const handleMarkPaid = async (row: any) => {
    await markSalaryPaid(`PR_${row.id}_${historyMonthFilter}`);
  };


  return (
    <>
      <div className="dashboard-bg-wrapper" style={{ backgroundImage: `url(${payrollBg})` }}></div>
      <div className="dashboard-bg-overlay"></div>
      <div className="payroll-page" style={{ position: 'relative', zIndex: 1 }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Daily Payroll Management</h1>
            <p className="page-subtitle">Process daily wages based on timber cutting work</p>
          </div>
        </div>

        <div className="payroll-tabs">
          <button 
            className={`tab-btn ${activeTab === 'daily' ? 'active' : ''}`}
            onClick={() => setActiveTab('daily')}
          >
            <Calendar size={18} />
            Daily Entry
          </button>
          <button 
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={18} />
            Payroll History
          </button>
          <button 
            className={`tab-btn ${activeTab === 'monthly' ? 'active' : ''}`}
            onClick={() => setActiveTab('monthly')}
          >
            <TrendingUp size={18} />
            Monthly Summary
          </button>
        </div>

        {activeTab === 'daily' && (
          <div className="table-card card-erp">
            <div className="payroll-toolbar">
              <input 
                type="date" 
                className="date-picker-erp"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <button 
                type="button"
                className="btn-save-erp" 
                onClick={saveAllEntries}
                disabled={isSaving}
              >
                <Save size={18} />
                {isSaving ? 'Saving...' : 'Save All Entries'}
              </button>
            </div>

            <div className="table-responsive">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th style={{ width: '240px' }}>Employee</th>
                    <th style={{ width: '140px' }}>Attendance</th>
                    <th style={{ width: '160px' }}>Timber Qty</th>
                    <th style={{ width: '160px' }}>Rate / Unit</th>
                    <th style={{ width: '180px' }}>Daily Wage (₹)</th>
                    <th style={{ width: '160px' }}>Bonus (₹)</th>
                    <th style={{ width: '160px' }}>Deduction (₹)</th>
                    <th style={{ width: '180px' }}>Final Pay (₹)</th>
                    <th style={{ width: '120px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAttendance ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        Loading attendance records for {selectedDate}...
                      </td>
                    </tr>
                  ) : (
                    <>
                      {filteredPresentEmployees.map((emp) => {
                        const record = getRecordForDisplay(emp.id);
                        const saved = isAlreadySaved(emp.id);
                        return (
                          <tr key={emp.id} className={saved ? 'row-saved' : ''}>
                            <td>
                              <div className="employee-cell">
                                <div className="employee-avatar" style={{ backgroundColor: emp.avatarColor || 'var(--primary-light)' }}>
                                  {emp.name.charAt(0)}
                                </div>
                                <div className="employee-details">
                                  <span className="employee-name font-semibold">{emp.name}</span>
                                  <span className="employee-role text-sm text-gray-500">{emp.id}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="status-pill active">{emp.status}</span>
                            </td>
                            <td>
                              <input 
                                type="number"
                                min="0"
                                max="99999"
                                className="payroll-input-erp" 
                                placeholder="Qty"
                                value={record.timberQuantity ?? ''}
                                onChange={(e) => handleEntryChange(emp.id, 'timberQuantity', e.target.value)}
                                disabled={saved || isEmployeeLocked(emp.id)}
                              />
                            </td>
                            <td>
                              <input 
                                type="number"
                                min="0"
                                max="99999"
                                className="payroll-input-erp" 
                                placeholder="Rate"
                                value={record.ratePerUnit ?? ''}
                                onChange={(e) => handleEntryChange(emp.id, 'ratePerUnit', e.target.value)}
                                disabled={saved || isEmployeeLocked(emp.id)}
                              />
                            </td>
                            <td>
                              <input 
                                type="number"
                                min="0"
                                max="99999"
                                className="payroll-input-erp" 
                                placeholder="Wage"
                                value={record.dailyWage}
                                onChange={(e) => handleEntryChange(emp.id, 'dailyWage', e.target.value)}
                                disabled={saved || isEmployeeLocked(emp.id)}
                              />
                            </td>
                            <td>
                              <input 
                                type="number"
                                min="0"
                                max="999999"
                                className="payroll-input-erp text-success" 
                                placeholder="Bonus"
                                value={record.bonus}
                                onChange={(e) => handleEntryChange(emp.id, 'bonus', e.target.value)}
                                disabled={saved || isEmployeeLocked(emp.id)}
                              />
                            </td>
                            <td>
                              <input 
                                type="number"
                                min="0"
                                max="999999"
                                className="payroll-input-erp text-danger" 
                                placeholder="Deduct"
                                value={record.deduction}
                                onChange={(e) => handleEntryChange(emp.id, 'deduction', e.target.value)}
                                disabled={saved || isEmployeeLocked(emp.id)}
                              />
                            </td>
                            <td>
                              <strong>₹{Number(record.finalAmount || 0).toLocaleString('en-IN')}</strong>
                            </td>
                            <td>
                              {isEmployeeLocked(emp.id) ? (
                                <span className="text-danger flex items-center gap-1"><Lock size={16} /> Locked</span>
                              ) : saved ? (
                                <span className="text-success flex items-center gap-1"><CheckCircle size={16} /> Saved</span>
                              ) : (
                                <span className="text-muted text-sm">Pending</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredPresentEmployees.length === 0 && (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            No employees present on this date matching the criteria.
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="table-card card">
            <div className="table-toolbar">
              <div className="search-box">
                <Search size={18} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search history..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="history-filters">
                <input 
                  type="month" 
                  className="filter-select"
                  value={historyMonthFilter}
                  onChange={(e) => setHistoryMonthFilter(e.target.value)}
                />
                <select 
                  className="filter-select"
                  value={historyEmployeeFilter}
                  onChange={(e) => setHistoryEmployeeFilter(e.target.value)}
                >
                  <option value="">All Employees</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            </div>

            <div className="table-responsive">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Timber Math</th>
                    <th>Wage</th>
                    <th>Bonus</th>
                    <th>Deduction</th>
                    <th>Final Amount</th>
                    <th>Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRecords.map(record => {
                    const emp = employees.find(e => e.id === record.employeeId);
                    return (
                      <tr key={record.id}>
                        <td><strong>{record.date}</strong></td>
                        <td>
                          <div className="employee-cell">
                            <div className="employee-details">
                              <span className="employee-name">{emp?.name || 'Unknown'}</span>
                              <span className="employee-role">{record.employeeId}</span>
                            </div>
                          </div>
                        </td>
                        <td className="text-sm text-muted">
                          {record.timberQuantity ? `${record.timberQuantity} qty @ ₹${record.ratePerUnit}` : '--'}
                        </td>
                        <td>₹{record.dailyWage.toLocaleString('en-IN')}</td>
                        <td className="text-success">+{record.bonus}</td>
                        <td className="text-danger">-{record.deduction}</td>
                        <td><strong className="text-primary">₹{record.finalAmount.toLocaleString('en-IN')}</strong></td>
                        <td className="text-sm text-muted">{record.createdBy}</td>
                      </tr>
                    );
                  })}
                  {historyRecords.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                        No history records found for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'monthly' && (
          <div className="table-card card">
             <div className="table-toolbar">
              <div className="history-filters">
                <span style={{ fontWeight: 'bold' }}>Summary for: </span>
                <input 
                  type="month" 
                  className="filter-select"
                  value={historyMonthFilter}
                  onChange={(e) => setHistoryMonthFilter(e.target.value)}
                />
              </div>
            </div>
            
            <div className="table-responsive">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Dept</th>
                    <th>Days Worked</th>
                    <th>Wages / Basic</th>
                    <th>OT Pay</th>
                    <th>Allow. / Deduct.</th>
                    <th>Net Monthly Pay</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingMonthlySummary ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        Loading monthly summaries...
                      </td>
                    </tr>
                  ) : (
                    <>
                      {monthlySummary.map(row => (
                        <tr key={row.id}>
                          <td>
                            <div className="employee-cell">
                              <div className="employee-avatar" style={{ backgroundColor: row.avatarColor }}>
                                {row.name.charAt(0)}
                              </div>
                              <div className="employee-details">
                                <span className="employee-name font-semibold">{row.name}</span>
                                <span className="employee-role text-sm text-gray-500">{row.id}</span>
                              </div>
                            </div>
                          </td>
                          <td>{row.dept}</td>
                          <td><strong>{row.presentDays} days</strong></td>
                          <td>
                            <div className="flex flex-col">
                              <span>Wages: ₹{row.workedWages.toLocaleString('en-IN')}</span>
                              <span className="text-xs text-gray-500">Basic: ₹{row.basicSalary.toLocaleString('en-IN')}</span>
                            </div>
                          </td>
                          <td className="text-success">
                            <div className="flex flex-col">
                              <span>₹{row.otAmount.toLocaleString('en-IN')}</span>
                              <span className="text-xs text-gray-400">({row.otHours} hrs)</span>
                            </div>
                          </td>
                          <td>
                            <div className="flex flex-col">
                              <span className="text-success">Allow: +₹{row.allowances.toLocaleString('en-IN')}</span>
                              <span className="text-danger">Deduct: -₹{row.deductions.toLocaleString('en-IN')}</span>
                            </div>
                          </td>
                          <td>
                            <strong className="text-primary" style={{ fontSize: '1.1rem' }}>
                              ₹{row.netPay.toLocaleString('en-IN')}
                            </strong>
                          </td>
                          <td>
                            <span className={`status-pill ${
                              row.status === 'Paid' ? 'success' :
                              row.status === 'Approved' ? 'primary' :
                              row.status === 'Draft' ? 'warning' : 'info'
                            }`}>
                              {row.status === 'Paid' && <CheckCircle size={12} style={{ marginRight: '0.25rem' }} />}
                              {row.status === 'Approved' && <Check size={12} style={{ marginRight: '0.25rem' }} />}
                              {row.status === 'Draft' && <Clock size={12} style={{ marginRight: '0.25rem' }} />}
                              {row.status}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons-group">
                              {row.status === 'Unsaved' && (
                                <button 
                                  className="btn-icon-action btn-edit" 
                                  title="Save Draft Payroll"
                                  onClick={() => handleSaveDraft(row)}
                                  style={{ padding: '0.25rem 0.5rem', height: '30px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                >
                                  <Save size={14} />
                                  <span style={{ fontSize: '0.75rem' }}>Draft</span>
                                </button>
                              )}
                              {row.status === 'Draft' && (
                                <button 
                                  className="btn-icon-action btn-approve" 
                                  title="Approve Payroll"
                                  onClick={() => handleApprove(row)}
                                  style={{ padding: '0.25rem 0.5rem', height: '30px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                >
                                  <Check size={14} />
                                  <span style={{ fontSize: '0.75rem' }}>Approve</span>
                                </button>
                              )}
                              {row.status === 'Approved' && (
                                <button 
                                  className="btn-icon-action btn-approve" 
                                  title="Mark as Paid"
                                  onClick={() => handleMarkPaid(row)}
                                  style={{ padding: '0.25rem 0.5rem', height: '30px', display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'var(--success-light)', color: 'var(--success)' }}
                                >
                                  <Wallet size={14} />
                                  <span style={{ fontSize: '0.75rem' }}>Pay</span>
                                </button>
                              )}
                              {row.status === 'Paid' && (
                                <span className="text-success flex items-center gap-1" style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                                  <CheckCircle size={16} /> Paid
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {monthlySummary.length === 0 && (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', padding: '3rem' }}>
                            No employees found.
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
