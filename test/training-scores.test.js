const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeCloudRecord,
  scoreCloudTrainingRecord,
  scoreTrainingRecord
} = require('../src/utils');
const { renderPublicUserPage } = require('../src/html');

test('training scores honor age thresholds, accuracy, and variants', () => {
  assert.equal(scoreTrainingRecord({ type: 'stroop', timeMs: 24000, accuracy: 100 }, 7), '优秀');
  assert.equal(scoreTrainingRecord({ type: 'stroop', timeMs: 28000, accuracy: 100 }, 7), '良好');
  assert.equal(scoreTrainingRecord({ type: 'stroop', timeMs: 32000, accuracy: 100 }, 7), '中等');
  assert.equal(scoreTrainingRecord({ type: 'stroop', timeMs: 17000, accuracy: 80, textAnswer: true }, 18), '需努力');
  assert.equal(scoreTrainingRecord({ type: 'decode', timeMs: 31000, accuracy: 100, reverse: true }, 17), '优秀');
  assert.equal(scoreTrainingRecord({ type: 'decode', timeMs: 30000, accuracy: 100 }, 7), '8岁以下暂无适龄评分标准');
  assert.equal(scoreTrainingRecord({ type: 'stroop', timeMs: 20000, accuracy: 100 }, 6), '7岁以下暂无适龄评分标准');
});

test('memory scoring uses recorded unaided span and keeps old records unscored', () => {
  assert.equal(scoreTrainingRecord({ type: 'memory', accuracy: 100 }, 10), '旧记录暂无跨度数据');
  assert.equal(scoreTrainingRecord({ type: 'memory', accuracy: 100, memorySpan: 7 }, 10), '优秀');
  assert.equal(scoreTrainingRecord({ type: 'memory', accuracy: 100, memorySpan: 6 }, 10), '良好');
  assert.equal(scoreTrainingRecord({ type: 'memory', accuracy: 100, memorySpan: 5 }, 10), '中等');
  assert.equal(scoreTrainingRecord({ type: 'memory', accuracy: 80, memorySpan: 7 }, 10), '需努力');
  assert.equal(normalizeCloudRecord({ type: 'memory', memorySpan: 6 }).memorySpan, 6);
  assert.equal(normalizeCloudRecord({ type: 'memory' }).memorySpan, null);
});

test('cloud scoring uses the age on the record date', () => {
  const record = { type: 'stroop', timeMs: 18000, accuracy: 100, date: '2026-07-16T12:00:00.000Z' };
  assert.equal(scoreCloudTrainingRecord(record, '2008-07-17'), '良好');
  assert.equal(scoreCloudTrainingRecord(record, ''), '需填写出生日期');
  const page = renderPublicUserPage(
    { identifier: 'demo', username: '演示', birthDate: '2008-07-17' },
    [], [], [record], 'Asia/Shanghai'
  );
  assert.match(page, /等第：良好（训练参考，非医学诊断）/);
});
