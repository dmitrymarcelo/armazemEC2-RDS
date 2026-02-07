import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendDir, '..');

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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForHealth = async (baseUrl, timeoutMs = 20000) => {
  const startAt = Date.now();
  let lastError = null;

  while (Date.now() - startAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch (err) {
      lastError = err;
    }

    await wait(250);
  }

  throw new Error(`Backend nao ficou pronto em ${timeoutMs}ms. Ultimo erro: ${lastError?.message || 'desconhecido'}`);
};

const startServer = async ({ startFromRepoRoot }) => {
  const port = await getFreePort();
  const args = startFromRepoRoot ? ['api-backend/index.js'] : ['index.js'];
  const cwd = startFromRepoRoot ? repoRoot : backendDir;

  const child = spawn(process.execPath, args, {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DB_HOST: '127.0.0.1',
      DB_PORT: '6543',
      DB_USER: 'test',
      DB_PASSWORD: 'test',
      DB_NAME: 'test',
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '8h',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let logs = '';
  child.stdout.on('data', (chunk) => {
    logs += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    logs += chunk.toString();
  });

  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await waitForHealth(baseUrl);
  } catch (err) {
    child.kill('SIGTERM');
    throw new Error(`${err.message}\nLogs do backend:\n${logs}`);
  }

  return {
    baseUrl,
    stop: async () => {
      if (child.exitCode !== null) return;

      child.kill('SIGTERM');
      await Promise.race([
        new Promise((resolve) => child.once('exit', resolve)),
        wait(5000),
      ]);

      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
    },
  };
};

test('login funciona com credencial seed ao iniciar backend pela raiz do projeto', async (t) => {
  const server = await startServer({ startFromRepoRoot: true });
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
  const payload = await loginResponse.json();

  assert.equal(payload.error, null);
  assert.equal(payload.data.email, 'admin@nortetech.com');
  assert.ok(typeof payload.token === 'string' && payload.token.length > 20);
});

test('login invalido retorna 401 e rota protegida exige token valido', async (t) => {
  const server = await startServer({ startFromRepoRoot: false });
  t.after(async () => {
    await server.stop();
  });

  const invalidLogin = await fetch(`${server.baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@nortetech.com',
      password: 'senha-errada',
    }),
  });

  assert.equal(invalidLogin.status, 401);

  const withoutToken = await fetch(`${server.baseUrl}/inventory`);
  assert.equal(withoutToken.status, 401);

  const validLogin = await fetch(`${server.baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@nortetech.com',
      password: 'admin',
    }),
  });
  assert.equal(validLogin.status, 200);
  const validPayload = await validLogin.json();

  const withToken = await fetch(`${server.baseUrl}/inventory`, {
    headers: {
      Authorization: `Bearer ${validPayload.token}`,
    },
  });

  assert.equal(withToken.status, 200);
  const inventoryPayload = await withToken.json();
  assert.equal(inventoryPayload.error, null);
  assert.ok(Array.isArray(inventoryPayload.data));
});
