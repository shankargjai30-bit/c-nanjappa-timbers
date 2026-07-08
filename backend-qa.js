import { spawn } from 'child_process';

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

// ES module polyfills for require
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = "AIzaSyAJ-tzX4jxRIYG_jJpURN43riIfvLWgTvA";
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}/api`;

const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, 'server/firebase-service-account.json'), 'utf8'));

// Initialize Firebase Admin purely to mint a custom token
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const issues = [];
let idToken = '';

async function getAuthToken() {
  console.log("Generating custom token for QA user...");
  const customToken = await getAuth().createCustomToken('qa-tester-id');
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  const data = await res.json();
  if (!data.idToken) throw new Error("Failed to exchange custom token");
  return data.idToken;
}

async function runTests() {
  idToken = await getAuthToken();
  console.log("Token obtained. Starting server...");

  const server = spawn('node', ['server/index.js']);
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log("--- Starting API & Security Tests ---");

  // 1. Security Tests
  let res = await fetch(`${BASE_URL}/employees`);
  if (res.status !== 401) issues.push({ severity: 'High', module: 'Auth', desc: `Missing token returned ${res.status} instead of 401` });

  res = await fetch(`${BASE_URL}/employees`, { headers: { 'Authorization': 'Bearer invalid_token_123' } });
  if (res.status !== 403) issues.push({ severity: 'High', module: 'Auth', desc: `Invalid token returned ${res.status} instead of 403` });

  // 2. Database Integrity & CRUD (Employees)
  const headers = { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' };
  
  const empData = {
    id: `QA-EMP-${Date.now()}`,
    name: 'QA Test Employee',
    department: 'QA',
    role: 'Tester',
    status: 'Active',
    checkIn: '09:00 AM',
    checkOut: '05:00 PM',
    verified: true,
    presentDays: 0,
    absentDays: 0,
    totalWorkingDays: 0,
    otHours: 0,
    basicSalary: 1000,
    allowances: 0,
    deductions: 0
  };

  const startEmp = Date.now();
  res = await fetch(`${BASE_URL}/employees`, { method: 'POST', headers, body: JSON.stringify(empData) });
  const empLatency = Date.now() - startEmp;
  
  if (empLatency > 1000) issues.push({ severity: 'Medium', module: 'Performance', desc: `Employee creation took ${empLatency}ms` });

  if (res.status !== 200) {
    const errBody = await res.text();
    issues.push({ severity: 'Critical', module: 'Employees', desc: `Failed to create employee: ${res.status} - ${errBody}` });
  } else {
    const emp = await res.json();
    
    // Test Read
    const resGet = await fetch(`${BASE_URL}/employees`, { headers });
    const employees = await resGet.json();
    if (!employees.find(e => e.id === emp.id)) {
      issues.push({ severity: 'Critical', module: 'Database', desc: 'Created employee not found in DB' });
    }

    // Test Cascade / Relations (Create Logs)
    await fetch(`${BASE_URL}/logs`, { method: 'POST', headers, body: JSON.stringify({ id: `LOG-${Date.now()}`, employeeName: empData.name, action: 'TEST', type: 'QA', timestamp: Date.now(), read: false }) });

    // Clean up
    const resDel = await fetch(`${BASE_URL}/employees/${emp.id}`, { method: 'DELETE', headers });
    if (resDel.status !== 200) issues.push({ severity: 'High', module: 'Database', desc: `Failed to delete employee: ${resDel.status}` });
  }

  // Generate Report
  fs.writeFileSync('backend-qa-report.json', JSON.stringify(issues, null, 2));
  console.log(`Tests completed. Found ${issues.length} issues.`);

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", server.pid, '/f', '/t']);
  } else {
    server.kill();
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
