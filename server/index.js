import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import admin from './firebaseAdmin.js';
import { authMiddleware } from './authMiddleware.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

try {
  const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("SUCCESS: Firebase Admin initialized successfully using service account.");
} catch (e) {
  console.error("FAILURE: " + e.message);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const prisma = new PrismaClient();
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Apply authentication middleware to all /api routes except upload (if upload is public, but let's protect all as requested)
app.use('/api', authMiddleware);

// --- UPLOAD ---
app.post('/api/upload', async (req, res) => {
  try {
    const fileStr = req.body.file;
    if (!fileStr) {
      return res.status(400).json({ error: 'No file provided' });
    }
    const uploadedResponse = await cloudinary.uploader.upload(fileStr, {
      folder: 'employees'
    });
    res.json({ secure_url: uploadedResponse.secure_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to upload image' });
  }
});

// --- EMPLOYEES ---
app.get('/api/employees', async (req, res) => {
  try {
    const employees = await prisma.employee.findMany();
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', async (req, res) => {
  try {
    const emp = await prisma.employee.create({ data: req.body });
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

app.delete('/api/employees/:id', async (req, res) => {
  try {
    await prisma.employee.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    const log = await prisma.activityLog.create({ data: req.body });
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

app.post('/api/payroll', async (req, res) => {
  try {
    const record = await prisma.payrollRecord.upsert({
      where: { id: req.body.id },
      update: req.body,
      create: req.body
    });
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
  try {
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
  try {
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

app.listen(port, () => {
  console.log(`Backend API running on http://localhost:${port}`);
});
