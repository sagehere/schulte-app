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
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {}
    await sleep(50);
  }
  throw new Error('测试服务器未在预期时间内启动');
}

test('audio guide APIs require admin access and support the MP3 lifecycle', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schulte-audio-api-'));
  const port = 34000 + (process.pid % 1000);
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
  const initial = await (await fetch(`${baseUrl}/api/audio-guides`)).json();
  assert.ok(initial.audios.some((audio) => audio.id === 'bgm1.mp3'));
  const defaultAudio = initial.audios.find((audio) => audio.id === 'bgm1.mp3');
  assert.equal((await fetch(`${baseUrl}${defaultAudio.url}`, { headers: { Range: 'bytes=0-2' } })).status, 206);

  const mp3 = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);
  assert.equal((await fetch(`${baseUrl}/api/admin/audio-guides?name=呼吸`, {
    method: 'POST', headers: { 'content-type': 'audio/mpeg' }, body: mp3
  })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/admin/audio-guides?name=呼吸`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-admin-password', 'content-type': 'audio/mpeg' },
    body: mp3
  })).status, 201);

  const uploaded = await (await fetch(`${baseUrl}/api/audio-guides`)).json();
  const audio = uploaded.audios.find((item) => item.name === '呼吸');
  assert.ok(audio);
  const renamedResponse = await fetch(`${baseUrl}/api/admin/audio-guides/${encodeURIComponent(audio.id)}`, {
    method: 'PUT',
    headers: { authorization: 'Bearer test-admin-password', 'content-type': 'application/json' },
    body: JSON.stringify({ name: '晨间呼吸' })
  });
  assert.equal(renamedResponse.status, 200);
  const renamed = (await renamedResponse.json()).audio;
  assert.equal(renamed.id, audio.id);

  assert.equal((await fetch(`${baseUrl}/api/admin/audio-guides/order`, {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids: [renamed.id, defaultAudio.id] })
  })).status, 403);
  const reordered = await fetch(`${baseUrl}/api/admin/audio-guides/order`, {
    method: 'PUT',
    headers: { authorization: 'Bearer test-admin-password', 'content-type': 'application/json' },
    body: JSON.stringify({ ids: [renamed.id, defaultAudio.id] })
  });
  assert.equal(reordered.status, 200);
  assert.deepEqual((await (await fetch(`${baseUrl}/api/audio-guides`)).json()).audios.map((item) => item.id), [renamed.id, defaultAudio.id]);
  assert.equal((await fetch(`${baseUrl}/api/admin/audio-guides/order`, {
    method: 'PUT', headers: { authorization: 'Bearer test-admin-password', 'content-type': 'application/json' },
    body: JSON.stringify({ ids: [renamed.id] })
  })).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/admin/audio-guides/${encodeURIComponent(renamed.id)}`, {
    method: 'DELETE', headers: { authorization: 'Bearer test-admin-password' }
  })).status, 200);
});
