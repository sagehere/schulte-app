const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const audioGuides = require('./audio-guides');
const {
  normalizeCloudUser,
  normalizeCloudTasks,
  normalizeCloudRecord,
  publicCloudUser,
  publicCloudUserSummary,
  applyCloudTrainingCompletionToTasks,
  cloudTaskText,
  validIdentifier,
  cleanIdentifier,
  validPassword,
  isDateKey,
  todayDateKey,
  sha256,
  makePasswordRecord,
  verifyPassword,
  sessionTokenHash,
  sessionTokenHashes,
  appendSessionTokenHash,
  randomToken,

  formatPracticeMs,
  totalPracticeMs,
  trainingLabel,
  formatSeconds,
  scoreCloudSchulte,
  scoreSchulteRecord,
  memoryReplaySuffix,
  escapeHtml,
  formatLocalTime
} = require('./utils');

function getTZ() {
  try { return db.getSetting('timezone') || 'Asia/Shanghai'; }
  catch { return 'Asia/Shanghai'; }
}

const TRAINING_NAVIGATION_SETTING = 'training_navigation';
const DEFAULT_TRAINING_NAVIGATION = [
  'schulte', 'stroop', 'idiom', 'poem', 'memory', 'decode', 'mindfulness'
].map((id) => ({ id, visible: true }));

function getTrainingNavigation() {
  try {
    const stored = db.getSetting(TRAINING_NAVIGATION_SETTING);
    const navigation = stored && validateTrainingNavigation(JSON.parse(stored));
    return navigation || DEFAULT_TRAINING_NAVIGATION;
  } catch {
    return DEFAULT_TRAINING_NAVIGATION;
  }
}

function validateTrainingNavigation(value) {
  if (!Array.isArray(value) || value.length !== DEFAULT_TRAINING_NAVIGATION.length) return null;
  const expectedIds = new Set(DEFAULT_TRAINING_NAVIGATION.map((item) => item.id));
  const ids = new Set();
  const navigation = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || !expectedIds.has(item.id) || ids.has(item.id) || typeof item.visible !== 'boolean') return null;
    ids.add(item.id);
    navigation.push({ id: item.id, visible: item.visible });
  }
  return ids.size === expectedIds.size && navigation.some((item) => item.visible) ? navigation : null;
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isValidTimeZone(tz) {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const router = express.Router();
const mp3Body = express.raw({ type: ['audio/mpeg', 'audio/mp3'], limit: audioGuides.MAX_AUDIO_BYTES });

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: '请求过于频繁，请稍后再试' }
});

const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: '请求过于频繁，请稍后再试' }
});

function hasAdminAccess(req) {
  const auth = req.headers.authorization || '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i);
  const token = bearer ? bearer[1] : req.body && req.body.password;
  return Boolean(process.env.ADMIN_PASSWORD && token === process.env.ADMIN_PASSWORD);
}

function sendAudioError(res, error) {
  return res.status(error.status || 500).json({ ok: false, error: error.message || '音频处理失败' });
}

function requireAdmin(req, res, next) {
  if (!hasAdminAccess(req)) return res.status(403).json({ ok: false, error: '管理密码不正确' });
  next();
}

function parseMp3(req, res, next) {
  mp3Body(req, res, (error) => {
    if (error) {
      const status = error.type === 'entity.too.large' ? 413 : 400;
      return res.status(status).json({ ok: false, error: status === 413 ? '音频文件不能超过 50MB' : 'MP3 上传内容无效' });
    }
    next();
  });
}

async function requireSession(identifier, sessionToken) {
  const stored = db.getUser(identifier);
  if (!stored) return { error: { ok: false, error: '用户不存在', status: 404 } };
  if (!stored.passwordHash) return { error: { ok: false, error: '该用户尚未设置密码，请联系管理员重置密码', status: 403 } };
  if (sessionToken && stored.sessionTokenHash) {
    const computedHash = await sessionTokenHash(sessionToken);
    if (sessionTokenHashes(stored.sessionTokenHash).some((hash) => safeEqual(computedHash, hash))) return { stored };
  }
  return { error: { ok: false, error: '没有写入权限', status: 403 } };
}

async function issueSession(identifier, stored) {
  const sessionToken = randomToken(32);
  const now = new Date().toISOString();
  const hash = await sessionTokenHash(sessionToken);
  db.updateUser(identifier, {
    session_token_hash: appendSessionTokenHash(stored && stored.sessionTokenHash, hash),
    session_token_created_at: now
  });
  return { sessionToken, stored: db.getUser(identifier) };
}

// Public audio guides
router.get('/audio-guides', (req, res) => {
  try {
    const audios = audioGuides.listAudioGuides().map((audio) => ({
      ...audio,
      url: `/api/audio-guides/${encodeURIComponent(audio.id)}/file`
    }));
    res.json({ ok: true, audios });
  } catch (error) {
    sendAudioError(res, error);
  }
});

router.get('/audio-guides/:id/file', (req, res) => {
  try {
    const filePath = audioGuides.resolveAudioPath(req.params.id);
    res.type('audio/mpeg');
    res.setHeader('cache-control', 'no-store');
    res.sendFile(filePath, { acceptRanges: true, cacheControl: false }, (error) => {
      if (error && !res.headersSent) sendAudioError(res, error);
    });
  } catch (error) {
    sendAudioError(res, error);
  }
});

// Admin: audio guide management
router.post('/admin/audio-guides', requireAdmin, parseMp3, (req, res) => {
  if (!req.is(['audio/mpeg', 'audio/mp3'])) return res.status(415).json({ ok: false, error: '仅支持 MP3 音频' });
  try {
    const audio = audioGuides.createAudioGuide(req.query.name, req.body);
    res.status(201).json({ ok: true, audio: { ...audio, url: `/api/audio-guides/${encodeURIComponent(audio.id)}/file` } });
  } catch (error) {
    sendAudioError(res, error);
  }
});

router.put('/admin/audio-guides/order', requireAdmin, (req, res) => {
  try {
    const audios = audioGuides.reorderAudioGuides(req.body && req.body.ids).map((audio) => ({
      ...audio,
      url: `/api/audio-guides/${encodeURIComponent(audio.id)}/file`
    }));
    res.json({ ok: true, audios });
  } catch (error) {
    sendAudioError(res, error);
  }
});

router.put('/admin/audio-guides/:id', requireAdmin, (req, res) => {
  try {
    const audio = audioGuides.renameAudioGuide(req.params.id, req.body && req.body.name);
    res.json({ ok: true, audio: { ...audio, url: `/api/audio-guides/${encodeURIComponent(audio.id)}/file` } });
  } catch (error) {
    sendAudioError(res, error);
  }
});

router.delete('/admin/audio-guides/:id', requireAdmin, (req, res) => {
  try {
    audioGuides.deleteAudioGuide(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    sendAudioError(res, error);
  }
});

// Create user
router.post('/users', createLimiter, async (req, res) => {
  const body = req.body;
  if (!body) return res.status(400).json({ ok: false, error: '请求体不是有效 JSON' });

  if (!process.env.USER_CREATE_CODE || String(body.authCode || '') !== String(process.env.USER_CREATE_CODE)) {
    return res.status(403).json({ ok: false, error: '授权码不正确' });
  }

  const identifier = cleanIdentifier(body.user && body.user.identifier);
  if (!validIdentifier(identifier)) return res.status(400).json({ ok: false, error: '识别码仅可输入数字与字母' });
  if (db.getUser(identifier)) return res.status(409).json({ ok: false, error: '识别码已存在' });
  if (!validPassword(body.password)) return res.status(400).json({ ok: false, error: '密码长度需为 4-128 个字符' });

  const now = new Date().toISOString();
  const user = normalizeCloudUser({ ...(body.user || {}), createdAt: now }, identifier);
  const passwordRecord = await makePasswordRecord(body.password);

  db.createUser(identifier, {
    username: user.username,
    birthDate: user.birthDate,
    ...passwordRecord,
    passwordUpdatedAt: now
  });

  const session = await issueSession(identifier, db.getUser(identifier));
  const tasks = normalizeCloudTasks(body.tasks);
  db.putTasks(identifier, todayDateKey(getTZ()), tasks);
  if (tasks.length > 0) {
    db.setTaskTemplate(identifier, tasks);
  }

  res.json({ ok: true, user, sessionToken: session.sessionToken, tasks });
});

// Get user
router.get('/users/:identifier', (req, res) => {
  const { identifier } = req.params;
  if (!validIdentifier(identifier)) return res.status(400).json({ ok: false, error: '识别码仅可输入数字与字母' });

  const stored = db.getUser(identifier);
  if (!stored) return res.status(404).json({ ok: false, error: '用户不存在' });

  const date = isDateKey(req.query.date) ? req.query.date : todayDateKey(getTZ());
  let tasks = db.getTasks(identifier, date);
  if (!tasks) {
    const template = db.getTaskTemplate(identifier);
    if (template && template.length > 0) {
      tasks = normalizeCloudTasks(template);
      db.putTasks(identifier, date, tasks);
    } else {
      tasks = [];
    }
  }
  tasks = normalizeCloudTasks(tasks);

  res.json({ ok: true, user: publicCloudUser(stored), date, tasks });
});

// Update user
router.put('/users/:identifier', async (req, res) => {
  const { identifier } = req.params;
  if (!validIdentifier(identifier)) return res.status(400).json({ ok: false, error: '识别码仅可输入数字与字母' });

  const body = req.body;
  if (!body) return res.status(400).json({ ok: false, error: '请求体不是有效 JSON' });

  const owned = await requireSession(identifier, body.sessionToken);
  if (owned.error) return res.status(owned.error.status).json(owned.error);

  const nextIdentifier = cleanIdentifier(body.user && body.user.identifier) || identifier;
  if (!validIdentifier(nextIdentifier)) return res.status(400).json({ ok: false, error: '识别码仅可输入数字与字母' });
  if (nextIdentifier !== identifier && db.getUser(nextIdentifier)) return res.status(409).json({ ok: false, error: '识别码已存在' });

  const user = normalizeCloudUser({ ...(body.user || {}), createdAt: owned.stored.createdAt }, nextIdentifier);
  db.updateUser(nextIdentifier, {
    username: user.username,
    birth_date: user.birthDate
  });

  if (nextIdentifier !== identifier) {
    db.renameUserIdentifier(identifier, nextIdentifier);
  }

  const date = isDateKey(body.date) ? body.date : todayDateKey(getTZ());
  const tasks = normalizeCloudTasks(body.tasks);
  db.putTasks(nextIdentifier, date, tasks);
  if (tasks.length > 0) {
    db.setTaskTemplate(nextIdentifier, tasks);
  } else {
    db.deleteTaskTemplate(nextIdentifier);
  }

  res.json({ ok: true, user: publicCloudUser(db.getUser(nextIdentifier)), sessionToken: body.sessionToken, date, tasks });
});

// Delete user
router.delete('/users/:identifier', async (req, res) => {
  const { identifier } = req.params;
  if (!validIdentifier(identifier)) return res.status(400).json({ ok: false, error: '识别码仅可输入数字与字母' });

  const body = req.body;
  if (!body) return res.status(400).json({ ok: false, error: '请求体不是有效 JSON' });

  const access = await requireSession(identifier, body.sessionToken);
  if (access.error) return res.status(access.error.status).json(access.error);
  if (!body.password || !await verifyPassword(body.password, access.stored)) return res.status(403).json({ ok: false, error: '密码确认失败' });

  db.deleteUser(identifier);
  res.json({ ok: true });
});

// Login
router.post('/users/:identifier/login', loginLimiter, async (req, res) => {
  const { identifier } = req.params;
  if (!validIdentifier(identifier)) return res.status(400).json({ ok: false, error: '识别码仅可输入数字与字母' });

  const body = req.body;
  if (!body) return res.status(400).json({ ok: false, error: '请求体不是有效 JSON' });

  const stored = db.getUser(identifier);
  if (!stored) return res.status(404).json({ ok: false, error: '用户不存在' });
  if (!stored.passwordHash) return res.status(403).json({ ok: false, error: '该用户尚未设置密码，请联系管理员重置密码' });
  if (!body.password || !await verifyPassword(body.password, stored)) return res.status(403).json({ ok: false, error: '密码不正确' });

  let nextStored = stored;
  if (!stored.passwordSalt) {
    const passwordRecord = await makePasswordRecord(body.password);
    db.updateUser(identifier, {
      ...passwordRecord,
      passwordUpdatedAt: stored.passwordUpdatedAt || new Date().toISOString()
    });
    nextStored = db.getUser(identifier);
  }

  const session = await issueSession(identifier, nextStored);
  const date = isDateKey(body.date) ? body.date : todayDateKey(getTZ());
  let tasks = db.getTasks(identifier, date);
  if (!tasks) tasks = [];
  tasks = normalizeCloudTasks(tasks);

  res.json({ ok: true, user: publicCloudUser(session.stored), sessionToken: session.sessionToken, date, tasks });
});

// Verify session
router.post('/users/:identifier/verify-session', async (req, res) => {
  const { identifier } = req.params;
  if (!validIdentifier(identifier)) return res.status(400).json({ ok: false, error: '识别码仅可输入数字与字母' });

  const body = req.body;
  if (!body) return res.status(400).json({ ok: false, error: '请求体不是有效 JSON' });

  const owned = await requireSession(identifier, body.sessionToken);
  if (owned.error) return res.json({ ok: true, valid: false });

  res.json({ ok: true, valid: true });
});

// Post record
router.post('/users/:identifier/records', async (req, res) => {
  const { identifier } = req.params;
  if (!validIdentifier(identifier)) return res.status(400).json({ ok: false, error: '识别码仅可输入数字与字母' });

  const body = req.body;
  if (!body) return res.status(400).json({ ok: false, error: '请求体不是有效 JSON' });

  const owned = await requireSession(identifier, body.sessionToken);
  if (owned.error) return res.status(owned.error.status).json(owned.error);

  const record = normalizeCloudRecord(body.record);
  db.putRecord(identifier, record);

  res.json({ ok: true, record });
});

// Public user info
router.get('/users/:identifier/public', (req, res) => {
  const { identifier } = req.params;
  if (!validIdentifier(identifier)) return res.status(400).json({ ok: false, error: '识别码仅可输入数字与字母' });

  const stored = db.getUser(identifier);
  if (!stored) return res.status(404).json({ ok: false, error: '用户不存在' });

  const records = db.getRecords(identifier, 100);
  res.json({ ok: true, user: publicCloudUserSummary(stored), records });
});

// Settings
router.get('/settings', (req, res) => {
  res.json({ ok: true, timezone: getTZ(), trainingNavigation: getTrainingNavigation() });
});

router.put('/admin/settings', (req, res) => {
  if (!hasAdminAccess(req)) return res.status(403).json({ ok: false, error: '管理密码不正确' });

  const body = req.body;
  if (!body) return res.status(400).json({ ok: false, error: '请求体不是有效 JSON' });

  let timezone;
  if (Object.prototype.hasOwnProperty.call(body, 'timezone')) {
    const tz = String(body.timezone).trim();
    if (!tz || !isValidTimeZone(tz)) {
      return res.status(400).json({ ok: false, error: '无效的时区值' });
    }
    timezone = tz;
  }

  let trainingNavigation;
  if (Object.prototype.hasOwnProperty.call(body, 'trainingNavigation')) {
    trainingNavigation = validateTrainingNavigation(body.trainingNavigation);
    if (!trainingNavigation) {
      return res.status(400).json({ ok: false, error: '训练导航必须包含全部模式、不可重复，且至少显示一个模式' });
    }
  }

  if (timezone) db.setSetting('timezone', timezone);
  if (trainingNavigation) db.setSetting(TRAINING_NAVIGATION_SETTING, JSON.stringify(trainingNavigation));

  res.json({ ok: true, timezone: getTZ(), trainingNavigation: getTrainingNavigation() });
});

// Admin: list users
router.get('/admin/users', (req, res) => {
  if (!hasAdminAccess(req)) return res.status(403).json({ ok: false, error: '管理密码不正确' });

  const users = db.listUsers().map(publicCloudUser);
  res.json({ ok: true, users });
});

// Admin: get user
router.get('/admin/users/:identifier', (req, res) => {
  if (!hasAdminAccess(req)) return res.status(403).json({ ok: false, error: '管理密码不正确' });

  const { identifier } = req.params;
  if (!validIdentifier(identifier)) return res.status(400).json({ ok: false, error: '识别码仅可输入数字与字母' });

  const stored = db.getUser(identifier);
  if (!stored) return res.status(404).json({ ok: false, error: '用户不存在' });

  const records = db.getRecords(identifier);
  res.json({ ok: true, user: publicCloudUser(stored), recordCount: records.length });
});

// Admin: reset password
router.post('/admin/users/:identifier/password', async (req, res) => {
  const { identifier } = req.params;
  if (!validIdentifier(identifier)) return res.status(400).json({ ok: false, error: '识别码仅可输入数字与字母' });

  const body = req.body;
  if (!body || !hasAdminAccess(req)) return res.status(403).json({ ok: false, error: '管理密码不正确' });
  if (!validPassword(body.newPassword)) return res.status(400).json({ ok: false, error: '新密码长度需为 4-128 个字符' });

  const stored = db.getUser(identifier);
  if (!stored) return res.status(404).json({ ok: false, error: '用户不存在' });

  const now = new Date().toISOString();
  const passwordRecord = await makePasswordRecord(body.newPassword);
  db.updateUser(identifier, {
    ...passwordRecord,
    session_token_hash: '',
    session_token_created_at: '',
    passwordUpdatedAt: now
  });

  res.json({ ok: true, passwordUpdatedAt: now });
});

// Admin: delete user
router.delete('/admin/users/:identifier', (req, res) => {
  if (!hasAdminAccess(req)) return res.status(403).json({ ok: false, error: '管理密码不正确' });

  const { identifier } = req.params;
  if (!validIdentifier(identifier)) return res.status(400).json({ ok: false, error: '识别码仅可输入数字与字母' });

  db.deleteUser(identifier);
  res.json({ ok: true });
});

// Admin: verify password
router.post('/admin/verify', (req, res) => {
  const body = req.body;
  if (!body || !body.password) return res.status(400).json({ ok: false, error: '请输入管理密码' });
  if (!hasAdminAccess(req)) return res.status(403).json({ ok: false, error: '管理密码不正确' });
  res.json({ ok: true });
});

module.exports = router;
