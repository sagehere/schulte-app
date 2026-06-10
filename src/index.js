require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const apiRoutes = require('./routes');
const { getIndexHtml, renderPublicUserPage } = require('./html');
const {
  todayDateKey,
  normalizeCloudTasks,
  applyCloudTrainingCompletionToTasks
} = require('./utils');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');
  next();
});

// API routes
app.use('/api', apiRoutes);

// Main page
app.get('/', (req, res) => {
  res.setHeader('content-type', 'text/html; charset=UTF-8');
  res.setHeader('cache-control', 'no-store');
  res.send(getIndexHtml());
});

// Public user page
app.get('/u/:identifier', (req, res) => {
  const { identifier } = req.params;
  const { validIdentifier } = require('./utils');

  if (!validIdentifier(identifier)) {
    res.setHeader('content-type', 'text/html; charset=UTF-8');
    return res.status(400).send('<!doctype html><meta charset="utf-8"><title>识别码错误</title><p>识别码仅可输入数字与字母。</p>');
  }

  const stored = db.getUser(identifier);
  if (!stored) {
    res.setHeader('content-type', 'text/html; charset=UTF-8');
    return res.status(404).send('<!doctype html><meta charset="utf-8"><title>用户不存在</title><p>用户不存在。</p>');
  }

  const today = todayDateKey();
  const records = db.getRecords(identifier);
  let tasks = db.getTasks(identifier, today) || [];
  tasks = normalizeCloudTasks(tasks);
  const todayRecords = records.filter((r) => {
    const d = String(r.date || '').slice(0, 10);
    return d === today;
  });
  tasks = applyCloudTrainingCompletionToTasks(tasks, todayRecords);

  res.setHeader('content-type', 'text/html; charset=UTF-8');
  res.setHeader('cache-control', 'no-store');
  res.send(renderPublicUserPage(stored, todayRecords, tasks, records));
});

// Poem text file
app.get('/古诗.txt', (req, res) => {
  res.setHeader('content-type', 'text/plain; charset=UTF-8');
  res.setHeader('cache-control', 'public, max-age=300');
  res.send('古诗数据需要从原项目导入');
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// 404
app.use((req, res) => {
  res.status(404).send('Not Found');
});

// Initialize database and start server
async function start() {
  await db.initDb();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
