const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const test = require('node:test');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

test('public records include the complete retained history', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schulte-records-api-'));
  const port = 36000 + (process.pid % 1000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), DB_PATH: path.join(tempDir, 'schulte.db'), USER_CREATE_CODE: 'test-create-code' },
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
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ authCode: 'test-create-code', password: 'test-password', user: { identifier: 'trenduser' } })
  })).json();
  assert.ok(created.sessionToken);

  for (let index = 0; index < 101; index += 1) {
    const response = await fetch(`${baseUrl}/api/users/trenduser/records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionToken: created.sessionToken,
        record: { id: `trend-${index}`, type: 'schulte', size: 5, timeMs: 1000 + index, errors: 0, accuracy: 100, date: '2026-07-16T08:00:00.000Z' }
      })
    });
    assert.equal(response.status, 200);
  }

  const publicRecords = await (await fetch(`${baseUrl}/api/users/trenduser/public`)).json();
  assert.equal(publicRecords.records.length, 101);
});
