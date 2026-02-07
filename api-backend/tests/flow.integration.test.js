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
      // ignore until timeout
    }
    await wait(250);
  }
  throw new Error('Backend nao ficou pronto para teste de fluxo');
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
      JWT_SECRET: 'flow-test-secret',
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

test('fluxo integrado: login -> leitura -> criacao -> atualizacao -> exclusao', async (t) => {
  const server = await startServer();
  t.after(async () => {
    await server.stop();
  });

  const loginResponse = await fetch(`${server.baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@nortetech.com',
      password: 'admin',
    }),
  });
  assert.equal(loginResponse.status, 200);
  const loginPayload = await loginResponse.json();
  assert.ok(loginPayload?.token);

  const authHeaders = {
    Authorization: `Bearer ${loginPayload.token}`,
  };

  const inventoryResponse = await fetch(`${server.baseUrl}/inventory?limit=5&order=sku:asc`, {
    headers: authHeaders,
  });
  assert.equal(inventoryResponse.status, 200);
  const inventoryPayload = await inventoryResponse.json();
  assert.ok(Array.isArray(inventoryPayload.data));
  assert.ok(inventoryPayload.data.length > 0);

  const pagedInventoryResponse = await fetch(`${server.baseUrl}/inventory?limit=2&offset=1&order=sku:asc`, {
    headers: authHeaders,
  });
  assert.equal(pagedInventoryResponse.status, 200);
  const pagedInventoryPayload = await pagedInventoryResponse.json();
  assert.ok(Array.isArray(pagedInventoryPayload.data));
  assert.ok(pagedInventoryPayload.data.length <= 2);

  const requestId = `REQ-FLOW-${Date.now()}`;
  const createResponse = await fetch(`${server.baseUrl}/material_requests`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: requestId,
      sku: inventoryPayload.data[0].sku,
      name: inventoryPayload.data[0].name,
      qty: 3,
      plate: 'FLOW-1234',
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
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: 'entregue',
    }),
  });
  assert.equal(updateResponse.status, 200);

  const readAfterUpdate = await fetch(`${server.baseUrl}/material_requests?id=${encodeURIComponent(requestId)}`, {
    headers: authHeaders,
  });
  assert.equal(readAfterUpdate.status, 200);
  const updatedPayload = await readAfterUpdate.json();
  assert.equal(updatedPayload.data[0].status, 'entregue');

  const deleteResponse = await fetch(`${server.baseUrl}/material_requests?id=${encodeURIComponent(requestId)}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  assert.equal(deleteResponse.status, 200);

  const readAfterDelete = await fetch(`${server.baseUrl}/material_requests?id=${encodeURIComponent(requestId)}`, {
    headers: authHeaders,
  });
  assert.equal(readAfterDelete.status, 200);
  const deletedPayload = await readAfterDelete.json();
  assert.equal(deletedPayload.data.length, 0);
});
