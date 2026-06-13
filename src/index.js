require('dotenv').config();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./db');
const apiRoutes = require('./routes');
const { getIndexHtml, renderPublicUserPage } = require('./html');
const {
  todayDateKey,
  normalizeCloudTasks,
  applyCloudTrainingCompletionToTasks,
  validIdentifier
} = require('./utils');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: '请求过于频繁，请稍后再试' }
});

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('x-xss-protection', '1; mode=block');
  next();
});

app.use('/api/admin', adminLimiter);
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

  if (!validIdentifier(identifier)) {
    res.setHeader('content-type', 'text/html; charset=UTF-8');
    return res.status(400).send('<!doctype html><meta charset="utf-8"><title>识别码错误</title><p>识别码仅可输入数字与字母。</p>');
  }

  const stored = db.getUser(identifier);
  if (!stored) {
    res.setHeader('content-type', 'text/html; charset=UTF-8');
    return res.status(404).send('<!doctype html><meta charset="utf-8"><title>用户不存在</title><p>用户不存在。</p>');
  }

  const timeZone = loadTimeZone();
  const today = todayDateKey(timeZone);
  const records = db.getRecords(identifier);
  let tasks = db.getTasks(identifier, today);
  if (!tasks) {
    const template = db.getTaskTemplate(identifier);
    if (template && template.length > 0) {
      tasks = normalizeCloudTasks(template);
      db.putTasks(identifier, today, tasks);
    } else {
      tasks = [];
    }
  }
  tasks = normalizeCloudTasks(tasks);
  const todayRecords = records.filter((r) => {
    const d = String(r.date || '').slice(0, 10);
    return d === today;
  });
  tasks = applyCloudTrainingCompletionToTasks(tasks, todayRecords);

  res.setHeader('content-type', 'text/html; charset=UTF-8');
  res.setHeader('cache-control', 'no-store');
  res.send(renderPublicUserPage(stored, todayRecords, tasks, records, timeZone));
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

function loadTimeZone() {
  try { return db.getSetting('timezone') || 'Asia/Shanghai'; }
  catch { return 'Asia/Shanghai'; }
}

// Initialize database and start server
async function start() {
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('WARNING: ADMIN_PASSWORD is not set. Admin panel will be inaccessible.');
  }
  if (!process.env.USER_CREATE_CODE) {
    console.warn('WARNING: USER_CREATE_CODE is not set. User registration will be disabled.');
  }

  await db.initDb();
  if (!db.getSetting('timezone')) {
    db.setSetting('timezone', 'Asia/Shanghai');
  }

  db.pruneAllOldRecords();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

function gracefulShutdown() {
  console.log('Shutting down gracefully, flushing database...');
  try {
    db.flushDbSync();
    console.log('Database flushed.');
  } catch (e) {
    console.error('Failed to flush database:', e);
  }
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
