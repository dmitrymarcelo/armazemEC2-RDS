import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import compression from 'compression';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const isProd = process.env.NODE_ENV === 'production';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const PASSWORD_PREFIX = 'pbkdf2';
const PASSWORD_ITERATIONS = 310000;
const PASSWORD_KEYLEN = 32;
const PASSWORD_DIGEST = 'sha256';

const RESERVED_QUERY_KEYS = new Set(['select', 'order', 'limit', 'offset']);

const TABLE_WHITELIST = [
  'users',
  'warehouses',
  'inventory',
  'cyclic_batches',
  'cyclic_counts',
  'vendors',
  'vehicles',
  'purchase_orders',
  'movements',
  'notifications',
  'material_requests',
  'cost_centers',
];

const TABLE_COLUMNS = {
  users: ['id', 'name', 'email', 'role', 'status', 'last_access', 'avatar', 'password', 'modules', 'allowed_warehouses', 'created_at'],
  warehouses: ['id', 'name', 'description', 'location', 'manager_name', 'manager_email', 'is_active', 'created_at'],
  inventory: ['sku', 'name', 'location', 'batch', 'expiry', 'quantity', 'status', 'image_url', 'category', 'min_qty', 'max_qty', 'unit', 'lead_time', 'safety_stock', 'abc_category', 'last_counted_at', 'warehouse_id', 'created_at'],
  cyclic_batches: ['id', 'status', 'scheduled_date', 'completed_at', 'accuracy_rate', 'total_items', 'divergent_items', 'warehouse_id', 'created_at'],
  cyclic_counts: ['id', 'batch_id', 'sku', 'expected_qty', 'counted_qty', 'status', 'notes', 'counted_at', 'warehouse_id'],
  vendors: ['id', 'name', 'cnpj', 'category', 'contact', 'email', 'status', 'created_at'],
  vehicles: ['plate', 'model', 'type', 'status', 'last_maintenance', 'cost_center', 'created_at'],
  purchase_orders: ['id', 'vendor', 'request_date', 'status', 'priority', 'total', 'requester', 'items', 'quotes', 'selected_quote_id', 'sent_to_vendor_at', 'received_at', 'quotes_added_at', 'approved_at', 'rejected_at', 'vendor_order_number', 'approval_history', 'plate', 'cost_center', 'warehouse_id', 'created_at'],
  movements: ['id', 'sku', 'product_name', 'type', 'quantity', 'timestamp', 'user', 'location', 'reason', 'order_id', 'warehouse_id'],
  notifications: ['id', 'title', 'message', 'type', 'read', 'user_id', 'created_at'],
  material_requests: ['id', 'sku', 'name', 'qty', 'plate', 'dept', 'priority', 'status', 'cost_center', 'warehouse_id', 'created_at'],
  cost_centers: ['id', 'code', 'name', 'manager', 'budget', 'status', 'created_at'],
};

const ensureDataDirExists = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

ensureDataDirExists();

let dbConnected = false;
const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  connectionTimeoutMillis: 2000,
});

pool
  .connect()
  .then((client) => {
    dbConnected = true;
    client.release();
    console.log('Connected to PostgreSQL.');
  })
  .catch(() => {
    dbConnected = false;
    console.warn('PostgreSQL unavailable. Running in JSON contingency mode.');
  });

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: allowedOrigins.length
      ? (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
          }
          callback(new Error('Not allowed by CORS'));
        }
      : true,
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));

const getJsonPath = (table) => path.join(DATA_DIR, `${table}.json`);
const jsonCache = new Map();

const readJson = (table) => {
  const filePath = getJsonPath(table);
  if (!fs.existsSync(filePath)) return [];

  try {
    const stats = fs.statSync(filePath);
    const cached = jsonCache.get(table);

    if (cached && cached.mtimeMs === stats.mtimeMs) {
      return cached.data;
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const payload = Array.isArray(parsed) ? parsed : [];
    jsonCache.set(table, { mtimeMs: stats.mtimeMs, data: payload });
    return payload;
  } catch {
    return [];
  }
};

const writeJson = (table, data) => {
  const filePath = getJsonPath(table);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  const stats = fs.statSync(filePath);
  jsonCache.set(table, { mtimeMs: stats.mtimeMs, data });
};

const validateTable = (table) => TABLE_WHITELIST.includes(table);

const isAllowedColumn = (table, column) => {
  const allowedColumns = TABLE_COLUMNS[table] || [];
  return allowedColumns.includes(column);
};

const areColumnsAllowed = (table, columns) => columns.every((column) => isAllowedColumn(table, column));

const toScalar = (value) => (Array.isArray(value) ? value[0] : value);

const coerceValue = (value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
};

const getFiltersFromQuery = (query) => {
  const filters = {};

  Object.entries(query).forEach(([rawKey, rawValue]) => {
    if (RESERVED_QUERY_KEYS.has(rawKey)) return;

    const scalar = toScalar(rawValue);
    if (scalar === undefined || scalar === null) return;

    filters[rawKey] = String(scalar);
  });

  return filters;
};

const parseOrder = (table, orderValue) => {
  if (!orderValue) return null;

  const [column, rawDirection] = String(orderValue).split(':');
  if (!column || !isAllowedColumn(table, column)) return null;

  return {
    column,
    direction: rawDirection === 'desc' ? 'DESC' : 'ASC',
  };
};

const parseLimit = (limitValue) => {
  if (!limitValue) return null;

  const parsed = Number.parseInt(String(limitValue), 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;

  return Math.min(parsed, 1000);
};

const parseOffset = (offsetValue) => {
  if (!offsetValue) return 0;

  const parsed = Number.parseInt(String(offsetValue), 10);
  if (Number.isNaN(parsed) || parsed < 0) return null;

  return parsed;
};

const isRowMatch = (row, filters) =>
  Object.entries(filters).every(([column, value]) => String(row[column]) === String(coerceValue(value)));

const applyFiltersToJsonRows = (rows, filters) => {
  if (Object.keys(filters).length === 0) return rows;
  return rows.filter((row) => isRowMatch(row, filters));
};

const applyOrderToJsonRows = (rows, order) => {
  if (!order) return rows;

  const sorted = [...rows].sort((a, b) => {
    const aValue = a[order.column];
    const bValue = b[order.column];

    if (aValue === bValue) return 0;
    if (aValue > bValue) return 1;
    return -1;
  });

  if (order.direction === 'DESC') sorted.reverse();
  return sorted;
};

const applyPaginationToJsonRows = (rows, limit, offset = 0) => {
  const start = Math.max(0, offset || 0);
  if (!limit) return rows.slice(start);
  return rows.slice(start, start + limit);
};

const sanitizeResponse = (data) => {
  if (Array.isArray(data)) {
    const needsSanitization = data.some(
      (item) => item && typeof item === 'object' && Object.prototype.hasOwnProperty.call(item, 'password')
    );

    if (!needsSanitization) return data;

    return data.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const { password, ...safeItem } = item;
      return safeItem;
    });
  }

  if (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'password')) {
    const { password, ...safeData } = data;
    return safeData;
  }

  return data;
};

const normalizeUserRecord = (record) => {
  const user = { ...record };

  if (typeof user.modules === 'string') {
    try {
      user.modules = JSON.parse(user.modules);
    } catch {
      // keep original value
    }
  }

  if (typeof user.allowed_warehouses === 'string') {
    try {
      user.allowed_warehouses = JSON.parse(user.allowed_warehouses);
    } catch {
      // keep original value
    }
  }

  return user;
};

const parseJsonField = (value, fallback) => {
  if (Array.isArray(value) || typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizePurchaseOrderRecord = (record) => {
  const order = { ...record };
  order.items = parseJsonField(order.items, []);
  order.quotes = parseJsonField(order.quotes, []);
  order.approval_history = parseJsonField(order.approval_history, []);
  return order;
};

const normalizeRowsByTable = (table, rows) => {
  if (table === 'users') {
    const shouldNormalize = rows.some(
      (row) => typeof row?.modules === 'string' || typeof row?.allowed_warehouses === 'string'
    );
    if (!shouldNormalize) return rows;
    return rows.map((row) => normalizeUserRecord(row));
  }

  if (table === 'purchase_orders') {
    const shouldNormalize = rows.some(
      (row) =>
        typeof row?.items === 'string' ||
        typeof row?.quotes === 'string' ||
        typeof row?.approval_history === 'string'
    );
    if (!shouldNormalize) return rows;
    return rows.map((row) => normalizePurchaseOrderRecord(row));
  }

  return rows;
};

const isHashedPassword = (password) => typeof password === 'string' && password.startsWith(`${PASSWORD_PREFIX}$`);

const hashPassword = (plainPassword) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto
    .pbkdf2Sync(plainPassword, salt, PASSWORD_ITERATIONS, PASSWORD_KEYLEN, PASSWORD_DIGEST)
    .toString('hex');

  return `${PASSWORD_PREFIX}$${PASSWORD_ITERATIONS}$${salt}$${derivedKey}`;
};

const deriveKeyAsync = (plainPassword, salt, iterations) =>
  new Promise((resolve, reject) => {
    crypto.pbkdf2(
      plainPassword,
      salt,
      iterations,
      PASSWORD_KEYLEN,
      PASSWORD_DIGEST,
      (err, derivedKey) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(derivedKey.toString('hex'));
      }
    );
  });

const verifyPassword = async (plainPassword, storedPassword) => {
  if (!storedPassword || typeof storedPassword !== 'string') return false;

  if (!isHashedPassword(storedPassword)) {
    return storedPassword === plainPassword;
  }

  const parts = storedPassword.split('$');
  if (parts.length !== 4) return false;

  const [, iterationString, salt, expectedHash] = parts;
  const iterations = Number.parseInt(iterationString, 10);

  if (Number.isNaN(iterations) || !salt || !expectedHash) return false;

  try {
    const calculatedHash = await deriveKeyAsync(plainPassword, salt, iterations);

    if (calculatedHash.length !== expectedHash.length) return false;

    return crypto.timingSafeEqual(Buffer.from(calculatedHash, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch {
    return false;
  }
};

const ensurePasswordHash = (passwordValue) => {
  if (typeof passwordValue !== 'string' || passwordValue.length === 0) return passwordValue;
  return isHashedPassword(passwordValue) ? passwordValue : hashPassword(passwordValue);
};

const issueToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ data: null, error: 'Token ausente' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ data: null, error: 'Token invalido ou expirado' });
  }
};

const matchesLoginInput = (user, loginInput) => {
  const normalizedInput = String(loginInput).trim().toLowerCase();
  const email = String(user.email || '').trim().toLowerCase();
  const name = String(user.name || '').trim().toLowerCase();

  return email === normalizedInput || name === normalizedInput;
};

const sendServerError = (res, err, fallbackMessage = 'Erro interno no servidor') => {
  const message = !isProd && err instanceof Error ? err.message : fallbackMessage;
  res.status(500).json({ data: null, error: message });
};

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    database: dbConnected ? 'connected' : 'disconnected',
    mode: dbConnected ? 'production' : 'contingency-json',
  });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    res.status(400).json({ data: null, error: 'Email/login e senha sao obrigatorios' });
    return;
  }

  if (!dbConnected) {
    const users = normalizeRowsByTable('users', readJson('users'));
    const user = users.find((item) => matchesLoginInput(item, email));

    if (!user || !(await verifyPassword(String(password), user.password))) {
      res.status(401).json({ data: null, error: 'Credenciais invalidas' });
      return;
    }

    if (user.status !== 'Ativo') {
      res.status(403).json({ data: null, error: 'Usuario inativo' });
      return;
    }

    if (!isHashedPassword(user.password)) {
      const usersRaw = readJson('users');
      const updatedUsers = usersRaw.map((row) =>
        row.id === user.id
          ? {
              ...row,
              password: hashPassword(String(password)),
            }
          : row
      );
      writeJson('users', updatedUsers);
    }

    const token = issueToken(user);
    res.json({ data: sanitizeResponse(user), token, error: null });
    return;
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(name) = LOWER($1) LIMIT 1', [
      String(email).trim(),
    ]);
    const user = normalizeRowsByTable('users', result.rows)[0];

    if (!user || !(await verifyPassword(String(password), user.password))) {
      res.status(401).json({ data: null, error: 'Credenciais invalidas' });
      return;
    }

    if (user.status !== 'Ativo') {
      res.status(403).json({ data: null, error: 'Usuario inativo' });
      return;
    }

    if (!isHashedPassword(user.password)) {
      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashPassword(String(password)), user.id]);
    }

    const token = issueToken(user);
    res.json({ data: sanitizeResponse(user), token, error: null });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.post('/fleet-sync', authenticate, async (req, res) => {
  const { token, url } = req.body || {};

  if (!token || !url) {
    res.status(400).json({ data: null, error: 'Token e URL sao obrigatorios' });
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(url);
  } catch {
    res.status(400).json({ data: null, error: 'URL invalida' });
    return;
  }

  const allowedHosts = (process.env.FLEET_SYNC_ALLOWED_HOSTS || 'cubogpm-frota.nortesistech.com')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);

  if (!allowedHosts.includes(targetUrl.hostname)) {
    res.status(403).json({ data: null, error: 'Host nao permitido para sincronizacao' });
    return;
  }

  try {
    const fleetResponse = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Token ${token}`,
        Accept: 'application/json',
      },
    });

    const payload = await fleetResponse.json().catch(() => null);

    if (!fleetResponse.ok) {
      res.status(fleetResponse.status).json({
        data: null,
        error: payload?.error || `Falha na Fleet API (${fleetResponse.status})`,
      });
      return;
    }

    res.json(payload);
  } catch (err) {
    sendServerError(res, err, 'Falha ao consultar Fleet API');
  }
});

app.get('/:table', authenticate, async (req, res) => {
  const { table } = req.params;

  if (!validateTable(table)) {
    res.status(403).json({ data: null, error: 'Tabela nao permitida' });
    return;
  }

  const filters = getFiltersFromQuery(req.query);
  if (!areColumnsAllowed(table, Object.keys(filters))) {
    res.status(400).json({ data: null, error: 'Filtro com coluna nao permitida' });
    return;
  }

  const order = parseOrder(table, toScalar(req.query.order));
  if (toScalar(req.query.order) && !order) {
    res.status(400).json({ data: null, error: 'Ordenacao invalida' });
    return;
  }

  const limit = parseLimit(toScalar(req.query.limit));
  if (toScalar(req.query.limit) && !limit) {
    res.status(400).json({ data: null, error: 'Limite invalido' });
    return;
  }

  const offset = parseOffset(toScalar(req.query.offset));
  if (toScalar(req.query.offset) && offset === null) {
    res.status(400).json({ data: null, error: 'Offset invalido' });
    return;
  }

  if (!dbConnected) {
    let rows = normalizeRowsByTable(table, readJson(table));
    rows = applyFiltersToJsonRows(rows, filters);
    rows = applyOrderToJsonRows(rows, order);
    rows = applyPaginationToJsonRows(rows, limit, offset || 0);

    res.json({ data: sanitizeResponse(rows), error: null });
    return;
  }

  try {
    let query = `SELECT * FROM ${table}`;
    const values = [];

    const filterEntries = Object.entries(filters);
    if (filterEntries.length > 0) {
      const whereClause = filterEntries
        .map(([column], index) => `${column} = $${index + 1}`)
        .join(' AND ');

      query += ` WHERE ${whereClause}`;
      values.push(...filterEntries.map(([, value]) => coerceValue(value)));
    }

    if (order) {
      query += ` ORDER BY ${order.column} ${order.direction}`;
    }

    if (limit) {
      values.push(limit);
      query += ` LIMIT $${values.length}`;
    }

    if (offset) {
      values.push(offset);
      query += ` OFFSET $${values.length}`;
    }

    const result = await pool.query(query, values);
    const rows = normalizeRowsByTable(table, result.rows);
    res.json({ data: sanitizeResponse(rows), error: null });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.post('/:table', authenticate, async (req, res) => {
  const { table } = req.params;

  if (!validateTable(table)) {
    res.status(403).json({ data: null, error: 'Tabela nao permitida' });
    return;
  }

  const payload = req.body;
  const rows = Array.isArray(payload) ? payload : [payload];

  if (rows.length === 0 || rows.some((row) => !row || typeof row !== 'object')) {
    res.status(400).json({ data: null, error: 'Payload invalido' });
    return;
  }

  if (!rows.every((row) => areColumnsAllowed(table, Object.keys(row)))) {
    res.status(400).json({ data: null, error: 'Payload contem coluna nao permitida' });
    return;
  }

  const preparedRows = rows.map((row) => {
    const nextRow = { ...row };
    if (table === 'users' && 'password' in nextRow) {
      nextRow.password = ensurePasswordHash(nextRow.password);
    }
    return nextRow;
  });

  if (!dbConnected) {
    const currentData = readJson(table);
    const updatedData = [...currentData, ...preparedRows];
    writeJson(table, updatedData);

    const normalizedRows = normalizeRowsByTable(table, preparedRows);
    const responseData = Array.isArray(payload) ? normalizedRows : normalizedRows[0];
    res.json({ data: sanitizeResponse(responseData), error: null });
    return;
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const insertedRows = [];

    for (const row of preparedRows) {
      const columns = Object.keys(row);
      if (columns.length === 0) {
        throw new Error('Payload vazio nao pode ser inserido');
      }

      const values = Object.values(row);
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
      const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;

      const result = await client.query(query, values);
      insertedRows.push(result.rows[0]);
    }

    await client.query('COMMIT');

    const normalized = normalizeRowsByTable(table, insertedRows);
    res.json({ data: sanitizeResponse(Array.isArray(payload) ? normalized : normalized[0]), error: null });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    sendServerError(res, err);
  } finally {
    if (client) client.release();
  }
});

app.patch('/:table', authenticate, async (req, res) => {
  const { table } = req.params;

  if (!validateTable(table)) {
    res.status(403).json({ data: null, error: 'Tabela nao permitida' });
    return;
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ data: null, error: 'Payload invalido para update' });
    return;
  }

  const updates = { ...req.body };
  if (!areColumnsAllowed(table, Object.keys(updates))) {
    res.status(400).json({ data: null, error: 'Update contem coluna nao permitida' });
    return;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ data: null, error: 'Nenhum campo enviado para atualizacao' });
    return;
  }

  if (table === 'users' && 'password' in updates) {
    updates.password = ensurePasswordHash(updates.password);
  }

  const filters = getFiltersFromQuery(req.query);
  if (Object.keys(filters).length === 0) {
    res.status(400).json({ data: null, error: 'Filtro obrigatorio para update' });
    return;
  }

  if (!areColumnsAllowed(table, Object.keys(filters))) {
    res.status(400).json({ data: null, error: 'Filtro com coluna nao permitida' });
    return;
  }

  if (!dbConnected) {
    const currentData = readJson(table);
    const updatedRows = [];

    const nextData = currentData.map((row) => {
      if (!isRowMatch(row, filters)) return row;

      const updatedRow = { ...row, ...updates };
      updatedRows.push(updatedRow);
      return updatedRow;
    });

    if (updatedRows.length === 0) {
      res.status(404).json({ data: null, error: 'Nenhum registro encontrado' });
      return;
    }

    writeJson(table, nextData);
    res.json({ data: sanitizeResponse(normalizeRowsByTable(table, updatedRows)), error: null });
    return;
  }

  try {
    const updateEntries = Object.entries(updates);
    const filterEntries = Object.entries(filters);

    const setClause = updateEntries.map(([column], index) => `${column} = $${index + 1}`).join(', ');
    const whereClause = filterEntries
      .map(([column], index) => `${column} = $${updateEntries.length + index + 1}`)
      .join(' AND ');

    const values = [
      ...updateEntries.map(([, value]) => value),
      ...filterEntries.map(([, value]) => coerceValue(value)),
    ];

    const query = `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      res.status(404).json({ data: null, error: 'Nenhum registro encontrado' });
      return;
    }

    res.json({ data: sanitizeResponse(normalizeRowsByTable(table, result.rows)), error: null });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.delete('/:table', authenticate, async (req, res) => {
  const { table } = req.params;

  if (!validateTable(table)) {
    res.status(403).json({ data: null, error: 'Tabela nao permitida' });
    return;
  }

  const filters = getFiltersFromQuery(req.query);
  if (Object.keys(filters).length === 0) {
    res.status(400).json({ data: null, error: 'Filtro obrigatorio para delete' });
    return;
  }

  if (!areColumnsAllowed(table, Object.keys(filters))) {
    res.status(400).json({ data: null, error: 'Filtro com coluna nao permitida' });
    return;
  }

  if (!dbConnected) {
    const currentData = readJson(table);
    const deletedRows = currentData.filter((row) => isRowMatch(row, filters));

    if (deletedRows.length === 0) {
      res.status(404).json({ data: null, error: 'Nenhum registro encontrado' });
      return;
    }

    const remainingRows = currentData.filter((row) => !isRowMatch(row, filters));
    writeJson(table, remainingRows);

    res.json({ data: sanitizeResponse(normalizeRowsByTable(table, deletedRows)), error: null });
    return;
  }

  try {
    const filterEntries = Object.entries(filters);
    const whereClause = filterEntries.map(([column], index) => `${column} = $${index + 1}`).join(' AND ');
    const values = filterEntries.map(([, value]) => coerceValue(value));

    const query = `DELETE FROM ${table} WHERE ${whereClause} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      res.status(404).json({ data: null, error: 'Nenhum registro encontrado' });
      return;
    }

    res.json({ data: sanitizeResponse(normalizeRowsByTable(table, result.rows)), error: null });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.listen(port, () => {
  console.log(`API running on port ${port}`);
  if (!dbConnected) console.log('JSON contingency mode active');
});

