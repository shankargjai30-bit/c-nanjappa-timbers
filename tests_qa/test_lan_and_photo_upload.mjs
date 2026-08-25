import { getTestIdToken } from './auth_helper.mjs';
import fs from 'fs';
import path from 'path';

const LAN_IP = '192.168.1.21';
const API_BASE = `http://${LAN_IP}:3000/api`;

console.log(`\n=============================================================`);
console.log(`  TESTING BACKEND OVER LOCAL WI-FI / LAN IP: ${API_BASE}`);
console.log(`=============================================================\n`);

async function run() {
  let token;
  try {
    token = await getTestIdToken();
    console.log(`[PASS] Firebase Auth ID token obtained successfully.`);
  } catch (err) {
    console.error(`[FAIL] Auth error:`, err);
    process.exit(1);
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 1. Health / Employee listing over LAN
  console.log(`\n--- 1. Testing GET /api/employees over LAN IP ---`);
  const empRes = await fetch(`${API_BASE}/employees`, { headers });
  console.log(`Status: ${empRes.status} ${empRes.statusText}`);
  if (!empRes.ok) throw new Error(`GET /api/employees failed: ${empRes.status}`);
  const emps = await empRes.json();
  console.log(`[PASS] Received ${emps.length} existing employees over LAN.`);

  // 2. Photo upload over LAN (Base64 JPEG payload)
  console.log(`\n--- 2. Testing POST /api/upload over LAN IP ---`);
  const testBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  
  const uploadRes = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ file: testBase64 })
  });
  console.log(`Status: ${uploadRes.status} ${uploadRes.statusText}`);
  const uploadJson = await uploadRes.json();
  console.log(`Upload response:`, uploadJson);
  if (!uploadRes.ok || !uploadJson.secure_url) {
    throw new Error(`Photo upload failed: ${JSON.stringify(uploadJson)}`);
  }
  console.log(`[PASS] Photo uploaded successfully! URL: ${uploadJson.secure_url}`);

  // 3. Employee creation with uploaded photo over LAN
  console.log(`\n--- 3. Testing POST /api/employees with uploaded photo over LAN IP ---`);
  const testEmpId = `EMP_LAN_${Date.now()}`;
  const newEmpPayload = {
    id: testEmpId,
    name: 'LAN Test Employee',
    department: 'Processing',
    role: 'Quality Inspector',
    status: 'Active',
    checkIn: '--',
    checkOut: '--',
    verified: false,
    avatarColor: '#10b981',
    presentDays: 0,
    absentDays: 0,
    totalWorkingDays: 26,
    otHours: 0,
    otAmountManual: null,
    basicSalary: 35000,
    allowances: 2500,
    deductions: 500,
    phone: '+91 9876543210',
    email: 'lan.test@example.com',
    joiningDate: '2026-08-24',
    shiftTiming: '09:00 AM - 05:00 PM',
    photo: uploadJson.secure_url
  };

  const createRes = await fetch(`${API_BASE}/employees`, {
    method: 'POST',
    headers,
    body: JSON.stringify(newEmpPayload)
  });
  console.log(`Status: ${createRes.status} ${createRes.statusText}`);
  const createdEmp = await createRes.json();
  if (!createRes.ok || createdEmp.id !== testEmpId) {
    throw new Error(`Employee creation failed: ${JSON.stringify(createdEmp)}`);
  }
  console.log(`[PASS] Employee created successfully over LAN! ID: ${createdEmp.id}, Photo: ${createdEmp.photo}`);

  // 4. Verify employee appears in GET /api/employees and has photo
  console.log(`\n--- 4. Verifying employee retrieval & photo persistence ---`);
  const verifyRes = await fetch(`${API_BASE}/employees`, { headers });
  const verifyList = await verifyRes.json();
  const found = verifyList.find(e => e.id === testEmpId);
  if (!found || found.photo !== uploadJson.secure_url) {
    throw new Error(`Employee photo not found in directory listing!`);
  }
  console.log(`[PASS] Verified employee ${found.name} is present with photo: ${found.photo}`);

  // 5. Attendance check-in over LAN
  console.log(`\n--- 5. Testing Attendance Check-In over LAN ---`);
  const checkInRes = await fetch(`${API_BASE}/attendance`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ employeeId: testEmpId, mode: 'check-in' })
  });
  const checkInJson = await checkInRes.json();
  console.log(`Check-in response:`, checkInJson);
  if (!checkInRes.ok || !checkInJson.success) {
    throw new Error(`Attendance check-in failed: ${JSON.stringify(checkInJson)}`);
  }
  console.log(`[PASS] Attendance check-in succeeded over LAN.`);

  // 6. Attendance check-out over LAN
  console.log(`\n--- 6. Testing Attendance Check-Out over LAN ---`);
  const checkOutRes = await fetch(`${API_BASE}/attendance`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ employeeId: testEmpId, mode: 'check-out' })
  });
  const checkOutJson = await checkOutRes.json();
  console.log(`Check-out response:`, checkOutJson);
  if (!checkOutRes.ok || !checkOutJson.success) {
    throw new Error(`Attendance check-out failed: ${JSON.stringify(checkOutJson)}`);
  }
  console.log(`[PASS] Attendance check-out succeeded over LAN.`);

  // 7. Cleanup test employee over LAN
  console.log(`\n--- 7. Cleanup: Deleting test employee over LAN ---`);
  const delRes = await fetch(`${API_BASE}/employees/${testEmpId}?id=${encodeURIComponent(testEmpId)}`, {
    method: 'DELETE',
    headers
  });
  console.log(`Status: ${delRes.status} ${delRes.statusText}`);
  if (!delRes.ok) throw new Error(`Delete failed: ${delRes.status}`);
  console.log(`[PASS] Test employee cleaned up successfully.`);

  console.log(`\n=============================================================`);
  console.log(`  ALL LAN IP (192.168.1.21:3000) CONNECTIVITY TESTS PASSED!  `);
  console.log(`=============================================================\n`);
}

run().catch(e => {
  console.error('\n[FATAL ERROR IN LAN TEST]:', e);
  process.exit(1);
});
