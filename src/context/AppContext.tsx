import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, type User } from 'firebase/auth';
import { auth } from '../firebase';

export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('timberpro_api_url');
    if (customUrl && customUrl.trim()) {
      return customUrl.trim().replace(/\/+$/, '');
    }
  }

  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.startsWith('capacitor://') && !window.location.origin.startsWith('file://')) {
    return `${window.location.origin}/api`;
  }

  return '/api';
};

export const API_URL = getApiBaseUrl();

export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  try {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
    const headers: Record<string, string> = { ...(options.headers as any) || {} };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return await fetch(url, { ...options, headers });
  } catch (err: any) {
    if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
      throw new Error(`Cannot connect to backend server (${url}). Please verify that the backend is active, or configure your live server URL in Settings.`);
    }
    throw err;
  }
};


export interface Employee {
  id: string;
  name: string;
  department: string;
  role: string;
  status: string;
  checkIn: string;
  checkOut: string;
  verified: boolean;
  avatarColor?: string;
  phone?: string;
  email?: string;
  joiningDate?: string;
  shiftTiming?: string;
  faceBiometricId?: string;
  photo?: string;
  presentDays: number;
  absentDays: number;
  totalWorkingDays: number;
  otHours: number; 
  otAmountManual: number | null;
  paymentType?: string;
  basicSalary?: number;
  allowances?: number;
  deductions?: number;
}

export interface ActivityLog {
  id: string;
  employeeName: string;
  action: string;
  timestamp: number;
  type: 'success' | 'warning' | 'primary';
  read: boolean;
}

export type PayrollStatus = 'Draft' | 'Approved' | 'Paid';

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  role: string;
  avatarColor?: string;
  month: string;
  basicSalary: number;
  otHours: number;
  otAmount: number;
  allowances: number;
  deductions: number;
  netPay: number;
  status: PayrollStatus;
  approvedBy?: string;
  approvalTime?: string;
  rejectionReason?: string;
  presentDays: number;
  totalWorkingDays: number;
}

export interface DailyPayrollRecord {
  id: string;
  employeeId: string;
  date: string;
  attendanceStatus: string;
  dailyWage: number;
  timberQuantity: number | null;
  ratePerUnit: number | null;
  bonus: number;
  deduction: number;
  finalAmount: number;
  remarks: string | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface OTRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  role: string;
  avatarColor?: string;
  month: string;
  otHours: number;
  otHourlyRate: number;
  calculatedAmount: number;
  bonusAmount: number;
  deductionAmount: number;
  finalAmount: number;
  notes?: string;
  status: PayrollStatus;
  approvedBy?: string;
  approvalTime?: string;
  rejectionReason?: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface AppContextType {
  employees: Employee[];
  activityLogs: ActivityLog[];
  isAuthenticated: boolean;
  toasts: ToastMessage[];
  addEmployee: (emp: any) => Promise<void>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  addToast: (message: string, type?: ToastMessage['type'], customId?: string) => string;
  removeToast: (id: string) => void;
  updateEmployeePayroll: (id: string, basic: number, allowances: number, deductions: number) => Promise<void>;
  updateEmployeeOT: (id: string, hours: number, manualAmount: number | null) => Promise<void>;
  processBiometricAttendance: (employeeId: string, mode: 'check-in' | 'check-out') => Promise<{ success: boolean; error?: string; action?: 'check-in' | 'check-out'; time?: string; hoursWorked?: number; otHours?: number; }>;
  getAttendanceByDate: (date: string) => Promise<any[]>;
  getAttendanceByMonth: (month: string) => Promise<any[]>;
  payrollHistory: PayrollRecord[];
  otHistory: OTRecord[];
  processSalary: (record: PayrollRecord) => Promise<void>;
  processOTRecord: (record: OTRecord) => Promise<void>;
  markSalaryPaid: (recordId: string) => Promise<void>;
  dailyPayrollHistory: DailyPayrollRecord[];
  saveDailyPayrollRecord: (record: DailyPayrollRecord) => Promise<void>;
  saveBulkDailyPayrollRecords: (records: DailyPayrollRecord[]) => Promise<void>;
  addActivityLog: (employeeName: string, action: string, type: 'success' | 'warning' | 'primary') => void;
  markAllLogsRead: () => void;
  clearLogs: () => void;
  logout: () => Promise<void>;
  login: (email?: string, password?: string) => Promise<void>;
  signup: (email?: string, password?: string, fullName?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  authLoading: boolean;
  managerProfile: User | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  apiBaseUrl: string;
  setCustomApiBaseUrl: (url: string) => void;
  resetApiBaseUrl: () => void;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const calculateOTEarnings = (hours: number, manualAmount: number | null): number => {
  if (manualAmount !== null) return manualAmount;
  return Math.round((hours * 500) / 3);
};

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [payrollHistory, setPayrollHistory] = useState<PayrollRecord[]>([]);
  const [otHistory, setOtHistory] = useState<OTRecord[]>([]);
  const [dailyPayrollHistory, setDailyPayrollHistory] = useState<DailyPayrollRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [apiBaseUrlState, setApiBaseUrlState] = useState<string>(getApiBaseUrl());

  const refreshData = useCallback(async () => {
    try {
      const baseUrl = getApiBaseUrl();
      const empRes = await fetchWithAuth(`${baseUrl}/employees`);
      const logsRes = await fetchWithAuth(`${baseUrl}/logs`);
      const payrollRes = await fetchWithAuth(`${baseUrl}/payroll`);
      const otRes = await fetchWithAuth(`${baseUrl}/ot`);
      const dailyPayrollRes = await fetchWithAuth(`${baseUrl}/daily-payroll`);
      
      if (empRes.ok) setEmployees(await empRes.json());
      if (logsRes.ok) setActivityLogs(await logsRes.json());
      if (payrollRes.ok) setPayrollHistory(await payrollRes.json());
      if (otRes.ok) setOtHistory(await otRes.json());
      if (dailyPayrollRes.ok) setDailyPayrollHistory(await dailyPayrollRes.json());
    } catch (err) {
      console.error('Failed to fetch data from backend', err);
    }
  }, []);

  const setCustomApiBaseUrl = (url: string) => {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    if (cleanUrl) {
      localStorage.setItem('timberpro_api_url', cleanUrl);
    } else {
      localStorage.removeItem('timberpro_api_url');
    }
    setApiBaseUrlState(getApiBaseUrl());
    refreshData();
  };

  const resetApiBaseUrl = () => {
    localStorage.removeItem('timberpro_api_url');
    setApiBaseUrlState(getApiBaseUrl());
    refreshData();
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        refreshData();
      }
    });
    return () => unsubscribe();
  }, [refreshData]);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [managerProfile, setManagerProfile] = useState<User | null>(null);

  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        try {
          if (user) {
            setIsAuthenticated(true);
            setManagerProfile(user);
          } else {
            setIsAuthenticated(false);
            setManagerProfile(null);
          }
        } catch (e) {
          console.error("Error processing auth state change:", e);
        } finally {
          setAuthLoading(false);
        }
      }, (error) => {
        console.error("Auth state error:", error);
        setAuthLoading(false);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Firebase auth initialization failed:", e);
      setAuthLoading(false);
    }
  }, []);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const updateEmployeePayroll = async (id: string, basic: number, allowances: number, deductions: number) => {
    const original = employees.find(e => e.id === id);
    if (!original) return;

    if (basic < 0 || allowances < 0 || deductions < 0) {
      addToast('Numeric fields cannot be negative', 'error');
      return;
    }
    if (basic > 999999999 || allowances > 999999999 || deductions > 999999999) {
      addToast('Values exceed the maximum allowed limit', 'error');
      return;
    }

    try {
      const res = await fetchWithAuth(`${getApiBaseUrl()}/employees/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basicSalary: basic, allowances, deductions })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update payroll on server');
      }
      const newEmp = await res.json();
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === id
            ? {
                ...emp,
                basicSalary: newEmp.basicSalary || 0,
                allowances: newEmp.allowances || 0,
                deductions: newEmp.deductions || 0,
              }
            : emp
        )
      );
      addToast('Payroll components updated successfully', 'success');
      addActivityLog(original.name, `payroll details updated manually`, 'primary');
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Server error. Failed to save payroll components.', 'error');
    }
  };

  const updateEmployeeOT = async (id: string, hours: number, manualAmount: number | null) => {
    const original = employees.find(e => e.id === id);
    if (!original) return;

    if (hours < 0 || (manualAmount !== null && manualAmount < 0)) {
      addToast('OT values cannot be negative', 'error');
      return;
    }
    if (hours > 999999999 || (manualAmount !== null && manualAmount > 999999999)) {
      addToast('OT values exceed the maximum allowed limit', 'error');
      return;
    }

    try {
      const res = await fetchWithAuth(`${getApiBaseUrl()}/employees/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otHours: hours, otAmountManual: manualAmount })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update OT on server');
      }
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === id
            ? {
                ...emp,
                otHours: hours,
                otAmountManual: manualAmount,
              }
            : emp
        )
      );
      addToast('Overtime values updated', 'success');
      addActivityLog(original.name, `overtime recorded: ${hours}h`, 'primary');
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Server error. Failed to save overtime values.', 'error');
    }
  };

  const markSalaryPaid = async (recordId: string) => {
    const target = payrollHistory.find(r => r.id === recordId);
    if (!target) return;
    try {
      const res = await fetchWithAuth(`${getApiBaseUrl()}/payroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: recordId, status: 'Paid' })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update payroll status on server');
      }
      setPayrollHistory((prev) => 
        prev.map(record => 
          record.id === recordId ? { ...record, status: 'Paid' } : record
        )
      );
      addToast('Salary marked as Paid', 'success');
      addActivityLog(target.employeeName, `salary marked as Paid`, 'success');
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Server error. Failed to mark salary as paid.', 'error');
    }
  };

  const processSalary = async (record: PayrollRecord) => {
    try {
      const res = await fetchWithAuth(`${getApiBaseUrl()}/payroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to process salary approval on server');
      }
      setPayrollHistory((prev) => {
        const exists = prev.find(r => r.id === record.id);
        if (exists) {
          return prev.map(r => r.id === record.id ? record : r);
        }
        return [record, ...prev];
      });
      if (record.status === 'Approved') {
        addToast('Salary Approved Successfully', 'success');
        addActivityLog(record.employeeName, `salary approved by ${record.approvedBy}`, 'success');
      }
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Server error. Failed to process salary approval.', 'error');
    }
  };

  const processOTRecord = async (record: OTRecord) => {
    try {
      const res = await fetchWithAuth(`${getApiBaseUrl()}/ot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to process OT approval on server');
      }
      setOtHistory((prev) => {
        const exists = prev.find(r => r.id === record.id);
        if (exists) {
          return prev.map(r => r.id === record.id ? record : r);
        }
        return [record, ...prev];
      });

      if (record.status === 'Approved') {
        addToast('OT Approved Successfully', 'success');
        addActivityLog(record.employeeName, `OT approved by ${record.approvedBy}`, 'success');
        await updateEmployeeOT(record.employeeId, record.otHours, record.finalAmount);
      } else if (record.status === 'Paid') {
        addToast('OT Marked as Paid', 'success');
        addActivityLog(record.employeeName, `OT marked as Paid`, 'success');
      }
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Server error. Failed to process OT approval.', 'error');
    }
  };

  const saveDailyPayrollRecord = async (record: DailyPayrollRecord, suppressToast = false) => {
    try {
      const res = await fetchWithAuth(`${getApiBaseUrl()}/daily-payroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save daily payroll on server');
      }
      const savedRecord = await res.json();
      setDailyPayrollHistory((prev) => {
        const exists = prev.find(r => r.id === savedRecord.id);
        if (exists) {
          return prev.map(r => r.id === savedRecord.id ? savedRecord : r);
        }
        return [savedRecord, ...prev];
      });
    } catch (err: any) {
      console.error(err);
      if (!suppressToast) {
        addToast(err.message || 'Server error. Failed to save daily payroll.', 'error');
      }
      throw err;
    }
  };

  const saveBulkDailyPayrollRecords = async (records: DailyPayrollRecord[]) => {
    try {
      for (const record of records) {
        await saveDailyPayrollRecord(record, true);
      }
      addToast(`Successfully saved ${records.length} payroll entries`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Error saving some bulk entries', 'error');
      throw err;
    }
  };

  const processBiometricAttendance = async (employeeId: string, mode: 'check-in' | 'check-out') => {
    const target = employees.find(e => e.id === employeeId);
    if (!target) return { success: false, error: 'Employee not found' };

    try {
      const res = await fetchWithAuth(`${getApiBaseUrl()}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, mode })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Server rejected biometric scan');
      }

      const result = await res.json();
      
      if (!result.success) {
        addActivityLog(target.name, `scanned but: ${result.error}`, 'warning');
        return { success: false, error: result.error };
      }

      // Update local employees cache with the returned updated employee object
      setEmployees((prev) => prev.map(emp => emp.id === employeeId ? result.employee : emp));

      const action = result.action; // 'check-in' or 'check-out'
      const record = result.record;
      const timeStr = action === 'check-in' ? record.checkIn : record.checkOut;

      addActivityLog(target.name, `${action === 'check-in' ? 'checked in' : 'checked out'} successfully`, 'success');

      return {
        success: true,
        action,
        time: timeStr,
        hoursWorked: record.hoursWorked,
        otHours: record.otHours
      };
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.message || 'Database error during attendance' };
    }
  };

  const getAttendanceByDate = async (date: string) => {
    try {
      const res = await fetchWithAuth(`${getApiBaseUrl()}/attendance?date=${date}`);
      if (!res.ok) throw new Error('Failed to fetch attendance history');
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const getAttendanceByMonth = async (month: string) => {
    try {
      const res = await fetchWithAuth(`${getApiBaseUrl()}/attendance?month=${month}`);
      if (!res.ok) throw new Error('Failed to fetch monthly attendance history');
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const addActivityLog = (employeeName: string, action: string, type: 'success' | 'warning' | 'primary') => {
    const newLog: ActivityLog = {
      id: Date.now().toString() + Math.random().toString(),
      employeeName,
      action,
      timestamp: Date.now(),
      type,
      read: false
    };
    setActivityLogs(prev => [newLog, ...prev.slice(0, 49)]);

    fetchWithAuth(`${getApiBaseUrl()}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLog)
    }).catch(console.error);
  };

  const markAllLogsRead = () => {
    setActivityLogs(prev => prev.map(log => ({ ...log, read: true })));
    fetchWithAuth(`${getApiBaseUrl()}/logs/read-all`, { method: 'PUT' }).catch(console.error);
  };

  const clearLogs = () => {
    setActivityLogs([]);
    fetchWithAuth(`${getApiBaseUrl()}/logs`, { method: 'DELETE' }).catch(console.error);
  };

  const addEmployee = async (empData: any) => {
    const newEmp: Employee = {
      id: empData.id || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      name: empData.name || '',
      department: empData.department || '',
      role: empData.role || '',
      status: empData.status || 'Active',
      checkIn: empData.checkIn || '--',
      checkOut: empData.checkOut || '--',
      verified: empData.verified || false,
      avatarColor: empData.avatarColor || '#4f46e5',
      presentDays: empData.presentDays || 0,
      absentDays: empData.absentDays || 0,
      totalWorkingDays: empData.totalWorkingDays || 26,
      otHours: empData.otHours || 0,
      otAmountManual: empData.otAmountManual || null,
      basicSalary: Number(empData.basicSalary) || 0,
      allowances: empData.allowances || 0,
      deductions: empData.deductions || 0,
      phone: empData.phone || '',
      email: empData.email || '',
      joiningDate: empData.joiningDate || '',
      shiftTiming: empData.shiftTiming || '',
      faceBiometricId: empData.faceBiometricId || '',
      photo: empData.photo || ''
    };

    // Client-side validation checks
    if (!newEmp.name.trim()) {
      addToast('Full Name is required', 'error');
      throw new Error('Name cannot be empty');
    }
    if ((newEmp.basicSalary || 0) < 0 || (newEmp.allowances || 0) < 0 || (newEmp.deductions || 0) < 0) {
      addToast('Salary fields cannot be negative', 'error');
      throw new Error('Negative values not allowed');
    }
    if (employees.some(e => e.id.toLowerCase() === newEmp.id.toLowerCase())) {
      addToast(`Employee ID ${newEmp.id} already exists`, 'error');
      throw new Error('Duplicate ID');
    }

    try {
      const res = await fetchWithAuth(`${getApiBaseUrl()}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmp)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Server error adding employee');
      }
      const savedEmp = await res.json();
      setEmployees(prev => [savedEmp, ...prev]);
      addToast('Employee added successfully', 'success');
      addActivityLog(savedEmp.name, 'added to the directory', 'success');
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Server error. Failed to add employee.', 'error');
      throw err;
    }
  };

  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    // Validation checks
    if (updates.name !== undefined && !updates.name.trim()) {
      addToast('Full Name is required', 'error');
      throw new Error('Name cannot be empty');
    }
    if (updates.basicSalary !== undefined && updates.basicSalary < 0) {
      addToast('Basic Salary cannot be negative', 'error');
      throw new Error('Negative values not allowed');
    }

    try {
      const res = await fetchWithAuth(`${getApiBaseUrl()}/employees/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Server error updating employee');
      }
      const updatedEmp = await res.json();
      setEmployees(prev => prev.map(emp => emp.id === id ? { ...emp, ...updatedEmp } : emp));
      addToast('Employee details updated', 'success');
      addActivityLog(updatedEmp.name, 'profile updated', 'primary');
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Server error. Failed to update employee.', 'error');
      throw err;
    }
  };

  const deleteEmployee = async (id: string) => {
    const target = employees.find(e => e.id === id);
    try {
      const res = await fetchWithAuth(`${getApiBaseUrl()}/employees/${id}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Server error deleting employee');
      }
      // WEAK-4: Remove employee from main list
      setEmployees(prev => prev.filter(emp => emp.id !== id));
      // WEAK-4: Immediately purge all related history from React state so stale
      // records are not visible in Payroll/OT/Daily tabs without a page refresh
      setPayrollHistory(prev => prev.filter(r => r.employeeId !== id));
      setOtHistory(prev => prev.filter(r => r.employeeId !== id));
      setDailyPayrollHistory(prev => prev.filter(r => r.employeeId !== id));
      addToast('Employee removed successfully', 'success');
      if (target) {
        addActivityLog(target.name, 'removed from directory', 'warning');
      }
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Server error. Failed to delete employee.', 'error');
      throw err;
    }
  };

  const removeToast = useCallback((id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info', customId?: string): string => {
    if (!message || !message.trim()) return '';
    const id = customId || (`toast_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
    
    setToasts(prev => {
      // Deduplicate: if the exact same message and type already exists, do not create a duplicate
      const existing = prev.find(t => t.id === id || (t.message === message && t.type === type));
      if (existing) {
        // Reset timer for existing toast
        const oldTimer = toastTimersRef.current.get(existing.id);
        if (oldTimer) clearTimeout(oldTimer);
        const timer = setTimeout(() => {
          removeToast(existing.id);
        }, 4000);
        toastTimersRef.current.set(existing.id, timer);
        return prev;
      }
      return [...prev, { id, message, type }];
    });

    const timer = setTimeout(() => {
      removeToast(id);
    }, 4000);
    toastTimersRef.current.set(id, timer);

    return id;
  }, [removeToast]);

  const logout = async () => {
    try {
      await signOut(auth);
      addToast('Successfully logged out', 'success');
    } catch (error) {
      addToast('Failed to log out', 'error');
    }
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
      // State updates are handled by onAuthStateChanged listener
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        addToast(error.message || 'Authentication failed', 'error');
      }
      throw error;
    }
  };

  const login = async (email?: string, password?: string) => {
    if (email && password) {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        // State updates are handled by onAuthStateChanged listener
      } catch (error: any) {
        let msg = 'Authentication failed';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          msg = 'Invalid email or password. Please try again.';
        } else if (error.message) {
          msg = error.message;
        }
        addToast(msg, 'error');
        throw error;
      }
    } else {
      addToast('Please provide both email and password.', 'warning');
      throw new Error('Missing credentials');
    }
  };

  const signup = async (email?: string, password?: string, fullName?: string) => {
    if (email && password) {
      try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        if (fullName && result.user) {
          await updateProfile(result.user, { displayName: fullName });
        }
        addToast('Account created successfully!', 'success');
      } catch (error: any) {
        let msg = 'Registration failed';
        if (error.code === 'auth/email-already-in-use') {
          msg = 'An account with this email already exists.';
        } else if (error.code === 'auth/weak-password') {
          msg = 'Password should be at least 6 characters.';
        } else if (error.message) {
          msg = error.message;
        }
        addToast(msg, 'error');
        throw error;
      }
    } else {
      addToast('Please provide email and password.', 'warning');
      throw new Error('Missing credentials');
    }
  };

  const resetPassword = async (email: string) => {
    if (email) {
      try {
        await sendPasswordResetEmail(auth, email);
        addToast('Password reset link sent successfully. Please check your email.', 'success');
      } catch (error: any) {
        let msg = 'Failed to send reset link';
        if (error.code === 'auth/user-not-found') {
          msg = 'No account found with this email address.';
        } else if (error.code === 'auth/invalid-email') {
          msg = 'Please enter a valid email address.';
        } else if (error.message) {
          msg = error.message;
        }
        addToast(msg, 'error');
        throw error;
      }
    } else {
      addToast('Please provide an email address.', 'warning');
      throw new Error('Missing email');
    }
  };

  const contextValue = useMemo(() => ({
    employees,
    activityLogs,
    payrollHistory,
    otHistory,
    dailyPayrollHistory,
    toasts,
    isAuthenticated,
    managerProfile,
    authLoading,
    searchQuery,
    setSearchQuery,
    login,
    signup,
    resetPassword,
    loginWithGoogle,
    logout,
    addToast,
    removeToast,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addActivityLog,
    updateEmployeePayroll,
    updateEmployeeOT,
    processBiometricAttendance,
    getAttendanceByDate,
    getAttendanceByMonth,
    processSalary,
    processOTRecord,
    markSalaryPaid,
    saveDailyPayrollRecord,
    saveBulkDailyPayrollRecords,
    markAllLogsRead,
    clearLogs,
    apiBaseUrl: apiBaseUrlState,
    setCustomApiBaseUrl,
    resetApiBaseUrl,
    refreshData,
  }), [employees, activityLogs, payrollHistory, otHistory, dailyPayrollHistory, toasts, isAuthenticated, managerProfile, authLoading, searchQuery, apiBaseUrlState, refreshData]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppContextProvider');
  }
  return context;
};
