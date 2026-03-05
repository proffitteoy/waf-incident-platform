const test = require('node:test');
const assert = require('node:assert/strict');

const { createApp } = require('../src/app');

let server;
let baseUrl;

test.before(async () => {
  const app = createApp();

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

test('health endpoint', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.ok, true);
});

test('sqli payload reaches login endpoint', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: "admin' OR '1'='1",
      password: 'demo'
    })
  });

  assert.equal(response.status, 401);
  const json = await response.json();
  assert.equal(json.ok, false);
  assert.match(json.sql_preview, /OR '1'='1/);
});

test('command preview returns unsanitized command string', async () => {
  const response = await fetch(`${baseUrl}/api/tools/ping-preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      host: '8.8.8.8;cat /etc/passwd'
    })
  });

  assert.equal(response.status, 200);
  const json = await response.json();
  assert.match(json.command_preview, /cat \/etc\/passwd/);
  assert.equal(json.executed, false);
});

test('path traversal is blocked by application boundary', async () => {
  const response = await fetch(`${baseUrl}/legacy/download?name=../../etc/passwd`);
  assert.equal(response.status, 400);
  const json = await response.json();
  assert.equal(json.ok, false);
  assert.match(json.message, /path traversal blocked/);
});
