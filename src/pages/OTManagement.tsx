import { useState, useMemo } from 'react';
import { useApp, type Employee, type OTRecord } from '../context/AppContext';
import { Search, Clock, ShieldCheck, Edit, Landmark, X, IndianRupee, Flame, Calendar, History, Check, Wallet, CheckCircle } from 'lucide-react';
import otBg from '../assets/dashboard-backgrounds/ot-bg.webp';
import './OTManagement.css';

const CURRENT_MONTH = "May 2026";
const DEFAULT_OT_RATE = 166.67; // 500 / 3

export default function OTManagement() {
  const { employees, otHistory, processOTRecord, addToast } = useApp();
  
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [searchQuery, setSearchQuery] = useState('');
  
  // History filters
  const [historyMonthFilter, setHistoryMonthFilter] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('');

  // Modals state
  const [editingOTRecord, setEditingOTRecord] = useState<OTRecord | null>(null);
  
  // Edit Form state
  const [editRate, setEditRate] = useState<number | string>(DEFAULT_OT_RATE);
  const [editBonus, setEditBonus] = useState<number | string>(0);
  const [editDeductions, setEditDeductions] = useState<number | string>(0);
  const [editNotes, setEditNotes] = useState<string>('');

  const [approvalRecord, setApprovalRecord] = useState<OTRecord | null>(null);
  const [paymentRecord, setPaymentRecord] = useState<OTRecord | null>(null);

  // Helper to generate current month's draft OT record
  const getEmployeeCurrentOTRecord = (emp: Employee): OTRecord => {
    const existing = otHistory.find(r => r.month === CURRENT_MONTH && r.employeeId === emp.id);
    if (existing) return existing;

    const calculated = Math.round(emp.otHours * DEFAULT_OT_RATE);
    
    // Check if there was an old flat manual override stored in employee state
    let finalAmount = calculated;
    let bonus = 0;
    if (emp.otAmountManual !== null) {
      finalAmount = emp.otAmountManual;
      if (finalAmount > calculated) {
        bonus = finalAmount - calculated;
      }
    }

    return {
      id: `${CURRENT_MONTH}_${emp.id}`,
      employeeId: emp.id,
      employeeName: emp.name,
      department: emp.department,
      role: emp.role,
      avatarColor: emp.avatarColor,
      month: CURRENT_MONTH,
      otHours: emp.otHours,
      otHourlyRate: DEFAULT_OT_RATE,
      calculatedAmount: calculated,
      bonusAmount: bonus,
      deductionAmount: 0,
      finalAmount: finalAmount,
      status: 'Draft'
    };
  };

  const currentRecords = useMemo(() => {
    return employees
      .map(getEmployeeCurrentOTRecord)
      .filter(record => 
        record.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.employeeId.toLowerCase().includes(searchQuery.toLowerCase())
      );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, otHistory, searchQuery]);

  const historyRecords = useMemo(() => {
    return otHistory.filter(record => {
      const matchesSearch = record.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            record.employeeId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMonth = historyMonthFilter ? record.month === historyMonthFilter : true;
      const matchesStatus = historyStatusFilter ? record.status === historyStatusFilter : true;
      return matchesSearch && matchesMonth && matchesStatus;
    });
  }, [otHistory, searchQuery, historyMonthFilter, historyStatusFilter]);

  // Compute Overtime Aggregates for current view
  const totalOTHours = currentRecords.reduce((sum, r) => sum + r.otHours, 0);
  const totalOTEarnings = currentRecords.reduce((sum, r) => sum + r.finalAmount, 0);
  
  // Top earner
  const topOTEarner = currentRecords.length > 0 ? currentRecords.reduce((prev, current) => {
    return current.finalAmount > prev.finalAmount ? current : prev;
  }, currentRecords[0]) : null;

  // Actions
  const handleEditOTClick = (record: OTRecord) => {
    setEditingOTRecord(record);
    setEditRate(record.otHourlyRate);
    setEditBonus(record.bonusAmount);
    setEditDeductions(record.deductionAmount);
    setEditNotes(record.notes || '');
  };

  const handleSaveOT = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingOTRecord) {
      const rateNum = Number(editRate) || 0;
      const bonusNum = Number(editBonus) || 0;
      const dedNum = Number(editDeductions) || 0;
      
      if (rateNum < 0 || bonusNum < 0 || dedNum < 0) {
        addToast('Numeric fields cannot be negative', 'error');
        return;
      }
      if (rateNum > 999999999 || bonusNum > 999999999 || dedNum > 999999999) {
        addToast('Values exceed the maximum allowed limit', 'error');
        return;
      }
      
      const finalAmt = Math.round((editingOTRecord.otHours * rateNum) + bonusNum - dedNum);
      
      const updatedRecord: OTRecord = {
        ...editingOTRecord,
        otHourlyRate: rateNum,
        calculatedAmount: Math.round(editingOTRecord.otHours * rateNum),
        bonusAmount: bonusNum,
        deductionAmount: dedNum,
        finalAmount: finalAmt,
        notes: editNotes,
        status: editingOTRecord.status === 'Paid' ? 'Paid' : 'Draft'
      };
      
      processOTRecord(updatedRecord);
      setEditingOTRecord(null);
    }
  };

  const confirmApprove = () => {
    if (approvalRecord) {
      processOTRecord({
        ...approvalRecord,
        status: 'Approved',
        approvedBy: 'Operations Manager',
        approvalTime: new Date().toISOString()
      });
      addToast('OT Approved Successfully', 'success');
      setApprovalRecord(null);
    }
  };

  const confirmPaid = () => {
    if (paymentRecord) {
      processOTRecord({
        ...paymentRecord,
        status: 'Paid',
      });
      addToast('OT Marked as Paid', 'success');
      setPaymentRecord(null);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Draft': return 'status-pending';
      case 'Approved': return 'status-approved';
      case 'Paid': return 'status-paid';
      default: return 'status-pending';
    }
  };

  // Dynamic final amount for display in modal
  const dynamicFinalAmount = editingOTRecord 
    ? Math.round((editingOTRecord.otHours * (Number(editRate) || 0)) + (Number(editBonus) || 0) - (Number(editDeductions) || 0)) 
    : 0;

  return (
    <>
      <div className="dashboard-bg-wrapper" style={{ backgroundImage: `url(${otBg})` }}></div>
      <div className="dashboard-bg-overlay"></div>
      <div className="ot-management-page" style={{ position: 'relative', zIndex: 1 }}>
        <div className="page-header">
        <div>
          <h1 className="page-title">Overtime Management</h1>
          <p className="page-subtitle">Track, adjust, and approve employee overtime payouts</p>
        </div>
      </div>

      <div className="payroll-tabs">
        <button 
          className={`tab-btn ${activeTab === 'current' ? 'active' : ''}`}
          onClick={() => setActiveTab('current')}
        >
          <Calendar size={18} />
          Current Processing
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={18} />
          OT History
        </button>
      </div>

      {activeTab === 'current' && (
        <>
          {/* OT Rate Banner */}
          <div className="ot-rate-banner">
            <div className="banner-icon-bg">
              <Flame size={28} className="pulse-icon-slow" />
            </div>
            <div className="banner-content">
              <h3>Standard Overtime Calculation Rule</h3>
              <p>
                The default overtime compensation policy is: <strong>₹500 per 3 hours</strong> (~₹166.67/hour). 
                Managers can edit this hourly rate, add bonuses, or apply deductions on an individual basis before approval.
              </p>
            </div>
          </div>

          {/* Overtime Statistics cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon warning"><Clock size={24} /></div>
              <div className="stat-info">
                <h3>Total Overtime Hours</h3>
                <p className="stat-value">{totalOTHours} hrs</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon primary"><IndianRupee size={24} /></div>
              <div className="stat-info">
                <h3>Total Overtime Payout</h3>
                <p className="stat-value">₹{totalOTEarnings.toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon success"><ShieldCheck size={24} /></div>
              <div className="stat-info">
                <h3>Default OT Rate</h3>
                <p className="stat-value">₹166.67 / hr</p>
              </div>
            </div>

            {topOTEarner && (
              <div className="stat-card">
                <div className="stat-icon primary"><Landmark size={24} /></div>
                <div className="stat-info">
                  <h3>Top OT Earner</h3>
                  <p className="stat-value">{topOTEarner.employeeName}</p>
                  <span className="text-muted text-xs">
                    ₹{topOTEarner.finalAmount.toLocaleString('en-IN')} ({topOTEarner.otHours}h)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Main OT Records Grid */}
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
              <span className="pay-period">Active Period: {CURRENT_MONTH}</span>
            </div>

            <div className="table-responsive">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>OT Hours</th>
                    <th>Hourly Rate</th>
                    <th>Calculated</th>
                    <th>Final Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRecords.map((record) => {
                    const isOverridden = record.bonusAmount > 0 || record.deductionAmount > 0 || record.otHourlyRate !== DEFAULT_OT_RATE;

                    return (
                      <tr key={record.id}>
                        <td>
                          <div className="employee-cell">
                            <div 
                              className="employee-avatar" 
                              style={{ backgroundColor: record.avatarColor || 'var(--primary-light)' }}
                            >
                              {record.employeeName.charAt(0)}
                            </div>
                            <div className="employee-details">
                              <span className="employee-name">{record.employeeName}</span>
                              <span className="employee-role">{record.employeeId} | {record.department}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong>{record.otHours} hrs</strong>
                        </td>
                        <td>₹{record.otHourlyRate.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        <td>₹{record.calculatedAmount.toLocaleString('en-IN')}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong className={isOverridden ? 'text-warning' : 'text-success'}>
                              ₹{record.finalAmount.toLocaleString('en-IN')}
                            </strong>
                            {isOverridden && <span style={{ fontSize: '0.7rem', color: 'var(--warning)' }}>Modified</span>}
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill ${getStatusBadgeClass(record.status)}`}>
                            {record.status === 'Draft' && <Clock size={12} />}
                            {record.status === 'Approved' && <Check size={12} />}
                            {record.status === 'Paid' && <CheckCircle size={12} />}
                            {record.status}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons-group">
                            {record.status === 'Draft' ? (
                              <>
                                <button 
                                  className="btn-icon-action btn-approve" 
                                  title="Approve OT"
                                  onClick={() => setApprovalRecord(record)}
                                >
                                  <Check size={16} />
                                </button>
                                <button 
                                  className="btn-icon-action btn-edit" 
                                  title="Advanced Edit OT" 
                                  onClick={() => handleEditOTClick(record)}
                                >
                                  <Edit size={16} />
                                </button>
                              </>
                            ) : record.status === 'Approved' ? (
                              <>
                                <button 
                                  className="btn-icon-action btn-approve" 
                                  title="Mark as Paid"
                                  onClick={() => setPaymentRecord(record)}
                                >
                                  <Wallet size={16} />
                                </button>
                                <button 
                                  className="btn-icon-action btn-edit" 
                                  title="View Details" 
                                  onClick={() => handleEditOTClick(record)}
                                >
                                  <Edit size={16} />
                                </button>
                              </>
                            ) : (
                              <button 
                                className="btn-icon-action btn-edit" 
                                title="View Details" 
                                onClick={() => handleEditOTClick(record)}
                              >
                                <Edit size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
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
              <select 
                value={historyMonthFilter} 
                onChange={(e) => setHistoryMonthFilter(e.target.value)}
                className="filter-select"
              >
                <option value="">All Months</option>
                <option value="May 2026">May 2026</option>
                <option value="April 2026">April 2026</option>
                <option value="March 2026">March 2026</option>
              </select>
              <select 
                value={historyStatusFilter} 
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Approved">Approved</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Employee</th>
                  <th>OT Hours</th>
                  <th>Final OT Amount</th>
                  <th>Status</th>
                  <th>Approved By</th>
                </tr>
              </thead>
              <tbody>
                {historyRecords.length > 0 ? historyRecords.map((record) => (
                  <tr key={record.id}>
                    <td><strong>{record.month}</strong></td>
                    <td>
                      <div className="employee-cell">
                        <div 
                          className="employee-avatar small" 
                          style={{ backgroundColor: record.avatarColor || 'var(--primary-light)' }}
                        >
                          {record.employeeName.charAt(0)}
                        </div>
                        <div className="employee-details">
                          <span className="employee-name">{record.employeeName}</span>
                          <span className="employee-role">{record.employeeId}</span>
                        </div>
                      </div>
                    </td>
                    <td>{record.otHours} hrs</td>
                    <td><strong>₹{record.finalAmount.toLocaleString('en-IN')}</strong></td>
                    <td>
                      <span className={`status-pill ${getStatusBadgeClass(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                    <td>
                      {record.approvedBy ? (
                        <span className="text-muted text-sm">{record.approvedBy}</span>
                      ) : (
                        <span className="text-muted text-sm">--</span>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>
                      <History size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
                      <h3 style={{ color: 'var(--text-muted)' }}>No historical OT records found</h3>
                      <p className="text-sm text-muted">Adjust your filters or approve pending OT to see them here.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OVERTIME ADJUSTMENT FORM MODAL */}
      {editingOTRecord && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Advanced Edit OT</h3>
              <button className="close-btn" onClick={() => setEditingOTRecord(null)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveOT} className="override-form">
              <div className="employee-profile-preview" style={{ marginBottom: '0.5rem' }}>
                <div className="preview-avatar" style={{ backgroundColor: editingOTRecord.avatarColor }}>
                  {editingOTRecord.employeeName.charAt(0)}
                </div>
                <div className="preview-info">
                  <h4>{editingOTRecord.employeeName}</h4>
                  <p>{editingOTRecord.employeeId} • {editingOTRecord.role}</p>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <span className="text-muted text-sm">Total OT Hours</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--secondary)' }}>{editingOTRecord.otHours} hrs</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>OT Hourly Rate (₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    max="999999999"
                    value={editRate} 
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) val = val.replace(/^0+/, '') || '0';
                      setEditRate(val);
                    }} 
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Bonus OT Amount (₹)</label>
                  <input 
                    type="number" 
                    min="0"
                    max="999999999"
                    value={editBonus} 
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) val = val.replace(/^0+/, '') || '0';
                      setEditBonus(val);
                    }} 
                    required
                  />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Deduction Amount (₹)</label>
                  <input 
                    type="number" 
                    min="0"
                    max="999999999"
                    value={editDeductions} 
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) val = val.replace(/^0+/, '') || '0';
                      setEditDeductions(val);
                    }} 
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Final OT Amount (Calculated)</label>
                  <div style={{ 
                    padding: '0.625rem 1rem', 
                    borderRadius: 'var(--radius-md)', 
                    border: '1px solid var(--border)', 
                    backgroundColor: 'var(--surface-hover)',
                    color: 'var(--primary)',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    ₹{dynamicFinalAmount.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Notes / Remarks</label>
                <textarea 
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Added 500rs bonus for holiday work..."
                  rows={2}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)', resize: 'none' }}
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '0.5rem' }}>
                <button type="button" className="btn-cancel" onClick={() => setEditingOTRecord(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-save">
                  Apply & Save Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: APPROVAL CONFIRMATION */}
      {approvalRecord && (
        <div className="modal-backdrop">
          <div className="modal-content card compact">
            <div className="modal-header">
              <h3>Confirm OT Approval</h3>
              <button className="close-btn" onClick={() => setApprovalRecord(null)}><X size={20} /></button>
            </div>
            <div className="modal-body text-center py-4">
              <CheckCircle size={48} className="success-icon mb-4" style={{ color: 'var(--success)', margin: '0 auto 1rem auto' }} />
              <h4>{approvalRecord.employeeName}</h4>
              <p className="text-muted mb-4">{approvalRecord.month} Overtime</p>
              
              <div className="summary-box mb-4" style={{ backgroundColor: 'var(--surface)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span>OT Hours:</span>
                  <strong>{approvalRecord.otHours} hrs</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span>Calculated:</span>
                  <strong>₹{approvalRecord.calculatedAmount.toLocaleString('en-IN')}</strong>
                </div>
                {(approvalRecord.bonusAmount > 0 || approvalRecord.deductionAmount > 0) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span>Adjustments (Bonus/Ded):</span>
                    <strong>+₹{approvalRecord.bonusAmount} / -₹{approvalRecord.deductionAmount}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                  <span>Final OT Payout:</span>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>₹{approvalRecord.finalAmount.toLocaleString('en-IN')}</strong>
                </div>
              </div>
              <p className="text-sm text-muted">This will approve the OT. It can then be marked as Paid.</p>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setApprovalRecord(null)}>Cancel</button>
              <button className="btn-save" onClick={confirmApprove}>Confirm & Approve</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PAYMENT */}
      {paymentRecord && (
        <div className="modal-backdrop">
          <div className="modal-content card compact">
            <div className="modal-header">
              <h3>Mark OT as Paid</h3>
              <button className="close-btn" onClick={() => setPaymentRecord(null)}><X size={20} /></button>
            </div>
            <div className="modal-body py-2">
              <p className="mb-4">You are marking the OT record for <strong>{paymentRecord.employeeName}</strong> as Paid.</p>
              <div className="summary-box mb-4" style={{ backgroundColor: 'var(--surface)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Final Payout:</span>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--success)' }}>₹{paymentRecord.finalAmount.toLocaleString('en-IN')}</strong>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setPaymentRecord(null)}>Cancel</button>
              <button className="btn-save" style={{ backgroundColor: 'var(--success)', borderColor: 'var(--success)' }} onClick={confirmPaid}>Mark as Paid</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
