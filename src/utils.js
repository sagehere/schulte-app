const crypto = require('crypto');

const SCORE_RULES = {
  3: {
    child:      { excellent: 8,   good: 12,  middle: 16 },
    olderChild: { excellent: 6,   good: 9,   middle: 13 },
    preTeen:    { excellent: 5,   good: 7,   middle: 10 },
    teen:       { excellent: 4,   good: 6,   middle: 8 },
    adult:      { excellent: 3,   good: 5,   middle: 7 }
  },
  4: {
    child:      { excellent: 18,  good: 25,  middle: 32 },
    olderChild: { excellent: 14,  good: 20,  middle: 26 },
    preTeen:    { excellent: 11,  good: 15,  middle: 20 },
    teen:       { excellent: 8,   good: 12,  middle: 16 },
    adult:      { excellent: 6,   good: 9,   middle: 13 }
  },
  5: {
    child:      { excellent: 45,  good: 60,  middle: 75 },
    olderChild: { excellent: 35,  good: 45,  middle: 55 },
    preTeen:    { excellent: 28,  good: 35,  middle: 42 },
    teen:       { excellent: 18,  good: 25,  middle: 32 },
    adult:      { excellent: 12,  good: 18,  middle: 25 }
  },
  6: {
    child:      { excellent: 70,  good: 90,  middle: 110 },
    olderChild: { excellent: 55,  good: 70,  middle: 85 },
    preTeen:    { excellent: 45,  good: 55,  middle: 68 },
    teen:       { excellent: 30,  good: 40,  middle: 50 },
    adult:      { excellent: 20,  good: 28,  middle: 38 }
  },
  7: {
    child:      { excellent: 110, good: 140, middle: 170 },
    olderChild: { excellent: 85,  good: 105, middle: 130 },
    preTeen:    { excellent: 70,  good: 85,  middle: 100 },
    teen:       { excellent: 50,  good: 65,  middle: 80 },
    adult:      { excellent: 35,  good: 45,  middle: 60 }
  }
};

const SERVER_TASK_MATCH_FIELDS = {
  schulte: [
    { key: 'size', type: 'number', defaultValue: 5 },
    { key: 'reverse', type: 'boolean', defaultValue: false },
    { key: 'colorInterference', type: 'boolean', defaultValue: false }
  ],
  stroop: [{ key: 'textAnswer', type: 'boolean', defaultValue: false }],
  idiom: [
    { key: 'cols', type: 'number', defaultValue: 4 },
    { key: 'colorInterference', type: 'boolean', defaultValue: false }
  ],
  poem: [{ key: 'colorInterference', type: 'boolean', defaultValue: false }],
  memory: [],
  decode: [{ key: 'reverse', type: 'boolean', defaultValue: false }]
};

function ageBucket(age) {
  const value = Number(age);
  if (!value || value >= 17) return 'adult';
  if (value <= 6) return 'child';
  if (value <= 8) return 'olderChild';
  if (value <= 11) return 'preTeen';
  return 'teen';
}

function calculateAge(birthDate, atDate = new Date()) {
  if (!birthDate) return null;
  const born = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(born.getTime()) || born > atDate) return null;
  let age = atDate.getFullYear() - born.getFullYear();
  const monthDelta = atDate.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && atDate.getDate() < born.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function scoreSchulteRecord(record, age) {
  if ((record.type || 'schulte') !== 'schulte') return '';
  const size = Number(record.size || 0);
  const rules = SCORE_RULES[size];
  if (!rules) return '暂无对应评分标准';
  const seconds = Number(record.timeMs || 0) / 1000;
  const rule = rules[ageBucket(age)] || rules.adult;
  if (seconds < rule.excellent) return '优秀';
  if (seconds < rule.good) return '良好';
  if (seconds < rule.middle) return '中等';
  return '需努力';
}

function scoreCloudSchulte(record, birthDate) {
  if ((record.type || 'schulte') !== 'schulte') return '';
  const age = calculateAge(birthDate, record.date ? new Date(record.date) : new Date());
  if (age === null) return '需填写出生日期';
  return scoreSchulteRecord(record, age);
}

function formatSeconds(ms) {
  return (Number(ms || 0) / 1000).toFixed(2);
}

function formatPracticeMs(ms) {
  const totalSeconds = Math.round(Number(ms || 0) / 1000);
  if (totalSeconds < 60) return `${totalSeconds} 秒`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分钟`;
}

function totalPracticeMs(records) {
  return records.reduce((sum, record) => sum + Math.max(0, Math.round(Number(record && (record.practiceMs || record.timeMs) || 0))), 0);
}

function trainingLabel(record) {
  const type = record.type || 'schulte';
  if (type === 'stroop') return '斯特鲁普';
  if (type === 'idiom') return '成语训练';
  if (type === 'poem') return '古诗训练';
  if (type === 'memory') return '记忆训练';
  if (type === 'decode') return '译码训练';
  const size = Number(record.size || 5);
  return `${size}×${size}${record.reverse ? ' 倒序' : ''}`;
}

function memoryReplaySuffix(record) {
  const replays = Math.max(0, Math.round(Number(record && record.replays || 0)));
  return (record && record.type) === 'memory' && replays > 0 ? `，复现 ${replays} 次` : '';
}

function taskFieldValue(value, rule) {
  if (rule.type === 'number') return Number(value ?? rule.defaultValue);
  if (rule.type === 'boolean') return Boolean(value ?? rule.defaultValue);
  return value ?? rule.defaultValue ?? '';
}

function recordCompletesCloudTask(record, task) {
  if (!task || !task.mode || !task.mode.type) return false;
  const type = task.mode.type;
  const matchFields = SERVER_TASK_MATCH_FIELDS[type];
  if ((record.type || 'schulte') !== type || !matchFields) return false;
  return matchFields.every((rule) => taskFieldValue(record[rule.key], rule) === taskFieldValue(task.mode[rule.key], rule));
}

function applyCloudTrainingCompletionToTasks(tasks, trainingRecords) {
  return tasks.map((task) => {
    const completedCount = trainingRecords.filter((record) => recordCompletesCloudTask(record, task)).length;
    return {
      ...task,
      completedCount,
      completed: completedCount >= (task.targetCount || 1)
    };
  });
}

function cloudTaskText(task) {
  const mode = task && task.mode || {};
  return trainingLabel({
    type: mode.type || task.module,
    size: mode.size,
    reverse: mode.reverse,
    colorInterference: mode.colorInterference,
    textAnswer: mode.textAnswer,
    cols: mode.cols
  });
}

function normalizeCloudUser(input, identifier) {
  const user = input && typeof input === 'object' ? input : {};
  return {
    identifier,
    username: String(user.username || '').trim().slice(0, 24),
    birthDate: isDateKey(user.birthDate) ? user.birthDate : '',
    createdAt: String(user.createdAt || new Date().toISOString()),
    updatedAt: new Date().toISOString()
  };
}

function normalizeCloudTasks(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 80).map((task) => {
    const module = String(task && task.module || 'schulte').slice(0, 20);
    const mode = task && task.mode && typeof task.mode === 'object' ? task.mode : {};
    return {
      id: String(task && task.id || crypto.randomUUID()).slice(0, 80),
      module,
      mode: {
        type: String(mode.type || module).slice(0, 20),
        size: mode.size ? Number(mode.size) : null,
        reverse: Boolean(mode.reverse),
        textAnswer: Boolean(mode.textAnswer),
        colorInterference: Boolean(mode.colorInterference),
        cols: mode.cols ? Number(mode.cols) : null
      },
      targetCount: Math.min(50, Math.max(1, Math.round(Number(task && task.targetCount || 1)) || 1)),
      completed: false
    };
  });
}

function normalizeCloudRecord(input) {
  const record = input && typeof input === 'object' ? input : {};
  return {
    id: String(record.id || crypto.randomUUID()).slice(0, 80),
    type: String(record.type || 'schulte').slice(0, 20),
    size: Number(record.size || 0),
    reverse: Boolean(record.reverse),
    textAnswer: Boolean(record.textAnswer),
    colorInterference: Boolean(record.colorInterference),
    cols: Number(record.cols || 0),
    timeMs: Math.max(0, Math.round(Number(record.timeMs || 0))),
    practiceMs: Math.max(0, Math.round(Number(record.practiceMs || record.timeMs || 0))),
    errors: Math.max(0, Math.round(Number(record.errors || 0))),
    accuracy: Math.max(0, Math.min(100, Number(record.accuracy || 0))),
    replays: Math.max(0, Math.round(Number(record.replays || 0))),
    trials: Number(record.trials || 0),
    title: String(record.title || '').slice(0, 40),
    date: String(record.date || new Date().toISOString()),
    syncedAt: new Date().toISOString()
  };
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function todayDateKey(timeZone) {
  return localDateKey(new Date(), timeZone);
}

function localDateKey(date = new Date(), timeZone) {
  const tz = timeZone || 'Asia/Shanghai';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function formatLocalTime(iso, timeZone) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const tz = timeZone || 'Asia/Shanghai';
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${value.hour}:${value.minute}`;
}

function recordDateKey(record) {
  const date = String(record && record.date || '').slice(0, 10);
  return isDateKey(date) ? date : '';
}

function validIdentifier(value) {
  return /^[A-Za-z0-9]+$/.test(String(value || '').trim());
}

function cleanIdentifier(value) {
  return String(value || '').trim();
}

function validPassword(value) {
  return String(value || '').length >= 4 && String(value || '').length <= 128;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

async function sha256(value) {
  const bytes = Buffer.from(String(value || ''));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

async function passwordHash(password, salt) {
  if (!salt) return sha256(`password:${password}`);
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString('hex'));
    });
  });
}

async function makePasswordRecord(password) {
  const passwordSalt = randomToken(18);
  return {
    passwordHash: await passwordHash(password, passwordSalt),
    passwordSalt,
    passwordHashVersion: 'pbkdf2-sha256-100000'
  };
}

async function verifyPassword(password, stored) {
  if (!stored || !stored.passwordHash) return false;
  return await passwordHash(password, stored.passwordSalt) === stored.passwordHash;
}

async function sessionTokenHash(sessionToken) {
  return sha256('session:' + sessionToken);
}

function sessionTokenHashes(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item) => typeof item === 'string' && item);
  } catch {}
  return typeof value === 'string' ? [value] : [];
}

function appendSessionTokenHash(value, hash, limit = 20) {
  const hashes = sessionTokenHashes(value).filter((item) => item !== hash);
  hashes.push(hash);
  return JSON.stringify(hashes.slice(-limit));
}

function randomToken(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString('base64url');
}

function publicCloudUser(stored) {
  const {
    passwordHash,
    passwordSalt,
    passwordHashVersion,
    passwordUpdatedAt,
    sessionTokenHash,
    sessionTokenCreatedAt,
    ownerTokenHash,
    managerTokenHash,
    managerTokenCreatedAt,
    ...user
  } = stored;
  return user;
}

function publicCloudUserSummary(stored) {
  const user = publicCloudUser(stored);
  return {
    identifier: user.identifier,
    username: user.username || ''
  };
}

module.exports = {
  SCORE_RULES,
  ageBucket,
  calculateAge,
  scoreSchulteRecord,
  scoreCloudSchulte,
  formatSeconds,
  formatPracticeMs,
  totalPracticeMs,
  trainingLabel,
  memoryReplaySuffix,
  taskFieldValue,
  recordCompletesCloudTask,
  applyCloudTrainingCompletionToTasks,
  cloudTaskText,
  normalizeCloudUser,
  normalizeCloudTasks,
  normalizeCloudRecord,
  isDateKey,
  todayDateKey,
  localDateKey,
  formatLocalTime,
  recordDateKey,
  validIdentifier,
  cleanIdentifier,
  validPassword,
  escapeHtml,
  sha256,
  passwordHash,
  makePasswordRecord,
  verifyPassword,
  sessionTokenHash,
  sessionTokenHashes,
  appendSessionTokenHash,
  randomToken,
  publicCloudUser,
  publicCloudUserSummary
};
