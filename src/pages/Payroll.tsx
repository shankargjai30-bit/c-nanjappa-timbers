import { useState, useMemo } from 'react';
import { useApp, type DailyPayrollRecord } from '../context/AppContext';
import { Search, Save, Calendar, History, TrendingUp, CheckCircle } from 'lucide-react';
import payrollBg from '../assets/dashboard-backgrounds/payroll-bg.webp';
import './Payroll.css';

export default function Payroll() {
  const { employees, dailyPayrollHistory, saveBulkDailyPayrollRecords, managerProfile, addToast } = useApp();
  
  const [activeTab, setActiveTab] = useState<'daily' | 'history' | 'monthly'>('daily');
  
  // Date state for Daily Entry
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Daily Entry state (Bulk edit)
  const [entryData, setEntryData] = useState<Record<string, Partial<DailyPayrollRecord>>>({});

  // History filters
  const [historyEmployeeFilter, setHistoryEmployeeFilter] = useState('');
  const [historyMonthFilter, setHistoryMonthFilter] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  // Calculate Present Employees for the selected date
  // In a real app, attendance history is fetched per date. Here we assume current 'status' implies today's status.
  const presentEmployees = useMemo(() => {
    return employees.filter(e => 
      e.status === 'Present' || e.status === 'Half Day'
    );
  }, [employees]);

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
      addToast('Save failed. Please try again.', 'error');
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

  // MONTHLY SUMMARY LOGIC
  const monthlySummary = useMemo(() => {
    const summary: Record<string, { daysWorked: number, totalEarnings: number, totalBonus: number, totalDeduction: number, netPay: number, name: string, dept: string }> = {};
    
    const targetMonth = historyMonthFilter || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    
    dailyPayrollHistory.filter(r => r.date.startsWith(targetMonth)).forEach(r => {
      if (!summary[r.employeeId]) {
        const emp = employees.find(e => e.id === r.employeeId);
        summary[r.employeeId] = {
          daysWorked: 0, totalEarnings: 0, totalBonus: 0, totalDeduction: 0, netPay: 0,
          name: emp?.name || 'Unknown', dept: emp?.department || ''
        };
      }
      summary[r.employeeId].daysWorked += 1;
      summary[r.employeeId].totalEarnings += r.dailyWage;
      summary[r.employeeId].totalBonus += r.bonus;
      summary[r.employeeId].totalDeduction += r.deduction;
      summary[r.employeeId].netPay += r.finalAmount;
    });
    
    return Object.entries(summary).map(([id, data]) => ({ id, ...data }));
  }, [dailyPayrollHistory, historyMonthFilter, employees]);


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
            <div className="flex items-center gap-4 flex-wrap mb-6">
              <div className="search-box-erp relative" style={{ width: '320px', height: '44px' }}>
                <Search size={18} className="search-icon absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search employees..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', height: '100%', paddingLeft: '2.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}
                />
              </div>
              <input 
                type="date" 
                className="date-picker-erp"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ height: '44px', padding: '0 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}
              />
              <button 
                className="btn-primary" 
                onClick={saveAllEntries}
                disabled={isSaving}
                style={{ height: '44px', display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}
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
                            disabled={saved}
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
                            disabled={saved}
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
                            disabled={saved}
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
                            disabled={saved}
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
                            disabled={saved}
                          />
                        </td>
                        <td>
                          <strong>₹{Number(record.finalAmount || 0).toLocaleString('en-IN')}</strong>
                        </td>
                        <td>
                          {saved ? (
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
                    <th>Total Base Earnings</th>
                    <th>Total Bonus</th>
                    <th>Total Deductions</th>
                    <th>Net Monthly Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySummary.map(row => (
                    <tr key={row.id}>
                      <td>
                        <div className="employee-details">
                          <span className="employee-name">{row.name}</span>
                          <span className="employee-role">{row.id}</span>
                        </div>
                      </td>
                      <td>{row.dept}</td>
                      <td><strong>{row.daysWorked} days</strong></td>
                      <td>₹{row.totalEarnings.toLocaleString('en-IN')}</td>
                      <td className="text-success">₹{row.totalBonus.toLocaleString('en-IN')}</td>
                      <td className="text-danger">₹{row.totalDeduction.toLocaleString('en-IN')}</td>
                      <td>
                        <strong className="text-primary" style={{ fontSize: '1.1rem' }}>
                          ₹{row.netPay.toLocaleString('en-IN')}
                        </strong>
                      </td>
                    </tr>
                  ))}
                  {monthlySummary.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                        No records found for this month.
                      </td>
                    </tr>
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
