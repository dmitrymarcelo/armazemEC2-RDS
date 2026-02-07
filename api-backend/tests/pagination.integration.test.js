import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });

async function waitForHealth(baseUrl, timeoutMs = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const health = await fetch(`${baseUrl}/health`);
      if (health.ok) return;
    } catch {
      // Ignora ate estar pronto
    }
    await wait(250);
  }
  throw new Error('Backend nao ficou pronto para teste de paginacao');
}

async function startServer() {
  const port = await getFreePort();
  const proc = spawn(process.execPath, ['index.js'], {
    cwd: backendDir,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      DB_HOST: '127.0.0.1',
      DB_PORT: '6543',
      DB_USER: 'test',
      DB_PASSWORD: 'test',
      DB_NAME: 'test',
      JWT_SECRET: 'pagination-test-secret',
    },
    stdio: 'ignore',
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHealth(baseUrl);

  return {
    baseUrl,
    stop: async () => {
      if (proc.exitCode !== null) return;
      proc.kill('SIGTERM');
      await Promise.race([
        new Promise((resolve) => proc.once('exit', resolve)),
        wait(5000),
      ]);
      if (proc.exitCode === null) proc.kill('SIGKILL');
    },
  };
}

async function login(baseUrl) {
  const loginResponse = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@nortetech.com',
      password: 'admin',
    }),
  });

  assert.equal(loginResponse.status, 200);
  const payload = await loginResponse.json();
  assert.ok(payload?.token);
  return payload.token;
}

test('paginacao com offset retorna segmentos distintos e valida parametros invalidos', async (t) => {
  const server = await startServer();
  t.after(async () => {
    await server.stop();
  });

  const token = await login(server.baseUrl);
  const authHeaders = { Authorization: `Bearer ${token}` };

  const page1Response = await fetch(`${server.baseUrl}/inventory?order=sku:asc&limit=3&offset=0`, {
    headers: authHeaders,
  });
  assert.equal(page1Response.status, 200);
  const page1 = await page1Response.json();
  assert.equal(page1.error, null);
  assert.ok(Array.isArray(page1.data));
  assert.equal(page1.data.length, 3);

  const page2Response = await fetch(`${server.baseUrl}/inventory?order=sku:asc&limit=3&offset=3`, {
    headers: authHeaders,
  });
  assert.equal(page2Response.status, 200);
  const page2 = await page2Response.json();
  assert.equal(page2.error, null);
  assert.ok(Array.isArray(page2.data));
  assert.equal(page2.data.length, 3);

  const page1Skus = page1.data.map((row) => row.sku);
  const page2Skus = page2.data.map((row) => row.sku);

  for (const sku of page1Skus) {
    assert.equal(page2Skus.includes(sku), false);
  }

  const invalidOffsetResponse = await fetch(`${server.baseUrl}/inventory?offset=-1`, {
    headers: authHeaders,
  });
  assert.equal(invalidOffsetResponse.status, 400);
});
