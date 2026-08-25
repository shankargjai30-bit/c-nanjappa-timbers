import { getTestIdToken } from './auth_helper.mjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3000/api';

const results = [];

function assert(condition, testName, details = '') {
  if (condition) {
    results.push({ name: testName, passed: true, details });
    console.log(`  [PASS] ${testName}`);
  } else {
    results.push({ name: testName, passed: false, details });
    console.error(`  [FAIL] ${testName} - ${details}`);
  }
}

export async function runApiTests() {
  console.log('\n========================================');
  console.log('  RUNNING BACKEND API INTEGRATION SUITE');
  console.log('========================================\n');

  let token;
  try {
    token = await getTestIdToken();
    assert(!!token, 'Auth Token Acquisition', `Token length: ${token.length}`);
  } catch (err) {
    assert(false, 'Auth Token Acquisition', err.message);
    return results;
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 0. Health Check Endpoint
  console.log('\n--- Test Group 0: System Health & Uptime ---');
  const healthRes = await fetch(`${API_BASE}/health`);
  const healthJson = await healthRes.json().catch(() => ({}));
  assert(healthRes.status === 200 && healthJson.status === 'ok', 'Public /api/health returns 200 OK');

  // 1. Auth Middleware Verification
  console.log('\n--- Test Group 1: Auth Middleware Security ---');
  const noAuthRes = await fetch(`${API_BASE}/employees`);
  assert(noAuthRes.status === 401, '401 Unauthorized when missing Authorization header');

  const badTokenRes = await fetch(`${API_BASE}/employees`, {
    headers: { 'Authorization': 'Bearer invalid-token-12345' }
  });
  assert(badTokenRes.status === 403, '403 Forbidden when using invalid token');

  const authedRes = await fetch(`${API_BASE}/employees`, { headers: authHeaders });
  assert(authedRes.status === 200, '200 OK when using valid Firebase ID token');

  // 2. Employee CRUD & Validations
  console.log('\n--- Test Group 2: Employee CRUD & Validation ---');
  const blankIdRes = await fetch(`${API_BASE}/employees`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ id: '   ', name: 'Test Worker' })
  });
  assert(blankIdRes.status === 400, 'Rejects blank employee ID with 400');

  const blankNameRes = await fetch(`${API_BASE}/employees`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ id: 'EMP_QA_01', name: '   ' })
  });
  assert(blankNameRes.status === 400, 'Rejects blank employee name with 400');

  const emp1Payload = {
    id: 'EMP_QA_01',
    name: 'QA Test Master',
    department: 'Cutting',
    role: 'Senior Craftsman',
    status: 'Absent',
    checkIn: '--',
    checkOut: '--',
    verified: false,
    basicSalary: 25000,
    allowances: 2000,
    deductions: 500,
    presentDays: 0,
    absentDays: 26,
    totalWorkingDays: 26,
    otHours: 0,
    phone: '9876543210',
    email: 'qa.master@timberpro.test'
  };

  const createEmp1Res = await fetch(`${API_BASE}/employees`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(emp1Payload)
  });
  assert(createEmp1Res.status === 200, 'Successfully created Employee 1');

  const emp2Payload = {
    id: 'EMP_QA_02',
    name: 'QA Second Worker',
    department: 'Polishing',
    role: 'Finisher',
    status: 'Absent',
    checkIn: '--',
    checkOut: '--',
    verified: false,
    basicSalary: 18000,
    allowances: 1000,
    deductions: 0,
    presentDays: 0,
    absentDays: 26,
    totalWorkingDays: 26,
    otHours: 0
  };

  const createEmp2Res = await fetch(`${API_BASE}/employees`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(emp2Payload)
  });
  assert(createEmp2Res.status === 200, 'Successfully created Employee 2');

  const listEmpsRes = await fetch(`${API_BASE}/employees`, { headers: authHeaders });
  const empsList = await listEmpsRes.json();
  assert(empsList.some(e => e.id === 'EMP_QA_01') && empsList.some(e => e.id === 'EMP_QA_02'), 'GET /api/employees returns both created employees');

  // Update employee
  const updateEmpRes = await fetch(`${API_BASE}/employees/EMP_QA_01`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ phone: '9999888877', role: 'Lead Craftsman' })
  });
  const updatedEmp = await updateEmpRes.json();
  assert(updatedEmp.phone === '9999888877' && updatedEmp.role === 'Lead Craftsman', 'PUT /api/employees/:id correctly updates employee fields');

  // 3. Attendance Mode Enforcement & State Machine
  console.log('\n--- Test Group 3: Attendance Mode State Machine & Strict Mode Control ---');
  
  // Test A: Missing mode parameter
  const noModeRes = await fetch(`${API_BASE}/attendance`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ employeeId: 'EMP_QA_01' })
  });
  assert(noModeRes.status === 400, 'Rejects attendance request without mode parameter');

  // Test B: Invalid mode parameter
  const badModeRes = await fetch(`${API_BASE}/attendance`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ employeeId: 'EMP_QA_01', mode: 'auto-toggle' })
  });
  assert(badModeRes.status === 400, 'Rejects invalid mode parameter');

  // Test C: Scenario E - Attempt Check-Out for employee not checked in
  const invalidCheckOutRes = await fetch(`${API_BASE}/attendance`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ employeeId: 'EMP_QA_02', mode: 'check-out' })
  });
  const invalidCheckOutData = await invalidCheckOutRes.json();
  assert(invalidCheckOutData.success === false && invalidCheckOutData.error === 'Cannot check out before checking in.',
    'Scenario E: Check-Out Mode rejected when employee not checked in', invalidCheckOutData.error);

  // Test D: Scenario A - Valid Check-In
  const checkInRes = await fetch(`${API_BASE}/attendance`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ employeeId: 'EMP_QA_01', mode: 'check-in' })
  });
  const checkInData = await checkInRes.json();
  assert(checkInData.success === true && checkInData.action === 'check-in' && ['Present', 'Half Day'].includes(checkInData.employee.status),
    'Scenario A: Check-In Mode marks employee as Present / Half Day', JSON.stringify(checkInData));

  // Test E: Scenario B - Repeat Check-In (must NOT check out)
  const repeatCheckInRes = await fetch(`${API_BASE}/attendance`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ employeeId: 'EMP_QA_01', mode: 'check-in' })
  });
  const repeatCheckInData = await repeatCheckInRes.json();
  assert(repeatCheckInData.success === false && repeatCheckInData.error === 'Already checked in. Select Check Out Mode to check out.',
    'Scenario B: Repeat Check-In blocked with explicit error message', repeatCheckInData.error);

  // Verify employee is STILL checked in and NOT checked out
  const empCheckState = await prisma.attendanceRecord.findFirst({ where: { employeeId: 'EMP_QA_01' } });
  assert(empCheckState && empCheckState.checkIn && (!empCheckState.checkOut || empCheckState.checkOut === '--'),
    'Database Verification: Employee remains checked in and was NOT auto checked out');

  // Test F: Scenario C - Valid Check-Out
  const checkOutRes = await fetch(`${API_BASE}/attendance`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ employeeId: 'EMP_QA_01', mode: 'check-out' })
  });
  const checkOutData = await checkOutRes.json();
  assert(checkOutData.success === true && checkOutData.action === 'check-out' && checkOutData.record.checkOut !== '--',
    'Scenario C: Check-Out Mode records valid checkOut time', JSON.stringify(checkOutData));

  // Test G: Scenario D - Repeat Check-Out (must NOT check in)
  const repeatCheckOutRes = await fetch(`${API_BASE}/attendance`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ employeeId: 'EMP_QA_01', mode: 'check-out' })
  });
  const repeatCheckOutData = await repeatCheckOutRes.json();
  assert(repeatCheckOutData.success === false && repeatCheckOutData.error === 'Attendance already completed for today.',
    'Scenario D: Repeat Check-Out blocked with attendance completed message', repeatCheckOutData.error);

  // 4. Overtime (OT) Operations
  console.log('\n--- Test Group 4: OT Management Workflow ---');
  const monthStr = new Date().toISOString().slice(0, 7);
  const otRecordPayload = {
    id: `OT_EMP_QA_01_${monthStr}`,
    employeeId: 'EMP_QA_01',
    employeeName: 'QA Test Master',
    department: 'Cutting',
    role: 'Lead Craftsman',
    month: monthStr,
    otHours: 5,
    otHourlyRate: 150,
    calculatedAmount: 750,
    bonusAmount: 100,
    deductionAmount: 0,
    finalAmount: 850,
    status: 'Approved',
    approvedBy: 'Operations Manager',
    approvalTime: new Date().toISOString()
  };

  const otRes = await fetch(`${API_BASE}/ot`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(otRecordPayload)
  });
  assert(otRes.status === 200, 'POST /api/ot processes and approves OT record');

  const getOtRes = await fetch(`${API_BASE}/ot`, { headers: authHeaders });
  const otList = await getOtRes.json();
  assert(otList.some(r => r.id === `OT_EMP_QA_01_${monthStr}` && r.status === 'Approved'), 'GET /api/ot returns approved OT record');

  // 5. Daily Payroll Workflow
  console.log('\n--- Test Group 5: Daily Payroll Records ---');
  const dateToday = new Date().toISOString().split('T')[0];
  const dailyPayrollPayload = {
    id: `DP_EMP_QA_01_${dateToday}`,
    employeeId: 'EMP_QA_01',
    date: dateToday,
    attendanceStatus: 'Present',
    dailyWage: 961.54,
    bonus: 50,
    deduction: 0,
    finalAmount: 1011.54,
    createdBy: 'Manager',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const dailyPayRes = await fetch(`${API_BASE}/daily-payroll`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(dailyPayrollPayload)
  });
  assert(dailyPayRes.status === 200, 'POST /api/daily-payroll saves daily payroll record');

  // 6. Monthly Payroll Record Workflow
  console.log('\n--- Test Group 6: Monthly Payroll Workflow & State Transitions ---');
  const draftPayrollPayload = {
    id: `PR_EMP_QA_01_${monthStr}`,
    employeeId: 'EMP_QA_01',
    employeeName: 'QA Test Master',
    department: 'Cutting',
    role: 'Lead Craftsman',
    month: monthStr,
    basicSalary: 25000,
    otHours: 5,
    otAmount: 850,
    allowances: 2000,
    deductions: 500,
    netPay: 27350,
    status: 'Draft',
    presentDays: 1,
    totalWorkingDays: 26
  };

  // Step 1: Create Draft
  const draftPayRes = await fetch(`${API_BASE}/payroll`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(draftPayrollPayload)
  });
  assert(draftPayRes.status === 200, 'POST /api/payroll creates new Draft record');

  // Step 2: Transition Draft -> Approved
  const approvePayRes = await fetch(`${API_BASE}/payroll`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      id: `PR_EMP_QA_01_${monthStr}`,
      status: 'Approved',
      approvedBy: 'General Manager',
      approvalTime: new Date().toISOString()
    })
  });
  assert(approvePayRes.status === 200, 'POST /api/payroll approves Draft payroll record');

  // Step 3: Transition Approved -> Paid
  const paidPayRes = await fetch(`${API_BASE}/payroll`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      id: `PR_EMP_QA_01_${monthStr}`,
      status: 'Paid'
    })
  });
  assert(paidPayRes.status === 200, 'POST /api/payroll marks Approved record as Paid');

  // Step 4: Reject invalid transition Paid -> Approved
  const invalidTransitionRes = await fetch(`${API_BASE}/payroll`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      id: `PR_EMP_QA_01_${monthStr}`,
      status: 'Approved'
    })
  });
  assert(invalidTransitionRes.status === 403, 'POST /api/payroll rejects illegal status transition (Paid -> Approved) with 403');

  // 7. Activity Logs
  console.log('\n--- Test Group 7: Activity Logs ---');
  const logPayload = {
    id: `LOG_${Date.now()}`,
    employeeName: 'QA Test Master',
    action: 'checked in via biometrics',
    timestamp: Date.now(),
    type: 'success',
    read: false
  };

  const logRes = await fetch(`${API_BASE}/logs`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(logPayload)
  });
  assert(logRes.status === 200, 'POST /api/logs creates activity log');

  const readAllRes = await fetch(`${API_BASE}/logs/read-all`, {
    method: 'PUT',
    headers: authHeaders
  });
  assert(readAllRes.status === 200, 'PUT /api/logs/read-all marks logs read');

  // 8. Cleanup & Cascade Integrity
  console.log('\n--- Test Group 8: Data Integrity & Cascade Cleanup ---');
  const delEmp1 = await fetch(`${API_BASE}/employees/EMP_QA_01?id=EMP_QA_01`, {
    method: 'DELETE',
    headers: authHeaders
  });
  assert(delEmp1.status === 200, 'DELETE /api/employees/EMP_QA_01 cleans up employee');

  const delEmp2 = await fetch(`${API_BASE}/employees/EMP_QA_02?id=EMP_QA_02`, {
    method: 'DELETE',
    headers: authHeaders
  });
  assert(delEmp2.status === 200, 'DELETE /api/employees/EMP_QA_02 cleans up second employee');

  // Verify DB is clean
  const orphanAtt = await prisma.attendanceRecord.count({ where: { employeeId: { in: ['EMP_QA_01', 'EMP_QA_02'] } } });
  const orphanOt = await prisma.oTRecord.count({ where: { employeeId: { in: ['EMP_QA_01', 'EMP_QA_02'] } } });
  const orphanPay = await prisma.payrollRecord.count({ where: { employeeId: { in: ['EMP_QA_01', 'EMP_QA_02'] } } });
  const orphanDaily = await prisma.dailyPayroll.count({ where: { employeeId: { in: ['EMP_QA_01', 'EMP_QA_02'] } } });

  assert(orphanAtt === 0, 'Cascade Check: 0 orphan attendance records left');
  assert(orphanOt === 0, 'Cascade Check: 0 orphan OT records left');
  assert(orphanPay === 0, 'Cascade Check: 0 orphan Payroll records left');
  assert(orphanDaily === 0, 'Cascade Check: 0 orphan Daily Payroll records left');

  await prisma.$disconnect();
  return results;
}

if (process.argv[1].endsWith('test_api_integration.mjs')) {
  runApiTests().then(res => {
    const passed = res.filter(r => r.passed).length;
    const failed = res.filter(r => !r.passed).length;
    console.log(`\nAPI Suite Summary: Total: ${res.length} | Passed: ${passed} | Failed: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
  }).catch(e => {
    console.error('Fatal test error:', e);
    process.exit(1);
  });
}
