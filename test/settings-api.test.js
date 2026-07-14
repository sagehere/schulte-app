const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const test = require('node:test');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const defaultNavigation = ['schulte', 'stroop', 'idiom', 'poem', 'memory', 'decode', 'mindfulness']
  .map((id) => ({ id, visible: true }));

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

test('settings API validates and saves training navigation', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schulte-settings-api-'));
  const port = 35000 + (process.pid % 1000);
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
  const initial = await (await fetch(`${baseUrl}/api/settings`)).json();
  assert.deepEqual(initial.trainingNavigation, defaultNavigation);

  assert.equal((await fetch(`${baseUrl}/api/admin/settings`, {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ trainingNavigation: defaultNavigation })
  })).status, 403);

  const navigation = [
    { id: 'mindfulness', visible: true },
    { id: 'schulte', visible: false },
    ...defaultNavigation.filter((item) => !['mindfulness', 'schulte'].includes(item.id))
  ];
  const savedResponse = await fetch(`${baseUrl}/api/admin/settings`, {
    method: 'PUT',
    headers: { authorization: 'Bearer test-admin-password', 'content-type': 'application/json' },
    body: JSON.stringify({ trainingNavigation: navigation })
  });
  assert.equal(savedResponse.status, 200);
  assert.deepEqual((await savedResponse.json()).trainingNavigation, navigation);
  assert.deepEqual((await (await fetch(`${baseUrl}/api/settings`)).json()).trainingNavigation, navigation);

  const duplicate = [...navigation];
  duplicate[1] = { id: 'mindfulness', visible: true };
  assert.equal((await fetch(`${baseUrl}/api/admin/settings`, {
    method: 'PUT',
    headers: { authorization: 'Bearer test-admin-password', 'content-type': 'application/json' },
    body: JSON.stringify({ trainingNavigation: duplicate })
  })).status, 400);

  assert.equal((await fetch(`${baseUrl}/api/admin/settings`, {
    method: 'PUT',
    headers: { authorization: 'Bearer test-admin-password', 'content-type': 'application/json' },
    body: JSON.stringify({ trainingNavigation: navigation.map((item) => ({ ...item, visible: false })) })
  })).status, 400);
});
