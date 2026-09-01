const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const test = require('node:test');
const { normalizeWeeklyCloudTasks, tasksForWeeklyTemplate } = require('../src/utils');

const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function task(targetCount) {
  return { module: 'schulte', mode: { type: 'schulte', size: 3 }, targetCount };
}

function weekly(monCount) {
  return Object.fromEntries(days.map((day, index) => [day, index === 0 ? [task(monCount)] : []]));
}

function dateForWeekday(year, weekday) {
  const date = new Date(`${year}-01-01T12:00:00Z`);
  while (date.getUTCDay() !== weekday) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error('测试服务器提前退出');
    try {
      if ((await fetch(`${url}/health`)).ok) return;
    } catch {}
    await sleep(50);
  }
  throw new Error('测试服务器未在预期时间内启动');
}

test('weekly task templates are admin-only, recurring, and preserve history', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schulte-weekly-tasks-'));
  const port = 37000 + (process.pid % 1000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: path.join(tempDir, 'schulte.db'),
      ADMIN_PASSWORD: 'test-admin-password',
      USER_CREATE_CODE: 'test-create-code'
    },
    stdio: 'ignore'
  });

  t.after(async () => {
    if (child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await Promise.race([exited, sleep(3000)]);
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  await waitForServer(baseUrl, child);
  const created = await (await fetch(`${baseUrl}/api/users`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ authCode: 'test-create-code', password: 'user-password', user: { identifier: 'weeklyuser', username: 'Weekly' } })
  })).json();
  const sessionToken = created.sessionToken;
  const adminHeaders = { authorization: 'Bearer test-admin-password', 'content-type': 'application/json' };

  assert.equal((await fetch(`${baseUrl}/api/admin/users/weeklyuser`)).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/admin/users/weeklyuser/weekly-tasks`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ weeklyTasks: weekly(1) })
  })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/admin/users/weeklyuser/weekly-tasks`, {
    method: 'PUT', headers: adminHeaders, body: JSON.stringify({ weeklyTasks: { mon: [] } })
  })).status, 400);

  assert.equal((await fetch(`${baseUrl}/api/admin/users/weeklyuser/weekly-tasks`, {
    method: 'PUT', headers: adminHeaders, body: JSON.stringify({ weeklyTasks: weekly(1) })
  })).status, 200);

  const mondayPast = dateForWeekday(2020, 1);
  const mondayFuture = dateForWeekday(2099, 1);
  assert.equal((await (await fetch(`${baseUrl}/api/users/weeklyuser?date=${mondayPast}`)).json()).tasks[0].targetCount, 1);
  assert.equal((await (await fetch(`${baseUrl}/api/users/weeklyuser?date=${mondayFuture}`)).json()).tasks[0].targetCount, 1);
  for (const weekday of [2, 3, 4, 5, 6, 0]) {
    const date = dateForWeekday(2021, weekday);
    assert.deepEqual((await (await fetch(`${baseUrl}/api/users/weeklyuser?date=${date}`)).json()).tasks, []);
  }

  const injected = await (await fetch(`${baseUrl}/api/users/weeklyuser`, {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionToken, user: { identifier: 'weeklyuser', username: 'Updated' }, tasks: [task(50)], weeklyTasks: weekly(50) })
  })).json();
  assert.notEqual(injected.tasks[0]?.targetCount, 50);

  const saved = await (await fetch(`${baseUrl}/api/admin/users/weeklyuser/weekly-tasks`, {
    method: 'PUT', headers: adminHeaders, body: JSON.stringify({ weeklyTasks: weekly(2) })
  })).json();
  assert.equal(saved.weeklyTasks.mon[0].targetCount, 2);
  assert.equal((await (await fetch(`${baseUrl}/api/users/weeklyuser?date=${mondayPast}`)).json()).tasks[0].targetCount, 1);
  assert.equal((await (await fetch(`${baseUrl}/api/users/weeklyuser?date=${mondayFuture}`)).json()).tasks[0].targetCount, 2);

  await fetch(`${baseUrl}/api/users/weeklyuser`, {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionToken, user: { identifier: 'renameduser', username: 'Updated' } })
  });
  const renamed = await (await fetch(`${baseUrl}/api/admin/users/renameduser`, { headers: adminHeaders })).json();
  assert.equal(renamed.weeklyTasks.mon[0].targetCount, 2);
  assert.equal((await fetch(`${baseUrl}/api/admin/users/weeklyuser`, { headers: adminHeaders })).status, 404);

  assert.equal((await fetch(`${baseUrl}/api/admin/users/renameduser`, {
    method: 'DELETE', headers: adminHeaders, body: JSON.stringify({})
  })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/admin/users/renameduser`, { headers: adminHeaders })).status, 404);
});

test('legacy single-day templates apply to every weekday', () => {
  const legacy = [task(3)];
  const weeklyTasks = normalizeWeeklyCloudTasks(legacy);
  assert.deepEqual(Object.keys(weeklyTasks), days);
  assert.equal(tasksForWeeklyTemplate(legacy, '2026-08-31')[0].targetCount, 3);
  assert.equal(tasksForWeeklyTemplate(legacy, '2026-09-06')[0].targetCount, 3);
});
