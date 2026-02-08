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

test('recebimento idempotente: nao permite finalizar o mesmo PO duas vezes', async (t) => {
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
    'Content-Type': 'application/json',
  };

  const stamp = Date.now();
  const sku = `SKU-REC-${stamp}`;
  const poId = `PO-REC-${stamp}`;

  const createInventory = await fetch(`${server.baseUrl}/inventory`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      sku,
      name: 'Item Recebimento Teste',
      location: 'A-01-01',
      batch: `B-${stamp}`,
      expiry: '2030-12-31',
      quantity: 10,
      status: 'disponivel',
      image_url: '',
      category: 'Teste',
      min_qty: 1,
      max_qty: 999,
      unit: 'UN',
      lead_time: 7,
      safety_stock: 2,
      warehouse_id: 'ARMZ28',
    }),
  });
  assert.equal(createInventory.status, 200);

  const createPo = await fetch(`${server.baseUrl}/purchase_orders`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      id: poId,
      vendor: 'Fornecedor Teste',
      request_date: new Date().toISOString(),
      status: 'enviado',
      priority: 'normal',
      total: 100,
      requester: 'Teste',
      items: [{ sku, name: 'Item Recebimento Teste', qty: 5, price: 20 }],
      quotes: [],
      approval_history: [],
      warehouse_id: 'ARMZ28',
    }),
  });
  assert.equal(createPo.status, 200);

  const firstFinalize = await fetch(`${server.baseUrl}/receipts/finalize`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      po_id: poId,
      warehouse_id: 'ARMZ28',
      items: [{ sku, received: 5 }],
    }),
  });
  assert.equal(firstFinalize.status, 200);
  const firstPayload = await firstFinalize.json();
  assert.equal(firstPayload.error, null);
  assert.equal(firstPayload.data?.po?.status, 'recebido');

  const secondFinalize = await fetch(`${server.baseUrl}/receipts/finalize`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      po_id: poId,
      warehouse_id: 'ARMZ28',
      items: [{ sku, received: 5 }],
    }),
  });
  assert.equal(secondFinalize.status, 409);

  const readInventory = await fetch(
    `${server.baseUrl}/inventory?sku=${encodeURIComponent(sku)}&warehouse_id=ARMZ28`,
    { headers: { Authorization: `Bearer ${loginPayload.token}` } }
  );
  assert.equal(readInventory.status, 200);
  const inventoryPayload = await readInventory.json();
  assert.equal(inventoryPayload.data.length, 1);
  assert.equal(Number(inventoryPayload.data[0].quantity), 15);

  const readMovements = await fetch(
    `${server.baseUrl}/movements?order_id=${encodeURIComponent(poId)}&warehouse_id=ARMZ28`,
    { headers: { Authorization: `Bearer ${loginPayload.token}` } }
  );
  assert.equal(readMovements.status, 200);
  const movementPayload = await readMovements.json();
  assert.equal(Array.isArray(movementPayload.data), true);
  assert.equal(movementPayload.data.length, 1);

  await fetch(
    `${server.baseUrl}/movements?order_id=${encodeURIComponent(poId)}&warehouse_id=ARMZ28`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${loginPayload.token}` } }
  );
  await fetch(
    `${server.baseUrl}/purchase_orders?id=${encodeURIComponent(poId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${loginPayload.token}` } }
  );
  await fetch(
    `${server.baseUrl}/inventory?sku=${encodeURIComponent(sku)}&warehouse_id=ARMZ28`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${loginPayload.token}` } }
  );
});
