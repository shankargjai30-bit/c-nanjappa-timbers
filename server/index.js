import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import admin from './firebaseAdmin.js';
import { authMiddleware } from './authMiddleware.js';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 3000;

// Trust reverse proxy (Render, Cloudflare, AWS, Heroku) for HTTPS protocol detection
app.set('trust proxy', 1);

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded static files
app.use('/uploads', express.static(uploadsDir));

// Health check endpoints (public, no auth required for cloud uptime monitors)
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'TimberPro ERP Backend',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Apply authentication middleware to all /api routes except public endpoints
app.use('/api', authMiddleware);

// Helper to get current Date and Time in Asia/Kolkata timezone
function getISTDateTime() {
  const options = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(new Date());
  
  const partMap = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }
  
  const year = partMap.year;
  const month = partMap.month;
  const day = partMap.day;
  const hour = partMap.hour;
  const minute = partMap.minute;
  const rawAmpm = partMap.dayPeriod || partMap.ampm || 'AM';
  const ampm = rawAmpm.toUpperCase().replace(/\./g, '').trim();
  
  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hour}:${minute} ${ampm}`;
  
  return { dateStr, timeStr };
}

// Helper to check if a check-in is late (after 09:30 AM)
function isLateCheckIn(timeStr) {
  const [time, rawModifier] = timeStr.split(' ');
  const modifier = (rawModifier || 'AM').toUpperCase().replace(/\./g, '').trim();
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier === 'PM') return true;
  if (hours === 12 && modifier === 'AM') hours = 0;
  if (hours > 9) return true;
  if (hours === 9 && minutes > 30) return true;
  return false;
}

// Helper to parse HH:MM AM/PM back to Date object for a given YYYY-MM-DD date
function parseTime(timeStr, dateStr) {
  const [time, rawModifier] = timeStr.split(' ');
  const modifier = (rawModifier || 'AM').toUpperCase().replace(/\./g, '').trim();
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

// --- UPLOAD ---
app.post('/api/upload', async (req, res) => {
  try {
    const fileStr = req.body.file;
    if (!fileStr) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Try Cloudinary upload first if configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        const uploadedResponse = await cloudinary.uploader.upload(fileStr, {
          folder: 'employees'
        });
        if (uploadedResponse && uploadedResponse.secure_url) {
          return res.json({ secure_url: uploadedResponse.secure_url });
        }
      } catch (cloudErr) {
        console.warn('Cloudinary upload warning (falling back to secure local storage):', cloudErr.message);
      }
    }

    // Reliable fallback: Store image securely on server and serve via /uploads
    const matches = fileStr.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const mimeType = matches[1];
      const ext = mimeType.split('/')[1] || 'jpg';
      const buffer = Buffer.from(matches[2], 'base64');
      const filename = `emp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
      const filePath = path.join(uploadsDir, filename);
      
      fs.writeFileSync(filePath, buffer);
      
      const host = req.get('host') || `localhost:${port}`;
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const secure_url = `${protocol}://${host}/uploads/${filename}`;
      
      return res.json({ secure_url });
    } else {
      // If pure base64 without data URI scheme
      const buffer = Buffer.from(fileStr, 'base64');
      const filename = `emp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.jpg`;
      const filePath = path.join(uploadsDir, filename);
      
      fs.writeFileSync(filePath, buffer);
      
      const host = req.get('host') || `localhost:${port}`;
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const secure_url = `${protocol}://${host}/uploads/${filename}`;
      
      return res.json({ secure_url });
    }
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload image' });
  }
});

// --- EMPLOYEES ---
app.get('/api/employees', async (req, res) => {
  try {
    const { dateStr } = getISTDateTime();
    const [employees, todayRecords] = await Promise.all([
      prisma.employee.findMany(),
      prisma.attendanceRecord.findMany({ where: { date: dateStr } })
    ]);

    const recordMap = new Map(todayRecords.map(r => [r.employeeId, r]));

    const mergedEmployees = employees.map(emp => {
      if (emp.status === 'On Leave') {
        return {
          ...emp,
          checkIn: '--',
          checkOut: '--'
        };
      }
      const record = recordMap.get(emp.id);
      if (record) {
        return {
          ...emp,
          status: record.status,
          checkIn: record.checkIn,
          checkOut: record.checkOut || '--',
          verified: record.verified
        };
      } else {
        return {
          ...emp,
          status: 'Absent',
          checkIn: '--',
          checkOut: '--'
        };
      }
    });

    res.json(mergedEmployees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', async (req, res) => {
  // BUG-2: Server-side validation — reject blank or whitespace-only ID/name
  const { id, name } = req.body;
  if (!id || !id.trim()) {
    return res.status(400).json({ error: 'Employee ID is required and cannot be blank' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Employee name is required and cannot be blank' });
  }

  const employeeData = {
    ...req.body,
    id: id.trim(),
    name: name.trim(),
    department: req.body.department || 'General',
    role: req.body.role || 'Worker',
    status: req.body.status || 'Absent',
    checkIn: req.body.checkIn || '--',
    checkOut: req.body.checkOut || '--',
    verified: Boolean(req.body.verified),
    presentDays: Number(req.body.presentDays) || 0,
    absentDays: Number(req.body.absentDays) || 0,
    totalWorkingDays: Number(req.body.totalWorkingDays) || 26,
    otHours: Number(req.body.otHours) || 0,
    basicSalary: Number(req.body.basicSalary) || 0,
    allowances: Number(req.body.allowances) || 0,
    deductions: Number(req.body.deductions) || 0
  };

  try {
    const emp = await prisma.employee.create({ data: employeeData });
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    const emp = await prisma.employee.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const deleteEmployeeHandler = async (req, res) => {
  const id = req.params.id || req.query.id;
  if (!id) {
    return res.status(400).json({ error: 'Employee ID is required' });
  }
  try {
    // BUG-3: Use a transaction to clean up DailyPayroll (no cascade in schema)
    // then delete the employee. AttendanceRecord/OTRecord/PayrollRecord
    // are handled by onDelete: Cascade automatically.
    await prisma.$transaction([
      prisma.dailyPayroll.deleteMany({ where: { employeeId: id } }),
      prisma.employee.delete({ where: { id } })
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

app.delete('/api/employees', deleteEmployeeHandler);
app.delete('/api/employees/:id', deleteEmployeeHandler);


// --- ACTIVITY LOGS ---
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await prisma.activityLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logs', async (req, res) => {
  try {
    const logData = {
      id: req.body.id || `LOG_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      employeeName: req.body.employeeName || 'System',
      action: req.body.action || '',
      timestamp: typeof req.body.timestamp === 'number' ? req.body.timestamp : Date.now(),
      type: req.body.type || 'info',
      read: Boolean(req.body.read)
    };
    const log = await prisma.activityLog.create({ data: logData });
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/logs/read-all', async (req, res) => {
  try {
    await prisma.activityLog.updateMany({
      data: { read: true }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/logs', async (req, res) => {
  try {
    await prisma.activityLog.deleteMany();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PAYROLL ---
app.get('/api/payroll', async (req, res) => {
  try {
    const records = await prisma.payrollRecord.findMany({
      orderBy: { month: 'desc' }
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BUG-1 + WEAK-1: Payroll status transition enforcement + field allowlist
// Allowed transitions:
//   Draft -> Draft (re-save)  Draft -> Approved
//   Approved -> Paid
//   Paid -> (nothing — terminal)
const PAYROLL_TRANSITIONS = {
  Draft:    ['Draft', 'Approved'],
  Approved: ['Paid'],
  Paid:     []
};

// Only these fields may be updated on an existing PayrollRecord
const PAYROLL_ALLOWED_UPDATE_FIELDS = [
  'status', 'approvedBy', 'approvalTime', 'rejectionReason',
  'otHours', 'otAmount', 'allowances', 'deductions', 'netPay',
  'presentDays', 'totalWorkingDays', 'basicSalary'
];

app.post('/api/payroll', async (req, res) => {
  const { id, status: newStatus } = req.body;
  if (!id) return res.status(400).json({ error: 'PayrollRecord id is required' });

  try {
    const existing = await prisma.payrollRecord.findUnique({ where: { id } });

    if (existing) {
      // Enforce status transition rules
      const currentStatus = existing.status;
      const allowed = PAYROLL_TRANSITIONS[currentStatus] ?? [];
      if (!allowed.includes(newStatus)) {
        return res.status(403).json({
          error: `Invalid status transition: ${currentStatus} → ${newStatus} is not permitted`
        });
      }

      // Apply field allowlist — only safe fields may be overwritten
      const safeUpdate = {};
      for (const field of PAYROLL_ALLOWED_UPDATE_FIELDS) {
        if (req.body[field] !== undefined) safeUpdate[field] = req.body[field];
      }

      const record = await prisma.payrollRecord.update({ where: { id }, data: safeUpdate });
      return res.json(record);
    }

    // New record — must start as Draft
    if (newStatus && newStatus !== 'Draft') {
      return res.status(400).json({ error: 'New payroll records must start with status Draft' });
    }
    const record = await prisma.payrollRecord.create({ data: req.body });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- OT RECORDS ---
app.get('/api/ot', async (req, res) => {
  try {
    const records = await prisma.oTRecord.findMany({
      orderBy: { month: 'desc' }
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ot', async (req, res) => {
  const { employeeId, month } = req.body;
  if (!employeeId || !month) {
    return res.status(400).json({ error: 'employeeId and month are required' });
  }

  // WEAK-2: Numeric field validation for OT records
  const otNumericFields = ['otHours', 'otHourlyRate', 'calculatedAmount', 'bonusAmount', 'deductionAmount', 'finalAmount'];
  for (const field of otNumericFields) {
    if (req.body[field] !== undefined) {
      const val = req.body[field];
      if (typeof val !== 'number' || isNaN(val)) {
        return res.status(400).json({ error: `Field '${field}' must be a valid number` });
      }
      if (val < 0) {
        return res.status(400).json({ error: `Field '${field}' cannot be negative` });
      }
    }
  }

  try {
    // Check if payroll is approved or paid for this employee and month
    const lockRecord = await prisma.payrollRecord.findFirst({
      where: {
        employeeId,
        month,
        status: { in: ['Approved', 'Paid'] }
      }
    });

    if (lockRecord) {
      return res.status(403).json({ error: 'Modification blocked: Payroll for this month is already Approved or Paid' });
    }

    const record = await prisma.oTRecord.upsert({
      where: { id: req.body.id },
      update: req.body,
      create: req.body
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- DAILY PAYROLL ---
app.get('/api/daily-payroll', async (req, res) => {
  try {
    const { date, month, employeeId } = req.query;
    const where = {};
    if (date) where.date = date;
    if (month) where.date = { startsWith: month };
    if (employeeId) where.employeeId = employeeId;
    
    const records = await prisma.dailyPayroll.findMany({
      where,
      orderBy: { date: 'desc' }
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/daily-payroll', async (req, res) => {
  const { employeeId, date } = req.body;
  if (!employeeId || !date) {
    return res.status(400).json({ error: 'employeeId and date are required' });
  }

  // WEAK-2: Numeric field validation for DailyPayroll records
  const dpNumericFields = ['dailyWage', 'bonus', 'deduction', 'finalAmount'];
  for (const field of dpNumericFields) {
    if (req.body[field] !== undefined) {
      const val = req.body[field];
      if (typeof val !== 'number' || isNaN(val)) {
        return res.status(400).json({ error: `Field '${field}' must be a valid number` });
      }
      if (val < 0) {
        return res.status(400).json({ error: `Field '${field}' cannot be negative` });
      }
    }
  }

  // Convert YYYY-MM-DD to friendly Month YYYY format
  const getFriendlyMonth = (dateStr) => {
    const [year, monthNum] = dateStr.split('-');
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${monthNames[parseInt(monthNum, 10) - 1]} ${year}`;
  };

  try {
    // Check if payroll is approved or paid for this employee and month
    const lockRecord = await prisma.payrollRecord.findFirst({
      where: {
        employeeId,
        month: getFriendlyMonth(date),
        status: { in: ['Approved', 'Paid'] }
      }
    });

    if (lockRecord) {
      return res.status(403).json({ error: 'Modification blocked: Payroll for this month is already Approved or Paid' });
    }

    const record = await prisma.dailyPayroll.upsert({
      where: { id: req.body.id },
      update: req.body,
      create: req.body
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ATTENDANCE ROUTES ---
app.post('/api/attendance', async (req, res) => {
  const { employeeId, mode } = req.body;
  
  if (!employeeId) {
    return res.status(400).json({ error: 'employeeId is required' });
  }

  // mode must be explicitly 'check-in' or 'check-out'
  if (mode !== 'check-in' && mode !== 'check-out') {
    return res.status(400).json({ error: 'mode must be "check-in" or "check-out"' });
  }

  const { dateStr, timeStr } = getISTDateTime();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify employee exists
      const employee = await tx.employee.findUnique({
        where: { id: employeeId }
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      // 2. Reject if On Leave
      if (employee.status === 'On Leave') {
        throw new Error('Employee is on leave');
      }

      // 3. Find today's AttendanceRecord
      const record = await tx.attendanceRecord.findUnique({
        where: {
          employeeId_date: {
            employeeId,
            date: dateStr
          }
        }
      });

      // ── CHECK-IN MODE ──────────────────────────────────────────────────────
      if (mode === 'check-in') {
        // Already checked in today
        if (record && record.checkIn) {
          return {
            action: 'blocked',
            error: 'Already checked in. Select Check Out Mode to check out.'
          };
        }

        // No record yet — perform check-in
        const isLate = isLateCheckIn(timeStr);
        const newStatus = isLate ? 'Half Day' : 'Present';
        const updatedPresentDays = employee.presentDays + 1;
        const updatedAbsentDays = Math.max(0, employee.absentDays - 1);

        const newRecord = await tx.attendanceRecord.create({
          data: {
            employeeId,
            date: dateStr,
            checkIn: timeStr,
            status: newStatus,
            verified: true
          }
        });

        const updatedEmployee = await tx.employee.update({
          where: { id: employeeId },
          data: {
            status: newStatus,
            checkIn: timeStr,
            checkOut: '--',
            presentDays: updatedPresentDays,
            absentDays: updatedAbsentDays,
            verified: true
          }
        });

        return { action: 'check-in', record: newRecord, employee: updatedEmployee };
      }

      // ── CHECK-OUT MODE ─────────────────────────────────────────────────────
      if (mode === 'check-out') {
        // No record or no check-in yet
        if (!record || !record.checkIn) {
          return {
            action: 'blocked',
            error: 'Cannot check out before checking in.'
          };
        }

        // Already fully checked out
        if (record.checkOut && record.checkOut !== '--') {
          return {
            action: 'blocked',
            error: 'Attendance already completed for today.'
          };
        }

        // Has check-in, no check-out — perform check-out
        const checkInDate = parseTime(record.checkIn, dateStr);
        const checkOutDate = parseTime(timeStr, dateStr);
        
        let diffMs = checkOutDate.getTime() - checkInDate.getTime();
        if (diffMs < 0) diffMs = 0;
        
        const hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
        const otHours = hoursWorked > 9 ? Math.round((hoursWorked - 9) * 10) / 10 : 0;
        const updatedOTHours = employee.otHours + otHours;

        const updatedRecord = await tx.attendanceRecord.update({
          where: { id: record.id },
          data: {
            checkOut: timeStr,
            hoursWorked,
            otHours
          }
        });

        const updatedEmployee = await tx.employee.update({
          where: { id: employeeId },
          data: {
            checkOut: timeStr,
            otHours: updatedOTHours
          }
        });

        return { action: 'check-out', record: updatedRecord, employee: updatedEmployee };
      }
    }, { maxWait: 15000, timeout: 25000 });

    if (result.error) {
      return res.status(200).json({ success: false, error: result.error });
    }

    res.json({ success: true, ...result });

  } catch (err) {
    console.error('Attendance processing error:', err.message);
    if (err.message === 'Employee not found') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === 'Employee is on leave') {
      return res.status(200).json({ success: false, error: err.message });
    }
    res.status(500).json({ error: err.message || 'Database error during attendance processing' });
  }
});

app.get('/api/attendance', async (req, res) => {
  const { date, month } = req.query;
  
  if (!date && !month) {
    return res.status(400).json({ error: 'date or month query parameter is required' });
  }

  if (date && month) {
    return res.status(400).json({ error: 'Use either date or month query parameter, not both' });
  }

  const where = {};
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
    }
    where.date = date;
  } else if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Invalid month format. Expected YYYY-MM' });
    }
    where.date = { startsWith: month };
  }

  try {
    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            name: true,
            department: true,
            role: true,
            avatarColor: true,
            shiftTiming: true
          }
        }
      }
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve compiled frontend assets when 'dist' is built (Unified Production Hosting)
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads') && !req.path.startsWith('/health')) {
      return res.sendFile(path.join(distDir, 'index.html'));
    }
    next();
  });
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Backend API running on http://0.0.0.0:${port} (accessible on LAN, Cloud, and localhost)`);
});
