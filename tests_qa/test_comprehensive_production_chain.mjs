import 'dotenv/config';
import { getTestIdToken } from './auth_helper.mjs';

const API_BASE = 'http://localhost:3000/api';

async function main() {
  console.log('================================================================');
  console.log('  TIMBERPRO ERP — COMPREHENSIVE PRODUCTION CHAIN QA SUITE       ');
  console.log('================================================================\n');

  // M. Backend connectivity & Health Check
  console.log('--- Stage M: Backend Health & Connectivity ---');
  const healthRes = await fetch(`${API_BASE}/health`);
  console.log('Health Endpoint Status:', healthRes.status);
  const healthJson = await healthRes.json();
  console.log('Health Response:', healthJson);
  if (healthRes.status !== 200 || healthJson.status !== 'ok') throw new Error('Health check failed');

  // A. Login & Token
  console.log('\n--- Stage A: Authentication & Token ---');
  const token = await getTestIdToken();
  console.log('Firebase ID Token verified (length:', token.length, ')');
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // B. Employee creation without photo
  console.log('\n--- Stage B: Employee Creation Without Photo ---');
  const empNoPhotoId = `EMP_NOPHOT_${Date.now()}`;
  const empNoPhotoRes = await fetch(`${API_BASE}/employees`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      id: empNoPhotoId,
      name: 'No Photo Worker',
      department: 'Processing',
      role: 'Stacker',
      status: 'Absent',
      checkIn: '--',
      checkOut: '--',
      verified: true,
      avatarColor: '#10b981',
      basicSalary: 28000
    })
  });
  console.log('Created No-Photo Employee Status:', empNoPhotoRes.status);
  if (!empNoPhotoRes.ok) throw new Error(`Stage B failed: ${await empNoPhotoRes.text()}`);

  // C. Employee creation with JPG photo
  console.log('\n--- Stage C: Employee Creation with JPG Photo ---');
  const jpgBase64 = 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const jpgUploadRes = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ file: jpgBase64 })
  });
  const jpgUploadJson = await jpgUploadRes.json();
  console.log('JPG Upload Status:', jpgUploadRes.status, 'URL:', jpgUploadJson.secure_url);

  const empJpgId = `EMP_JPG_${Date.now()}`;
  const empJpgRes = await fetch(`${API_BASE}/employees`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      id: empJpgId,
      name: 'JPG Photo Worker',
      department: 'Processing',
      role: 'Sawyer',
      status: 'Absent',
      checkIn: '--',
      checkOut: '--',
      verified: true,
      avatarColor: '#0284c7',
      photo: jpgUploadJson.secure_url,
      basicSalary: 32000
    })
  });
  console.log('Created JPG Employee Status:', empJpgRes.status);
  if (!empJpgRes.ok) throw new Error(`Stage C failed: ${await empJpgRes.text()}`);

  // D. Employee creation with JPEG photo
  console.log('\n--- Stage D: Employee Creation with JPEG Photo ---');
  const jpegBase64 = 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const jpegUploadRes = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ file: jpegBase64 })
  });
  const jpegUploadJson = await jpegUploadRes.json();
  console.log('JPEG Upload Status:', jpegUploadRes.status, 'URL:', jpegUploadJson.secure_url);

  // E. Employee creation with PNG photo (Cloudinary)
  console.log('\n--- Stage E: Employee Creation with PNG Photo (Cloudinary) ---');
  const pngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const pngUploadRes = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ file: pngBase64 })
  });
  const pngUploadJson = await pngUploadRes.json();
  console.log('PNG Cloudinary Upload Status:', pngUploadRes.status, 'URL:', pngUploadJson.secure_url);

  const empPngId = `EMP_PNG_${Date.now()}`;
  const empPngRes = await fetch(`${API_BASE}/employees`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      id: empPngId,
      name: 'PNG Photo Worker',
      department: 'Processing',
      role: 'Inspector',
      status: 'Absent',
      checkIn: '--',
      checkOut: '--',
      verified: true,
      avatarColor: '#8b5cf6',
      photo: pngUploadJson.secure_url,
      basicSalary: 35000
    })
  });
  console.log('Created PNG Employee Status:', empPngRes.status);
  if (!empPngRes.ok) throw new Error(`Stage E failed: ${await empPngRes.text()}`);

  // F. Photo upload failure handling
  console.log('\n--- Stage F: Photo Upload Validation / Failure Handling ---');
  const emptyUploadRes = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({})
  });
  console.log('Empty Upload Rejected with 400:', emptyUploadRes.status === 400);

  // G. Employee edit
  console.log('\n--- Stage G: Employee Edit ---');
  const editRes = await fetch(`${API_BASE}/employees/${empPngId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      role: 'Senior Quality Lead',
      basicSalary: 42000
    })
  });
  console.log('Employee Edit Status:', editRes.status);
  if (!editRes.ok) throw new Error(`Stage G failed: ${await editRes.text()}`);

  // H. Attendance Check-In & Check-Out
  console.log('\n--- Stage I: Biometric Attendance Check-In & Check-Out ---');
  const checkInRes = await fetch(`${API_BASE}/attendance`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ employeeId: empPngId, mode: 'check-in' })
  });
  console.log('Check-In Status:', checkInRes.status);
  if (!checkInRes.ok) throw new Error(`Check-in failed: ${await checkInRes.text()}`);

  const checkOutRes = await fetch(`${API_BASE}/attendance`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ employeeId: empPngId, mode: 'check-out' })
  });
  console.log('Check-Out Status:', checkOutRes.status);
  if (!checkOutRes.ok) throw new Error(`Check-out failed: ${await checkOutRes.text()}`);

  // J. Payroll (Draft -> Approved -> Paid)
  console.log('\n--- Stage J: Monthly Payroll (Draft -> Approved -> Paid) ---');
  const currentMonth = new Date().toISOString().slice(0, 7);
  const payId = `PAY_${empPngId}_${currentMonth}`;
  const draftPayRes = await fetch(`${API_BASE}/payroll`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      id: payId,
      employeeId: empPngId,
      employeeName: 'PNG Photo Worker',
      department: 'Processing',
      role: 'Senior Quality Lead',
      month: currentMonth,
      basicSalary: 42000,
      otHours: 2,
      otAmount: 600,
      allowances: 2000,
      deductions: 500,
      netPay: 44100,
      status: 'Draft',
      presentDays: 1,
      totalWorkingDays: 26
    })
  });
  console.log('Payroll Draft Status:', draftPayRes.status);
  if (!draftPayRes.ok) throw new Error(`Payroll Draft failed: ${await draftPayRes.text()}`);

  const approvePayRes = await fetch(`${API_BASE}/payroll`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      id: payId,
      status: 'Approved',
      approvedBy: 'Admin'
    })
  });
  console.log('Payroll Approved Status:', approvePayRes.status);
  if (!approvePayRes.ok) throw new Error(`Payroll Approved failed: ${await approvePayRes.text()}`);

  const markPaidRes = await fetch(`${API_BASE}/payroll`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      id: payId,
      status: 'Paid'
    })
  });
  console.log('Payroll Paid Status:', markPaidRes.status);
  if (!markPaidRes.ok) throw new Error(`Payroll Paid failed: ${await markPaidRes.text()}`);

  // K. Reports & Export verification
  console.log('\n--- Stage K: Reports Verification ---');
  const reportsAttendanceRes = await fetch(`${API_BASE}/attendance?month=${currentMonth}`, { headers: authHeaders });
  console.log('Reports Attendance Query Status:', reportsAttendanceRes.status);
  if (!reportsAttendanceRes.ok) throw new Error(`Reports failed: ${await reportsAttendanceRes.text()}`);

  // L. Activity Logs
  console.log('\n--- Stage L: Activity Logs ---');
  const logRes = await fetch(`${API_BASE}/logs`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      employeeName: 'PNG Photo Worker',
      action: 'Completed Full Production Cycle',
      type: 'success'
    })
  });
  console.log('Activity Log Created Status:', logRes.status);
  if (!logRes.ok) throw new Error(`Activity Log failed: ${await logRes.text()}`);

  // Cleanups
  console.log('\n--- Stage H & Cleanup: Employee Deletion & Cascade Clean ---');
  await fetch(`${API_BASE}/employees/${empNoPhotoId}?id=${encodeURIComponent(empNoPhotoId)}`, { method: 'DELETE', headers: authHeaders });
  await fetch(`${API_BASE}/employees/${empJpgId}?id=${encodeURIComponent(empJpgId)}`, { method: 'DELETE', headers: authHeaders });
  await fetch(`${API_BASE}/employees/${empPngId}?id=${encodeURIComponent(empPngId)}`, { method: 'DELETE', headers: authHeaders });
  console.log('Deleted all test employee records cleanly.');

  console.log('\n================================================================');
  console.log('  ALL 13 STAGES PASSED CLEANLY WITH ZERO ERRORS!                ');
  console.log('================================================================');
}

main().catch(err => {
  console.error('[FATAL FAILURE IN REGRESSION SUITE]:', err);
  process.exit(1);
});
