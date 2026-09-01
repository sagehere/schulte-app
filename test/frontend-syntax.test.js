const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('inline client script compiles', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new Function(scripts[0]));
});

test('mindfulness instructions and administrator weekly task controls are present', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.match(html, /开始前，请记住这几点：/);
  assert.match(html, /id="adminWeeklyTaskList"/);
  assert.match(html, /id="adminSaveWeeklyTasksButton"/);
  assert.match(html, /function saveAdminWeeklyTaskOrder\(\)/);
  assert.match(html, /<h2>今日任务<\/h2>/);
  assert.match(html, /sortable-row-handle/);
});
