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

test('audio guides keep stable IDs across rename, ordering, and deletion', () => {
  const originalDbPath = process.env.DB_PATH;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schulte-audio-'));
  try {
    const audioGuides = loadAudioGuides(tempDir);
    assert.ok(audioGuides.listAudioGuides().some((audio) => audio.id === 'bgm1.mp3'));
    assert.throws(() => audioGuides.fileNameFor('../bad'), /特殊字符/);
    assert.throws(() => audioGuides.createAudioGuide('无效', Buffer.from('not-mp3')), /有效的 MP3/);

    const mp3 = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);
    const breathing = audioGuides.createAudioGuide('呼吸练习', mp3);
    assert.equal(breathing.name, '呼吸练习');
    assert.match(breathing.id, /^[0-9a-f-]{36}$/i);
    assert.throws(() => audioGuides.createAudioGuide('呼吸练习', mp3), (error) => error.status === 409);
    const sitting = audioGuides.createAudioGuide('静坐练习', mp3);
    assert.throws(() => audioGuides.renameAudioGuide(breathing.id, '静坐练习'), (error) => error.status === 409);
    assert.deepEqual(audioGuides.renameAudioGuide(breathing.id, '晨间呼吸'), { id: breathing.id, name: '晨间呼吸' });

    const ordered = audioGuides.reorderAudioGuides([sitting.id, 'bgm1.mp3', breathing.id]);
    assert.deepEqual(ordered.map((audio) => audio.id), [sitting.id, 'bgm1.mp3', breathing.id]);
    assert.throws(() => audioGuides.reorderAudioGuides([breathing.id]), /必须包含全部/);
    assert.throws(() => audioGuides.reorderAudioGuides([sitting.id, sitting.id, breathing.id]), /无效或重复/);

    audioGuides.deleteAudioGuide(breathing.id);
    assert.ok(!audioGuides.listAudioGuides().some((audio) => audio.id === breathing.id));
    const reuploaded = audioGuides.createAudioGuide('晨间呼吸', mp3);
    assert.notEqual(reuploaded.id, breathing.id);
  } finally {
    if (originalDbPath === undefined) delete process.env.DB_PATH;
    else process.env.DB_PATH = originalDbPath;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
