const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeCloudRecord, recordCompletesCloudTask } = require('../src/utils');

const task = { module: 'schulte', mode: { type: 'schulte', size: 5, reverse: false, colorInterference: false } };

test('new records start unfinished and legacy records remain compatible', () => {
  assert.equal(normalizeCloudRecord({ type: 'schulte', status: 'unfinished' }).status, 'unfinished');
  assert.equal(recordCompletesCloudTask({ type: 'schulte', size: 5 }, task), true);
});

test('unfinished records never complete a daily task', () => {
  assert.equal(recordCompletesCloudTask({ type: 'schulte', size: 5, status: 'unfinished' }, task), false);
  assert.equal(recordCompletesCloudTask({ type: 'schulte', size: 5, status: 'completed' }, task), true);
});
