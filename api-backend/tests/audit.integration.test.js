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
      // ignora até ficar pronto
    }
    await wait(250);
  }
  throw new Error('Backend não ficou pronto para teste de auditoria');
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
      JWT_SECRET: 'audit-test-secret',
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

test('auditoria geral permite filtrar por entidade, termo e periodo', async (t) => {
  const server = await startServer();
  t.after(async () => {
    await server.stop();
  });

  const token = await login(server.baseUrl);
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const requestId = `REQ-AUD-${Date.now()}`;

  const createResponse = await fetch(`${server.baseUrl}/material_requests`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      id: requestId,
      sku: 'SKU-000001',
      name: 'Item Teste 1',
      qty: 2,
      plate: 'AUD-1234',
      dept: 'Operacoes',
      priority: 'Alta',
      status: 'aprovacao',
      cost_center: 'OPS-CD',
      warehouse_id: 'ARMZ28',
    }),
  });
  assert.equal(createResponse.status, 200);

  const updateResponse = await fetch(`${server.baseUrl}/material_requests?id=${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'separacao' }),
  });
  assert.equal(updateResponse.status, 200);

  const deleteResponse = await fetch(`${server.baseUrl}/material_requests?id=${encodeURIComponent(requestId)}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  assert.equal(deleteResponse.status, 200);

  const searchResponse = await fetch(
    `${server.baseUrl}/audit_logs/search?entity=material_requests&q=${encodeURIComponent(requestId)}&limit=30&warehouse_id=ARMZ28&include_global=false`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  assert.equal(searchResponse.status, 200);
  const searchPayload = await searchResponse.json();
  assert.equal(searchPayload.error, null);
  assert.ok(Array.isArray(searchPayload.data));
  assert.ok(searchPayload.data.length >= 3);

  const actions = new Set(searchPayload.data.map((row) => row.action));
  assert.equal(actions.has('create'), true);
  assert.equal(actions.has('update'), true);
  assert.equal(actions.has('delete'), true);

  const futureResponse = await fetch(
    `${server.baseUrl}/audit_logs/search?entity=material_requests&from=2100-01-01T00:00:00.000Z&limit=30`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  assert.equal(futureResponse.status, 200);
  const futurePayload = await futureResponse.json();
  assert.equal(Array.isArray(futurePayload.data), true);
  assert.equal(futurePayload.data.length, 0);
});
