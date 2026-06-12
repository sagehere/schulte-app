const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'schulte.db');

let db;
let dbReady;
let saveTimer = null;
let savePending = false;

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

async function initDb() {
  if (dbReady) return dbReady;

  dbReady = (async () => {
    const SQL = await initSqlJs();

    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    initTables();
    saveDbImmediate();
    return db;
  })();

  return dbReady;
}

function saveDbImmediate() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFile(DB_PATH, buffer, (err) => {
    if (err) console.error('Failed to save database:', err);
  });
}

function flushDbSync() {
  if (!db) return;
  if (savePending) {
    clearTimeout(saveTimer);
    saveTimer = null;
    savePending = false;
  }
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function saveDb() {
  if (!db) return;
  savePending = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (savePending) {
      savePending = false;
      saveDbImmediate();
    }
  }, 100);
}

function initTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      identifier TEXT PRIMARY KEY,
      username TEXT DEFAULT '',
      birth_date TEXT DEFAULT '',
      password_hash TEXT DEFAULT '',
      password_salt TEXT DEFAULT '',
      password_hash_version TEXT DEFAULT '',
      password_updated_at TEXT DEFAULT '',
      session_token_hash TEXT DEFAULT '',
      session_token_created_at TEXT DEFAULT '',
      owner_token_hash TEXT DEFAULT '',
      manager_token_hash TEXT DEFAULT '',
      manager_token_created_at TEXT DEFAULT '',
      created_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT ''
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      tasks_json TEXT DEFAULT '[]',
      PRIMARY KEY (user_id, date)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT DEFAULT '',
      record_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT ''
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT DEFAULT ''
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_records_user_date ON records(user_id, date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_records_user_created ON records(user_id, created_at)');
}

function getSetting(key) {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  stmt.bind([key]);
  if (stmt.step()) {
    const value = stmt.get()[0];
    stmt.free();
    return value;
  }
  stmt.free();
  return null;
}

function setSetting(key, value) {
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
  saveDb();
}

function rowToObject(columns, values) {
  const obj = {};
  columns.forEach((col, i) => {
    obj[col] = values[i];
  });
  return obj;
}

// User operations
function getUser(identifier) {
  const stmt = db.prepare('SELECT * FROM users WHERE identifier = ?');
  stmt.bind([identifier]);
  if (stmt.step()) {
    const row = rowToObject(stmt.getColumnNames(), stmt.get());
    stmt.free();
    return rowToUser(row);
  }
  stmt.free();
  return null;
}

function createUser(identifier, userData) {
  const now = new Date().toISOString();
  db.run(
    'INSERT INTO users (identifier, username, birth_date, password_hash, password_salt, password_hash_version, password_updated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [identifier, userData.username || '', userData.birthDate || '', userData.passwordHash || '', userData.passwordSalt || '', userData.passwordHashVersion || '', userData.passwordUpdatedAt || '', now, now]
  );
  saveDb();
  return getUser(identifier);
}

function camelToSnake(str) {
  return str.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}

function updateUser(identifier, data) {
  const sets = [];
  const values = [];

  const fields = [
    'username', 'birth_date', 'birthDate',
    'password_hash', 'passwordHash',
    'password_salt', 'passwordSalt',
    'password_hash_version', 'passwordHashVersion',
    'password_updated_at', 'passwordUpdatedAt',
    'session_token_hash', 'sessionTokenHash',
    'session_token_created_at', 'sessionTokenCreatedAt',
    'owner_token_hash', 'ownerTokenHash',
    'manager_token_hash', 'managerTokenHash',
    'manager_token_created_at', 'managerTokenCreatedAt',
    'updated_at', 'updatedAt'
  ];

  for (const field of fields) {
    if (data[field] !== undefined) {
      const column = field.includes('_') ? field : camelToSnake(field);
      sets.push(`${column} = ?`);
      values.push(data[field]);
    }
  }

  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(identifier);

  db.run(`UPDATE users SET ${sets.join(', ')} WHERE identifier = ?`, values);
  saveDb();
}

function deleteUser(identifier) {
  db.run('BEGIN');
  try {
    db.run('DELETE FROM users WHERE identifier = ?', [identifier]);
    db.run('DELETE FROM tasks WHERE user_id = ?', [identifier]);
    db.run('DELETE FROM records WHERE user_id = ?', [identifier]);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  saveDb();
}

function listUsers() {
  const results = [];
  const stmt = db.prepare('SELECT * FROM users ORDER BY username, identifier');
  while (stmt.step()) {
    const row = rowToObject(stmt.getColumnNames(), stmt.get());
    results.push(rowToUser(row));
  }
  stmt.free();
  return results;
}

function renameUserIdentifier(oldId, newId) {
  const user = getUser(oldId);
  if (!user) throw new Error('User not found');

  db.run('BEGIN');
  try {
    db.run('UPDATE users SET identifier = ? WHERE identifier = ?', [newId, oldId]);
    db.run('UPDATE tasks SET user_id = ? WHERE user_id = ?', [newId, oldId]);
    db.run('UPDATE records SET user_id = ? WHERE user_id = ?', [newId, oldId]);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  saveDb();
}

function rowToUser(row) {
  return {
    identifier: row.identifier,
    username: row.username || '',
    birthDate: row.birth_date || '',
    passwordHash: row.password_hash || '',
    passwordSalt: row.password_salt || '',
    passwordHashVersion: row.password_hash_version || '',
    passwordUpdatedAt: row.password_updated_at || '',
    sessionTokenHash: row.session_token_hash || '',
    sessionTokenCreatedAt: row.session_token_created_at || '',
    ownerTokenHash: row.owner_token_hash || '',
    managerTokenHash: row.manager_token_hash || '',
    managerTokenCreatedAt: row.manager_token_created_at || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

// Tasks operations
function getTasks(userId, date) {
  const stmt = db.prepare('SELECT tasks_json FROM tasks WHERE user_id = ? AND date = ?');
  stmt.bind([userId, date]);
  if (stmt.step()) {
    const json = stmt.get()[0];
    stmt.free();
    try { return JSON.parse(json); } catch { return null; }
  }
  stmt.free();
  return null;
}

function putTasks(userId, date, tasks) {
  db.run('INSERT OR REPLACE INTO tasks (user_id, date, tasks_json) VALUES (?, ?, ?)', [userId, date, JSON.stringify(tasks)]);
  saveDb();
}

function deleteTasks(userId, date) {
  if (date) {
    db.run('DELETE FROM tasks WHERE user_id = ? AND date = ?', [userId, date]);
  } else {
    db.run('DELETE FROM tasks WHERE user_id = ?', [userId]);
  }
  saveDb();
}

// Records operations
function getRecords(userId, limit = 500) {
  const results = [];
  const stmt = db.prepare('SELECT record_json FROM records WHERE user_id = ? ORDER BY created_at DESC LIMIT ?');
  stmt.bind([userId, limit]);
  while (stmt.step()) {
    try {
      results.push(JSON.parse(stmt.get()[0]));
    } catch {}
  }
  stmt.free();
  return results;
}

function getRecordsByDate(userId, date) {
  const results = [];
  const stmt = db.prepare('SELECT record_json FROM records WHERE user_id = ? AND date = ? ORDER BY created_at DESC');
  stmt.bind([userId, date]);
  while (stmt.step()) {
    try {
      results.push(JSON.parse(stmt.get()[0]));
    } catch {}
  }
  stmt.free();
  return results;
}

function putRecord(userId, record) {
  const id = record.id || require('crypto').randomUUID();
  const date = record.date ? record.date.slice(0, 10) : '';
  const now = new Date().toISOString();

  // Check if record exists
  const stmt = db.prepare('SELECT id FROM records WHERE id = ?');
  stmt.bind([id]);
  const exists = stmt.step();
  stmt.free();

  if (exists) {
    db.run('UPDATE records SET record_json = ?, date = ? WHERE id = ?', [JSON.stringify({ ...record, id }), date, id]);
  } else {
    db.run('INSERT INTO records (id, user_id, date, record_json, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, userId, date, JSON.stringify({ ...record, id }), now]);
  }

  saveDb();
}

function pruneOldRecords(userId, days = 90) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  db.run("DELETE FROM records WHERE user_id = ? AND date < ? AND date != ''", [userId, cutoffStr]);
}

function deleteRecords(userId) {
  db.run('DELETE FROM records WHERE user_id = ?', [userId]);
  saveDb();
}

function pruneAllOldRecords(days = 90) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  db.run("DELETE FROM records WHERE date < ? AND date != ''", [cutoffStr]);
  saveDb();
}

module.exports = {
  initDb,
  getDb,
  saveDb,
  flushDbSync,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  listUsers,
  renameUserIdentifier,
  getTasks,
  putTasks,
  deleteTasks,
  getRecords,
  getRecordsByDate,
  putRecord,
  deleteRecords,
  pruneAllOldRecords,
  getSetting,
  setSetting
};
