const assert = require('node:assert/strict');
const test = require('node:test');
const { renderPublicUserPage } = require('../src/html');
const { normalizeCloudRecord, recordCompletesCloudTask, cloudTaskText } = require('../src/utils');

test('mindfulness records retain snapshots and honor optional audio bindings', () => {
  const record = normalizeCloudRecord({
    id: 'mindfulness-record',
    type: 'mindfulness',
    audioId: 'audio-1',
    audioName: '晨间呼吸',
    audioCompleted: true,
    timeMs: 32000,
    practiceMs: 32000,
    date: '2026-07-14T08:00:00.000Z'
  });
  assert.equal(record.audioId, 'audio-1');
  assert.equal(record.audioName, '晨间呼吸');
  assert.equal(record.audioCompleted, true);
  assert.equal(recordCompletesCloudTask(record, { mode: { type: 'mindfulness' } }), true);
  assert.equal(recordCompletesCloudTask(record, { mode: { type: 'mindfulness', audioId: 'audio-1' } }), true);
  assert.equal(recordCompletesCloudTask(record, { mode: { type: 'mindfulness', audioId: 'deleted-audio' } }), false);
  assert.equal(recordCompletesCloudTask(record, { mode: { type: 'mindfulness', audioId: 'audio-1' } }, () => false), false);
  assert.equal(cloudTaskText({ mode: { type: 'mindfulness', audioId: 'audio-1' } }, () => '改名后的晨间呼吸'), '正念练习 · 改名后的晨间呼吸');
  assert.equal(cloudTaskText({ mode: { type: 'mindfulness', audioId: 'deleted-audio' } }, () => ''), '正念练习 · 音频已删除');

  const task = { mode: { type: 'mindfulness', audioId: 'audio-1' }, targetCount: 1, completedCount: 1, completed: true };
  const page = renderPublicUserPage({ identifier: 'demo', username: '演示用户', birthDate: '' }, [record], [task], [record], 'Asia/Shanghai', () => '改名后的晨间呼吸');
  assert.match(page, /晨间呼吸/);
  assert.match(page, /改名后的晨间呼吸/);
  assert.match(page, /完整播放/);
  assert.doesNotMatch(page, /正确率/);
});
