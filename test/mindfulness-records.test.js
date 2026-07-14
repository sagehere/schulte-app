const assert = require('node:assert/strict');
const test = require('node:test');
const { renderPublicUserPage } = require('../src/html');
const { normalizeCloudRecord, recordCompletesCloudTask } = require('../src/utils');

test('mindfulness records retain audio metadata and complete an unbound daily task', () => {
  const record = normalizeCloudRecord({
    id: 'mindfulness-record',
    type: 'mindfulness',
    audioName: '晨间呼吸',
    audioCompleted: true,
    timeMs: 32000,
    practiceMs: 32000,
    date: '2026-07-14T08:00:00.000Z'
  });
  assert.equal(record.audioName, '晨间呼吸');
  assert.equal(record.audioCompleted, true);
  assert.equal(recordCompletesCloudTask(record, { mode: { type: 'mindfulness' } }), true);

  const page = renderPublicUserPage({ identifier: 'demo', username: '演示用户', birthDate: '' }, [record], [], [record], 'Asia/Shanghai');
  assert.match(page, /晨间呼吸/);
  assert.match(page, /完整播放/);
  assert.doesNotMatch(page, /正确率/);
});
