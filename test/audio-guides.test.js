const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

function loadAudioGuides(tempDir) {
  const modulePath = require.resolve('../src/audio-guides');
  delete require.cache[modulePath];
  process.env.DB_PATH = path.join(tempDir, 'schulte.db');
  return require('../src/audio-guides');
}

test('audio guides seed, validate, create, rename, and delete MP3 files', () => {
  const originalDbPath = process.env.DB_PATH;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schulte-audio-'));
  try {
    const audioGuides = loadAudioGuides(tempDir);
    assert.ok(audioGuides.listAudioGuides().some((audio) => audio.id === 'bgm1.mp3'));
    assert.throws(() => audioGuides.fileNameFor('../bad'), /特殊字符/);
    assert.throws(() => audioGuides.createAudioGuide('无效', Buffer.from('not-mp3')), /有效的 MP3/);

    const mp3 = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);
    assert.deepEqual(audioGuides.createAudioGuide('呼吸练习', mp3), { id: '呼吸练习.mp3', name: '呼吸练习' });
    assert.throws(() => audioGuides.createAudioGuide('呼吸练习', mp3), (error) => error.status === 409);
    audioGuides.createAudioGuide('静坐练习', mp3);
    assert.throws(() => audioGuides.renameAudioGuide('呼吸练习.mp3', '静坐练习'), (error) => error.status === 409);
    assert.deepEqual(audioGuides.renameAudioGuide('呼吸练习.mp3', '晨间呼吸'), { id: '晨间呼吸.mp3', name: '晨间呼吸' });
    audioGuides.deleteAudioGuide('晨间呼吸.mp3');
    assert.ok(!audioGuides.listAudioGuides().some((audio) => audio.id === '晨间呼吸.mp3'));
  } finally {
    if (originalDbPath === undefined) delete process.env.DB_PATH;
    else process.env.DB_PATH = originalDbPath;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
