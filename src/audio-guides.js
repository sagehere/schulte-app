const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'schulte.db');
const AUDIO_DIR = path.join(path.dirname(DB_PATH), 'audio');
const CATALOG_PATH = path.join(AUDIO_DIR, '.audio-guides.json');
const DEFAULT_AUDIO_PATH = path.join(__dirname, '..', 'bgm1.mp3');
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

function audioError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function fileNameFor(name) {
  let base = String(name || '').trim();
  if (base.toLowerCase().endsWith('.mp3')) base = base.slice(0, -4).trim();
  if (!base || base.length > 80) throw audioError('音频名称需为 1-80 个字符');
  if (base === '.' || base === '..' || /[\x00-\x1f\\/:*?"<>|]/.test(base)) {
    throw audioError('音频名称不能包含路径或特殊字符');
  }
  return `${base}.mp3`;
}

function ensureAudioDir() {
  const firstRun = !fs.existsSync(AUDIO_DIR);
  if (firstRun) fs.mkdirSync(AUDIO_DIR, { recursive: true });
  if (firstRun && fs.existsSync(DEFAULT_AUDIO_PATH)) {
    fs.copyFileSync(DEFAULT_AUDIO_PATH, path.join(AUDIO_DIR, 'bgm1.mp3'), fs.constants.COPYFILE_EXCL);
  }
  return AUDIO_DIR;
}

function isMp3(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 2 && (
    (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from('ID3'))) ||
    (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
  );
}

function audioFromCatalogEntry(entry) {
  return { id: entry.id, name: entry.name };
}

function audioFileNames() {
  return fs.readdirSync(ensureAudioDir(), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.mp3'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function readCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) return null;
  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  } catch {
    throw audioError('音频目录数据损坏', 500);
  }
  if (!Array.isArray(catalog)) throw audioError('音频目录数据损坏', 500);

  const ids = new Set();
  return catalog.map((entry) => {
    const id = String(entry && entry.id || '');
    const name = String(entry && entry.name || '');
    const fileName = String(entry && entry.fileName || '');
    if (!id || id.length > 100 || ids.has(id) || fileNameFor(name) !== fileName) {
      throw audioError('音频目录数据损坏', 500);
    }
    ids.add(id);
    return { id, name, fileName };
  });
}

function writeCatalog(catalog) {
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog), 'utf8');
}

function syncCatalog() {
  const files = audioFileNames();
  const catalog = readCatalog();
  if (!catalog) {
    const initial = files.map((fileName) => ({
      // 保留既有文件名 ID，避免升级时打断当前浏览器已加载的音频。
      id: fileName,
      name: fileName.slice(0, -4),
      fileName
    }));
    writeCatalog(initial);
    return initial;
  }

  const fileSet = new Set(files);
  const current = catalog.filter((entry) => fileSet.has(entry.fileName));
  const tracked = new Set(current.map((entry) => entry.fileName));
  files.filter((fileName) => !tracked.has(fileName)).forEach((fileName) => {
    current.push({ id: crypto.randomUUID(), name: fileName.slice(0, -4), fileName });
  });
  if (current.length !== catalog.length || current.some((entry, index) => entry !== catalog[index])) writeCatalog(current);
  return current;
}

function catalogEntry(id) {
  const entry = syncCatalog().find((audio) => audio.id === String(id || ''));
  if (!entry) throw audioError('音频不存在', 404);
  return entry;
}

function listAudioGuides() {
  return syncCatalog().map(audioFromCatalogEntry);
}

function resolveAudioPath(id) {
  const filePath = path.join(ensureAudioDir(), catalogEntry(id).fileName);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) throw audioError('音频不存在', 404);
  return filePath;
}

function createAudioGuide(name, data) {
  if (!isMp3(data)) throw audioError('仅支持有效的 MP3 音频');
  if (data.length > MAX_AUDIO_BYTES) throw audioError('音频文件不能超过 50MB', 413);
  const fileName = fileNameFor(name);
  const catalog = syncCatalog();
  const targetPath = path.join(ensureAudioDir(), fileName);
  if (fs.existsSync(targetPath)) throw audioError('已存在同名音频', 409);

  const temporaryPath = path.join(AUDIO_DIR, `.${fileName}.${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporaryPath, data, { flag: 'wx' });
    fs.renameSync(temporaryPath, targetPath);
  } catch (error) {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    throw error;
  }
  const entry = { id: crypto.randomUUID(), name: fileName.slice(0, -4), fileName };
  try {
    writeCatalog([...catalog, entry]);
  } catch (error) {
    fs.unlinkSync(targetPath);
    throw error;
  }
  return audioFromCatalogEntry(entry);
}

function renameAudioGuide(id, name) {
  const catalog = syncCatalog();
  const entry = catalog.find((audio) => audio.id === String(id || ''));
  if (!entry) throw audioError('音频不存在', 404);
  const oldPath = path.join(AUDIO_DIR, entry.fileName);
  const nextFileName = fileNameFor(name);
  const nextPath = path.join(AUDIO_DIR, nextFileName);
  if (entry.fileName === nextFileName) return audioFromCatalogEntry(entry);
  if (fs.existsSync(nextPath)) throw audioError('已存在同名音频', 409);
  fs.renameSync(oldPath, nextPath);
  const nextCatalog = catalog.map((audio) => audio.id === entry.id
    ? { ...audio, name: nextFileName.slice(0, -4), fileName: nextFileName }
    : audio);
  try {
    writeCatalog(nextCatalog);
  } catch (error) {
    fs.renameSync(nextPath, oldPath);
    throw error;
  }
  return audioFromCatalogEntry(nextCatalog.find((audio) => audio.id === entry.id));
}

function deleteAudioGuide(id) {
  const catalog = syncCatalog();
  const entry = catalog.find((audio) => audio.id === String(id || ''));
  if (!entry) throw audioError('音频不存在', 404);
  const filePath = path.join(AUDIO_DIR, entry.fileName);
  const temporaryPath = path.join(AUDIO_DIR, `.${entry.fileName}.${crypto.randomUUID()}.deleting`);
  fs.renameSync(filePath, temporaryPath);
  try {
    writeCatalog(catalog.filter((audio) => audio.id !== entry.id));
    fs.unlinkSync(temporaryPath);
  } catch (error) {
    if (fs.existsSync(temporaryPath)) fs.renameSync(temporaryPath, filePath);
    throw error;
  }
}

function reorderAudioGuides(ids) {
  const catalog = syncCatalog();
  if (!Array.isArray(ids) || ids.length !== catalog.length) throw audioError('音频排序必须包含全部音频');
  const byId = new Map(catalog.map((audio) => [audio.id, audio]));
  const ordered = ids.map((id) => byId.get(String(id || '')));
  if (ordered.some((audio) => !audio) || new Set(ids).size !== ids.length) {
    throw audioError('音频排序包含无效或重复项');
  }
  writeCatalog(ordered);
  return ordered.map(audioFromCatalogEntry);
}

module.exports = {
  AUDIO_DIR,
  CATALOG_PATH,
  MAX_AUDIO_BYTES,
  ensureAudioDir,
  listAudioGuides,
  resolveAudioPath,
  createAudioGuide,
  renameAudioGuide,
  deleteAudioGuide,
  reorderAudioGuides,
  fileNameFor,
  isMp3
};
