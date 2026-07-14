const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'schulte.db');
const AUDIO_DIR = path.join(path.dirname(DB_PATH), 'audio');
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

function audioFromFileName(fileName) {
  return { id: fileName, name: fileName.slice(0, -4) };
}

function listAudioGuides() {
  ensureAudioDir();
  return fs.readdirSync(AUDIO_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.mp3'))
    .map((entry) => audioFromFileName(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}

function resolveAudioPath(id) {
  const fileName = fileNameFor(id);
  const filePath = path.join(ensureAudioDir(), fileName);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) throw audioError('音频不存在', 404);
  return filePath;
}

function createAudioGuide(name, data) {
  if (!isMp3(data)) throw audioError('仅支持有效的 MP3 音频');
  if (data.length > MAX_AUDIO_BYTES) throw audioError('音频文件不能超过 50MB', 413);
  const fileName = fileNameFor(name);
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
  return audioFromFileName(fileName);
}

function renameAudioGuide(id, name) {
  const oldPath = resolveAudioPath(id);
  const nextFileName = fileNameFor(name);
  const nextPath = path.join(AUDIO_DIR, nextFileName);
  if (oldPath === nextPath) return audioFromFileName(nextFileName);
  if (fs.existsSync(nextPath)) throw audioError('已存在同名音频', 409);
  fs.renameSync(oldPath, nextPath);
  return audioFromFileName(nextFileName);
}

function deleteAudioGuide(id) {
  fs.unlinkSync(resolveAudioPath(id));
}

module.exports = {
  AUDIO_DIR,
  MAX_AUDIO_BYTES,
  ensureAudioDir,
  listAudioGuides,
  resolveAudioPath,
  createAudioGuide,
  renameAudioGuide,
  deleteAudioGuide,
  fileNameFor,
  isMp3
};
