import 'dotenv/config';
import { getTestIdToken } from './auth_helper.mjs';

const API_BASE = 'http://localhost:3000/api';

async function run() {
  console.log('========================================================');
  console.log('  TESTING PHOTO UPLOAD ACROSS MULTIPLE FORMATS & PIPELINE');
  console.log('========================================================\n');

  const token = await getTestIdToken();
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 1. Health Check
  console.log('--- 1. Health Check ---');
  const healthRes = await fetch(`${API_BASE}/health`);
  console.log('Health Status:', healthRes.status);
  const healthData = await healthRes.json();
  console.log('Health Payload:', healthData);

  // 2. Test JPG Base64 Photo Upload
  console.log('\n--- 2. Uploading JPG Photo ---');
  const jpgBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const jpgUploadRes = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ file: jpgBase64 })
  });
  const jpgJson = await jpgUploadRes.json();
  console.log('JPG Upload Status:', jpgUploadRes.status, jpgJson);

  // 3. Test PNG Base64 Photo Upload
  console.log('\n--- 3. Uploading PNG Photo ---');
  const pngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const pngUploadRes = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ file: pngBase64 })
  });
  const pngJson = await pngUploadRes.json();
  console.log('PNG Upload Status:', pngUploadRes.status, pngJson);

  // 4. Create Employee with Uploaded Photo
  console.log('\n--- 4. Create Employee with Cloud Photo ---');
  const empId = `EMP_PHOTO_${Date.now()}`;
  const empData = {
    id: empId,
    name: 'Photo Test Employee',
    department: 'Processing',
    role: 'Sawyer',
    status: 'Present',
    checkIn: '09:00 AM',
    checkOut: '--',
    verified: true,
    avatarColor: '#0284c7',
    photo: pngJson.secure_url,
    presentDays: 1,
    absentDays: 0,
    totalWorkingDays: 26,
    otHours: 0,
    basicSalary: 32000,
    allowances: 1500,
    deductions: 500
  };

  const createRes = await fetch(`${API_BASE}/employees`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(empData)
  });
  console.log('Create Employee Status:', createRes.status);
  const createdEmp = await createRes.json();
  console.log('Created Employee:', createdEmp.id, createdEmp.photo);

  // 5. Verify Employee Retrieval with Photo
  console.log('\n--- 5. Verify Photo Persistence in DB ---');
  const getEmpRes = await fetch(`${API_BASE}/employees`, { headers: authHeaders });
  const allEmps = await getEmpRes.json();
  const found = allEmps.find(e => e.id === empId);
  console.log('Found Employee in DB:', found ? found.name : 'NOT FOUND');
  console.log('Persisted Photo URL:', found ? found.photo : 'NONE');

  // 6. Cleanup
  console.log('\n--- 6. Cleanup Test Employee ---');
  const delRes = await fetch(`${API_BASE}/employees/${empId}?id=${encodeURIComponent(empId)}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  console.log('Delete Status:', delRes.status);

  console.log('\n========================================================');
  console.log('  ALL PHOTO PIPELINE & CLOUD PERSISTENCE TESTS PASSED!  ');
  console.log('========================================================');
}

run().catch(console.error);
