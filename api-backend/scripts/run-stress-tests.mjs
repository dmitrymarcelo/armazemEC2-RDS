import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const reportsDir = path.resolve(backendDir, 'reports');

const args = process.argv.slice(2);
const argMap = new Map();
for (let i = 0; i < args.length; i += 1) {
  const token = args[i];
  if (!token.startsWith('--')) continue;
  const key = token.slice(2);
  const next = args[i + 1];
  if (!next || next.startsWith('--')) argMap.set(key, 'true');
  else {
    argMap.set(key, next);
    i += 1;
  }
}

const basePort = Number(argMap.get('port') || 3201);
const durationMultiplier = Number(argMap.get('duration-multiplier') || 1);
const seed = Number(argMap.get('seed') || Date.now());
const rng = (() => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
})();

const randomInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  const fixedIdx = Math.max(0, Math.min(idx, sortedArr.length - 1));
  return sortedArr[fixedIdx];
}

async function waitForHealth(baseUrl, timeoutMs = 45000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return true;
    } catch (err) {
      lastError = err;
    }
    await wait(300);
  }

  throw new Error(`Backend nao respondeu /health em ${timeoutMs}ms. Ultimo erro: ${lastError?.message || 'n/a'}`);
}

async function login(baseUrl, email, password) {
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function runClosedLoopScenario({
  name,
  durationSeconds,
  concurrency,
  task,
}) {
  const effectiveDurationMs = Math.max(1000, Math.floor(durationSeconds * durationMultiplier * 1000));
  const deadline = performance.now() + effectiveDurationMs;
  const latencies = [];
  let success = 0;
  let failed = 0;
  let bytes = 0;
  const statusMap = new Map();
  const errors = new Map();

  const workers = [];
  for (let w = 0; w < concurrency; w += 1) {
    workers.push((async () => {
      while (performance.now() < deadline) {
        const started = performance.now();
        try {
          const result = await task();
          const elapsed = performance.now() - started;
          latencies.push(elapsed);
          const status = Number(result?.status || 0);
          statusMap.set(status, (statusMap.get(status) || 0) + 1);

          if (status >= 200 && status < 400) {
            success += 1;
            bytes += Number(result?.bytes || 0);
          } else {
            failed += 1;
          }
        } catch (err) {
          const elapsed = performance.now() - started;
          latencies.push(elapsed);
          failed += 1;
          const key = String(err?.message || err || 'erro-desconhecido');
          errors.set(key, (errors.get(key) || 0) + 1);
        }
      }
    })());
  }

  const globalStart = performance.now();
  await Promise.all(workers);
  const totalMs = performance.now() - globalStart;

  latencies.sort((a, b) => a - b);

  const totalRequests = success + failed;
  const throughputRps = totalRequests / (totalMs / 1000);
  const successRate = totalRequests > 0 ? (success / totalRequests) * 100 : 0;

  return {
    name,
    concurrency,
    durationMs: Math.round(totalMs),
    totalRequests,
    success,
    failed,
    successRate: Number(successRate.toFixed(2)),
    throughputRps: Number(throughputRps.toFixed(2)),
    latencyMs: {
      min: Number((latencies[0] || 0).toFixed(2)),
      p50: Number(percentile(latencies, 50).toFixed(2)),
      p95: Number(percentile(latencies, 95).toFixed(2)),
      p99: Number(percentile(latencies, 99).toFixed(2)),
      max: Number((latencies[latencies.length - 1] || 0).toFixed(2)),
    },
    avgResponseBytes: success > 0 ? Number((bytes / success).toFixed(1)) : 0,
    statusCodes: Object.fromEntries([...statusMap.entries()].map(([k, v]) => [String(k), v])),
    errorSamples: Object.fromEntries([...errors.entries()].slice(0, 8)),
  };
}

function createRequestPayload(counter) {
  return {
    id: `REQ-STRESS-${Date.now()}-${counter}-${randomInt(1000, 9999)}`,
    sku: `SKU-${String(randomInt(1, 50000)).padStart(7, '0')}`,
    name: `Item Stress ${counter}`,
    qty: randomInt(1, 25),
    plate: `STR-${String(randomInt(1000, 9999))}`,
    dept: 'Operacoes',
    priority: 'Alta',
    status: 'aprovacao',
    cost_center: 'OPS-CD',
    warehouse_id: randomInt(0, 1) === 0 ? 'ARMZ28' : 'ARMZ33',
  };
}

async function main() {
  fs.mkdirSync(reportsDir, { recursive: true });

  const backend = spawn(process.execPath, ['index.js'], {
    cwd: backendDir,
    env: {
      ...process.env,
      PORT: String(basePort),
      NODE_ENV: 'production',
      DB_HOST: '127.0.0.1',
      DB_PORT: '6543',
      DB_USER: 'stress',
      DB_PASSWORD: 'stress',
      DB_NAME: 'stress',
      JWT_SECRET: 'stress-secret',
      JWT_EXPIRES_IN: '8h',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let backendLogs = '';
  backend.stdout.on('data', (d) => { backendLogs += d.toString(); });
  backend.stderr.on('data', (d) => { backendLogs += d.toString(); });

  const baseUrl = `http://127.0.0.1:${basePort}`;
  const runStartedAt = new Date().toISOString();

  try {
    await waitForHealth(baseUrl, 60000);

    const auth = await login(baseUrl, 'admin@nortetech.com', 'admin');
    if (!auth.response.ok || !auth.payload?.token) {
      throw new Error(`Login inicial falhou: status=${auth.response.status} body=${JSON.stringify(auth.payload)}`);
    }
    const bearer = `Bearer ${auth.payload.token}`;

    let writeCounter = 0;

    const scenarios = [];

    scenarios.push(await runClosedLoopScenario({
      name: 'login_burst',
      durationSeconds: 20,
      concurrency: 70,
      task: async () => {
        const started = performance.now();
        const response = await fetch(`${baseUrl}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'admin@nortetech.com', password: 'admin' }),
        });
        const txt = await response.text();
        return {
          status: response.status,
          bytes: txt.length,
          elapsed: performance.now() - started,
        };
      },
    }));

    scenarios.push(await runClosedLoopScenario({
      name: 'read_inventory_limited',
      durationSeconds: 25,
      concurrency: 120,
      task: async () => {
        const response = await fetch(`${baseUrl}/inventory?limit=200&order=sku:asc`, {
          headers: { Authorization: bearer },
        });
        const txt = await response.text();
        return { status: response.status, bytes: txt.length };
      },
    }));

    scenarios.push(await runClosedLoopScenario({
      name: 'read_inventory_full_payload',
      durationSeconds: 15,
      concurrency: 16,
      task: async () => {
        const response = await fetch(`${baseUrl}/inventory`, {
          headers: { Authorization: bearer },
        });
        const txt = await response.text();
        return { status: response.status, bytes: txt.length };
      },
    }));

    scenarios.push(await runClosedLoopScenario({
      name: 'write_material_requests',
      durationSeconds: 25,
      concurrency: 55,
      task: async () => {
        writeCounter += 1;
        const response = await fetch(`${baseUrl}/material_requests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: bearer,
          },
          body: JSON.stringify(createRequestPayload(writeCounter)),
        });
        const txt = await response.text();
        return { status: response.status, bytes: txt.length };
      },
    }));

    scenarios.push(await runClosedLoopScenario({
      name: 'mixed_flow_login_read_write',
      durationSeconds: 20,
      concurrency: 24,
      task: async () => {
        writeCounter += 1;
        const l = await fetch(`${baseUrl}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'admin@nortetech.com', password: 'admin' }),
        });
        const lBody = await l.json().catch(() => ({}));
        if (!l.ok || !lBody.token) {
          const txt = JSON.stringify(lBody);
          return { status: l.status, bytes: txt.length };
        }

        const authHeader = { Authorization: `Bearer ${lBody.token}` };
        const inv = await fetch(`${baseUrl}/inventory?limit=50&order=sku:asc`, { headers: authHeader });
        const mov = await fetch(`${baseUrl}/movements?limit=50&order=timestamp:desc`, { headers: authHeader });
        const req = await fetch(`${baseUrl}/material_requests`, {
          method: 'POST',
          headers: {
            ...authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(createRequestPayload(writeCounter)),
        });

        const invTxt = await inv.text();
        const movTxt = await mov.text();
        const reqTxt = await req.text();

        if (!inv.ok || !mov.ok || !req.ok) {
          const status = !inv.ok ? inv.status : !mov.ok ? mov.status : req.status;
          return { status, bytes: invTxt.length + movTxt.length + reqTxt.length };
        }

        return {
          status: 200,
          bytes: invTxt.length + movTxt.length + reqTxt.length,
        };
      },
    }));

    const totals = scenarios.reduce(
      (acc, item) => {
        acc.requests += item.totalRequests;
        acc.success += item.success;
        acc.failed += item.failed;
        return acc;
      },
      { requests: 0, success: 0, failed: 0 }
    );

    const report = {
      startedAt: runStartedAt,
      finishedAt: new Date().toISOString(),
      baseUrl,
      seed,
      durationMultiplier,
      totals,
      scenarios,
      notes: [
        'Teste executado em modo contingency-json (sem PostgreSQL).',
        'Os cenarios sao closed-loop; throughput depende de latencia observada.',
      ],
    };

    const outPath = path.join(reportsDir, `stress-report-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

    console.log(JSON.stringify({ reportPath: outPath, ...report }, null, 2));
  } finally {
    if (backend.exitCode === null) {
      backend.kill('SIGTERM');
      await Promise.race([
        new Promise((resolve) => backend.once('exit', resolve)),
        wait(8000),
      ]);
    }

    if (backend.exitCode === null) {
      backend.kill('SIGKILL');
    }

    if (backendLogs.trim().length > 0) {
      const logPath = path.join(reportsDir, `stress-backend-log-${Date.now()}.log`);
      fs.writeFileSync(logPath, backendLogs);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
