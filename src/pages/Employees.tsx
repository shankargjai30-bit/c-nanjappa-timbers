import React, { useState, useMemo } from 'react';
import { MoreVertical, Search, Filter, Plus, X, Users, AlertTriangle, Edit2, Trash2, UploadCloud } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Employee } from '../context/AppContext';
import employeesBg from '../assets/dashboard-backgrounds/employees-bg.webp';
import './Employees.css';

export default function Employees() {
  const { employees, addEmployee, updateEmployee, deleteEmployee, payrollHistory, otHistory, toasts, addToast } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Employee>>({});

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            emp.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = filterDepartment ? emp.department === filterDepartment : true;
      const matchesStatus = filterStatus ? emp.status === filterStatus : true;
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [employees, searchQuery, filterDepartment, filterStatus]);

  const departments = Array.from(new Set(employees.map(e => e.department))).filter(Boolean);

  const openAddModal = () => {
    setModalMode('add');
    setFormData({
      name: '',
      department: '',
      role: '',
      phone: '',
      email: '',
      joiningDate: '',
      shiftTiming: '',
      paymentType: 'Daily Wage Worker',
      basicSalary: 0,
      faceBiometricId: '',
      status: 'Active',
      photo: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setModalMode('edit');
    setSelectedEmployee(emp);
    setFormData({ ...emp });
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const openDeleteModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    setIsDeleteModalOpen(true);
    setActiveMenuId(null);
  };

  const closeModals = () => {
    setIsModalOpen(false);
    setIsDeleteModalOpen(false);
    setSelectedEmployee(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let finalValue = value;
    if (type === 'number') {
      if (value.length > 1 && value.startsWith('0') && !value.startsWith('0.')) {
        finalValue = value.replace(/^0+/, '') || '0';
      }
    }
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.match('image/jpeg') && !file.type.match('image/png')) {
        addToast('Please upload a JPG or PNG image.', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        addToast('Image size must be less than 5MB.', 'error');
        return;
      }
      
      addToast('Uploading image...', 'info');
      
      try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
          try {
            const base64data = reader.result;
            const res = await fetch('http://localhost:3000/api/upload', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ file: base64data })
            });
            
            const json = await res.json();
            
            if (res.ok && json.secure_url) {
              setFormData(prev => ({ ...prev, photo: json.secure_url }));
              addToast('Photo uploaded successfully!', 'success');
            } else {
              throw new Error(json.error || "Failed to upload");
            }
          } catch (err: any) {
            console.error("Upload error:", err);
            addToast(err.message || 'Cloud upload failed. Please try again.', 'error');
          }
        };
      } catch (err: any) {
        console.error("File reading error:", err);
        addToast('Failed to read image file.', 'error');
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const salary = Number(formData.basicSalary) || 0;
    if (salary < 0) {
      addToast('Basic Salary cannot be negative', 'error');
      return;
    }
    if (salary > 999999999) {
      addToast('Basic Salary cannot exceed 999,999,999', 'error');
      return;
    }

    try {
      if (modalMode === 'add') {
        await addEmployee(formData);
      } else if (modalMode === 'edit' && selectedEmployee) {
        await updateEmployee(selectedEmployee.id, formData);
      }
      closeModals();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedEmployee) {
      deleteEmployee(selectedEmployee.id);
    }
    closeModals();
  };

  const toggleActionMenu = (id: string) => {
    setActiveMenuId(prev => prev === id ? null : id);
  };

  return (
    <>
      <div className="dashboard-bg-wrapper" style={{ backgroundImage: `url(${employeesBg})` }}></div>
      <div className="dashboard-bg-overlay"></div>
      <div className="employees-page" style={{ position: 'relative', zIndex: 1 }}>
        <div className="page-header">
        <div>
          <h1 className="page-title">Employee Directory</h1>
          <p className="page-subtitle">Manage staff, roles, and attendance records</p>
        </div>
        <button className="btn-primary" onClick={openAddModal}>
          <Plus size={18} />
          Add Employee
        </button>
      </div>

      {toasts && toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(toast => (
            <div key={toast.id} className={`toast ${toast.type}`}>
              {toast.message}
            </div>
          ))}
        </div>
      )}

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
          <div className="toolbar-actions relative">
            <button className="btn-outline" onClick={() => setIsFilterOpen(!isFilterOpen)}>
              <Filter size={18} />
              Filter { (filterDepartment || filterStatus) && '•' }
            </button>
            {isFilterOpen && (
              <div className="filter-popover">
                <div className="form-group">
                  <label>Department</label>
                  <select value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)}>
                    <option value="">All Departments</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    {!departments.includes('Operations') && <option value="Operations">Operations</option>}
                    {!departments.includes('HR') && <option value="HR">HR</option>}
                    {!departments.includes('Logistics') && <option value="Logistics">Logistics</option>}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="">All Statuses</option>
                    <option value="Present">Present</option>
                    <option value="Half Day">Half Day</option>
                    <option value="Absent">Absent</option>
                  </select>
                </div>
                <button className="btn-outline" onClick={() => { setFilterDepartment(''); setFilterStatus(''); }}>Clear Filters</button>
              </div>
            )}
          </div>
        </div>

        <div className="table-responsive" style={{ minHeight: '300px' }}>
          {filteredEmployees.length === 0 ? (
            <div className="empty-state">
              <Users size={48} />
              <p>No employees added yet</p>
              <button className="btn-primary" onClick={openAddModal}>
                <Plus size={18} />
                Add Employee
              </button>
            </div>
          ) : (
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>ID</th>
                  <th>Department</th>
                  <th>Check In/Out</th>
                  <th>OT Hours</th>
                  <th>Biometrics</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id}>
                    <td>
                      <div className="employee-cell">
                        {emp.photo ? (
                           <img src={emp.photo} alt={emp.name} className="employee-avatar" style={{ objectFit: 'cover' }} />
                        ) : (
                           <div className="employee-avatar" style={{ backgroundColor: emp.avatarColor || 'var(--primary-light)' }}>
                             {emp.name.charAt(0)}
                           </div>
                        )}
                        <div className="employee-details">
                          <span className="employee-name">{emp.name}</span>
                          <span className="employee-role">{emp.role}</span>
                        </div>
                      </div>
                    </td>
                    <td><span className="text-muted">{emp.id}</span></td>
                    <td>{emp.department}</td>
                    <td>
                      <div className="time-cell">
                        <span className="check-in text-success">{emp.checkIn || '--'}</span>
                        <span className="separator">-</span>
                        <span className="check-out text-muted">{emp.checkOut || '--'}</span>
                      </div>
                    </td>
                    <td>{emp.otHours || 0}h</td>
                    <td>
                      {emp.verified ? (
                        <span className="badge badge-success">Verified</span>
                      ) : (
                        <span className="badge badge-warning">Pending</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-pill ${emp.status.toLowerCase().replace(' ', '-')}`}>
                        {emp.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-menu-container">
                        <button className="action-btn" onClick={() => toggleActionMenu(emp.id)}>
                          <MoreVertical size={18} />
                        </button>
                        {activeMenuId === emp.id && (
                          <div className="action-menu">
                            <button className="action-menu-item" onClick={() => openEditModal(emp)}>
                              <Edit2 size={16} /> Edit
                            </button>
                            <button className="action-menu-item danger" onClick={() => openDeleteModal(emp)}>
                              <Trash2 size={16} /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {filteredEmployees.length > 0 && (
          <div className="table-pagination">
            <span className="text-muted text-sm">Showing 1 to {filteredEmployees.length} entries</span>
            <div className="pagination-controls">
              <button className="page-btn disabled">Previous</button>
              <button className="page-btn active">1</button>
              <button className="page-btn disabled">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{modalMode === 'add' ? 'Add Employee' : 'Edit Employee'}</h2>
              <button className="modal-close" onClick={closeModals}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form id="employee-form" onSubmit={handleFormSubmit} className="form-grid">
                {modalMode === 'add' && (
                  <div className="form-group">
                    <label>Employee ID (Optional)</label>
                    <input type="text" name="id" value={formData.id || ''} onChange={handleFormChange} placeholder="Auto-generated if empty" />
                  </div>
                )}
                <div className="form-group">
                  <label>Full Name *</label>
                  <input type="text" name="name" value={formData.name || ''} onChange={handleFormChange} required />
                </div>
                <div className="form-group">
                  <label>Department *</label>
                  <input type="text" name="department" value={formData.department || ''} onChange={handleFormChange} required />
                </div>
                <div className="form-group">
                  <label>Designation (Role) *</label>
                  <input type="text" name="role" value={formData.role || ''} onChange={handleFormChange} required />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="tel" name="phone" value={formData.phone || ''} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input type="email" name="email" value={formData.email || ''} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label>Joining Date</label>
                  <input type="date" name="joiningDate" value={formData.joiningDate || ''} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label>Shift Timing</label>
                  <input type="text" name="shiftTiming" placeholder="e.g. 09:00 AM - 06:00 PM" value={formData.shiftTiming || ''} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label>Payment Type *</label>
                  <select name="paymentType" value={formData.paymentType || 'Daily Wage Worker'} onChange={handleFormChange} required>
                    <option value="Daily Wage Worker">Daily Wage Worker</option>
                    <option value="Monthly Salary Worker">Monthly Salary Worker</option>
                    <option value="Contract Worker">Contract Worker</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Basic Salary (₹) (Optional)</label>
                  <input type="number" name="basicSalary" min="0" max="999999999" value={formData.basicSalary !== undefined ? formData.basicSalary : ''} onFocus={(e) => e.target.select()} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label>Face Biometric ID</label>
                  <input type="text" name="faceBiometricId" value={formData.faceBiometricId || ''} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select name="status" value={formData.status || 'Present'} onChange={handleFormChange}>
                    <option value="Present">Present</option>
                    <option value="Half Day">Half Day</option>
                    <option value="Absent">Absent</option>
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Upload Employee Photo</label>
                  <div className="photo-upload-container">
                    <input type="file" id="photo-upload" accept="image/jpeg, image/png, image/jpg" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                    <label htmlFor="photo-upload" className="upload-box">
                      {formData.photo ? (
                        <div className="upload-preview">
                          <img src={formData.photo} alt="Preview" />
                          <div className="upload-overlay">
                            <UploadCloud size={24} />
                            <span>Change Photo</span>
                          </div>
                        </div>
                      ) : (
                        <div className="upload-placeholder">
                          <UploadCloud size={32} />
                          <span>Drag & drop or click to upload</span>
                          <small>JPG, JPEG, PNG</small>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={closeModals}>Cancel</button>
              <button type="submit" form="employee-form" className="btn-primary">
                {modalMode === 'add' ? 'Save Employee' : 'Update Details'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedEmployee && (() => {
        const relatedPayrollCount = payrollHistory ? payrollHistory.filter(r => r.employeeId === selectedEmployee.id).length : 0;
        const relatedOTCount = otHistory ? otHistory.filter(r => r.employeeId === selectedEmployee.id).length : 0;
        return (
          <div className="modal-overlay" onClick={closeModals}>
            <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title flex items-center gap-2">
                  <AlertTriangle color="var(--warning)" size={24} />
                  Confirm Removal
                </h2>
                <button className="modal-close" onClick={closeModals}><X size={20} /></button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: '0.75rem' }}>Are you sure you want to remove <strong>{selectedEmployee.name}</strong> (ID: {selectedEmployee.id})?</p>
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.9rem', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span>Payroll Records:</span>
                    <strong>{relatedPayrollCount}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>OT Records:</span>
                    <strong>{relatedOTCount}</strong>
                  </div>
                </div>
                <p className="text-muted text-sm">This action cannot be undone and will automatically cascade-delete all related records from the system.</p>
              </div>
              <div className="modal-footer">
                <button className="btn-outline" onClick={closeModals}>Cancel</button>
                <button className="btn-primary" style={{ backgroundColor: 'var(--danger)' }} onClick={handleDeleteConfirm}>
                  Remove Employee
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      </div>
    </>
  );
}
