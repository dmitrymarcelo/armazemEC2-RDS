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
const DB_HEALTHCHECK_INTERVAL_MS = Number(process.env.DB_HEALTHCHECK_INTERVAL_MS || 10000);

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
  'audit_logs',
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
  audit_logs: [
    'id',
    'entity',
    'entity_id',
    'module',
    'action',
    'actor',
    'actor_id',
    'warehouse_id',
    'before_data',
    'after_data',
    'meta',
    'created_at',
  ],
};

const TABLE_JSON_COLUMNS = {
  users: ['modules', 'allowed_warehouses'],
  purchase_orders: ['items', 'quotes', 'approval_history'],
  audit_logs: ['before_data', 'after_data', 'meta'],
};

const TABLE_TIMESTAMP_COLUMNS = {
  users: ['last_access'],
  vehicles: ['last_maintenance'],
  inventory: ['last_counted_at'],
  movements: ['timestamp'],
  purchase_orders: ['request_date', 'sent_to_vendor_at', 'received_at', 'quotes_added_at', 'approved_at', 'rejected_at'],
  cyclic_batches: ['scheduled_date', 'completed_at'],
  cyclic_counts: ['counted_at'],
};

const ensureDataDirExists = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

ensureDataDirExists();

let dbConnected = false;
let dbLastError = null;
let dbLastCheckedAt = null;
const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  connectionTimeoutMillis: 2000,
});

const DB_CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  '57P01',
  '57P02',
  '57P03',
  '08001',
  '08003',
  '08006',
]);

const getErrorReason = (err) => {
  if (!err) return 'Erro desconhecido';
  if (err instanceof Error) return err.message;
  return String(err);
};

const isDbConnectionError = (err) => {
  const code = String(err?.code || '').toUpperCase();
  if (DB_CONNECTION_ERROR_CODES.has(code)) return true;

  const message = getErrorReason(err).toLowerCase();
  return (
    message.includes('connect') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('server closed the connection unexpectedly')
  );
};

const setDbStatus = (connected, err) => {
  const previous = dbConnected;
  dbConnected = connected;
  dbLastCheckedAt = new Date().toISOString();

  if (connected) {
    dbLastError = null;
    if (!previous) {
      console.log('PostgreSQL available. Switching to production mode.');
    }
    return;
  }

  dbLastError = getErrorReason(err);
  if (previous) {
    console.warn('PostgreSQL unavailable. Switching to JSON contingency mode.');
  }
};

const verifyDbConnection = async (logInitialFailure = false) => {
  try {
    const client = await pool.connect();
    client.release();
    setDbStatus(true);
  } catch (err) {
    setDbStatus(false, err);
    if (logInitialFailure) {
      console.warn('PostgreSQL unavailable on startup. Running in JSON contingency mode.');
    }
  }
};

const markDbDisconnectedIfNeeded = (err) => {
  if (!isDbConnectionError(err)) return;
  setDbStatus(false, err);
};

await verifyDbConnection(true);

setInterval(() => {
  void verifyDbConnection(false);
}, DB_HEALTHCHECK_INTERVAL_MS);

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

const parseDateFilter = (dateValue) => {
  if (!dateValue) return null;
  const parsed = new Date(String(dateValue));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const includesText = (source, term) => String(source || '').toLowerCase().includes(String(term || '').toLowerCase());

const filterAuditLogRows = (rows, filters) => {
  const fromIso = filters.from ? parseDateFilter(filters.from) : null;
  const toIso = filters.to ? parseDateFilter(filters.to) : null;
  const searchTerm = String(filters.q || '').trim().toLowerCase();
  const warehouseFilter = String(filters.warehouse_id || '').trim();
  const includeGlobal = String(filters.include_global || 'true').toLowerCase() !== 'false';

  return rows.filter((row) => {
    if (filters.module && !includesText(row.module, filters.module)) return false;
    if (filters.entity && !includesText(row.entity, filters.entity)) return false;
    if (filters.action && !includesText(row.action, filters.action)) return false;
    if (filters.actor && !includesText(row.actor, filters.actor)) return false;

    if (warehouseFilter && warehouseFilter !== 'all') {
      const rowWarehouse = String(row?.warehouse_id || '').trim();
      const warehouseMatches = rowWarehouse === warehouseFilter;
      const isGlobal = rowWarehouse.length === 0;
      if (!(warehouseMatches || (includeGlobal && isGlobal))) return false;
    }

    const createdAt = new Date(String(row?.created_at || ''));
    if ((fromIso || toIso) && Number.isNaN(createdAt.getTime())) return false;
    if (fromIso && createdAt < new Date(fromIso)) return false;
    if (toIso && createdAt > new Date(toIso)) return false;

    if (searchTerm) {
      const haystack = [
        row.module,
        row.entity,
        row.entity_id,
        row.action,
        row.actor,
        row.actor_id,
        row.warehouse_id,
        JSON.stringify(row.meta || {}),
        JSON.stringify(row.before_data || {}),
        JSON.stringify(row.after_data || {}),
      ]
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(searchTerm)) return false;
    }

    return true;
  });
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

const normalizeJsonColumnValueForDb = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

const normalizeTimestampValueForDb = (value) => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const text = String(value).trim();
  if (!text) return null;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString();
};

const normalizeRowForDb = (table, row) => {
  const next = { ...row };
  const jsonColumns = TABLE_JSON_COLUMNS[table] || [];
  const timestampColumns = TABLE_TIMESTAMP_COLUMNS[table] || [];

  jsonColumns.forEach((column) => {
    if (Object.prototype.hasOwnProperty.call(next, column)) {
      next[column] = normalizeJsonColumnValueForDb(next[column]);
    }
  });

  timestampColumns.forEach((column) => {
    if (Object.prototype.hasOwnProperty.call(next, column)) {
      next[column] = normalizeTimestampValueForDb(next[column]);
    }
  });

  return next;
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

const toPositiveInteger = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const normalizeReceiptItems = (rawItems) => {
  if (!Array.isArray(rawItems)) return [];

  const grouped = new Map();

  rawItems.forEach((rawItem) => {
    if (!rawItem || typeof rawItem !== 'object') return;

    const sku = String(rawItem.sku || '').trim();
    const receivedQty = toPositiveInteger(rawItem.received ?? rawItem.qty ?? rawItem.quantity);

    if (!sku || !receivedQty) return;

    const current = grouped.get(sku) || { sku, received: 0 };
    current.received += receivedQty;
    grouped.set(sku, current);
  });

  return Array.from(grouped.values());
};

const buildReceiptMovementId = (poId, index) => {
  const normalizedPoId = String(poId || 'PO')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 24);
  const randomSuffix = crypto.randomBytes(3).toString('hex');
  return `MOV-REC-${normalizedPoId}-${Date.now()}-${index}-${randomSuffix}`;
};

const ENTITY_ID_FIELD = {
  users: 'id',
  warehouses: 'id',
  inventory: 'sku',
  cyclic_batches: 'id',
  cyclic_counts: 'id',
  vendors: 'id',
  vehicles: 'plate',
  purchase_orders: 'id',
  movements: 'id',
  notifications: 'id',
  material_requests: 'id',
  cost_centers: 'id',
  audit_logs: 'id',
};

const getEntityId = (table, row) => {
  if (!row || typeof row !== 'object') return null;
  const key = ENTITY_ID_FIELD[table] || 'id';
  const value = row[key] ?? row.id ?? row.sku ?? row.plate ?? null;
  if (value === null || value === undefined) return null;
  return String(value);
};

const buildAuditLog = ({
  module,
  action,
  entity,
  entityId,
  actor,
  actorId,
  warehouseId,
  beforeData,
  afterData,
  meta,
}) => ({
  id: crypto.randomUUID(),
  module: module || entity,
  entity: entity || module,
  entity_id: entityId || null,
  action: String(action || 'update'),
  actor: String(actor || 'Sistema'),
  actor_id: actorId ? String(actorId) : null,
  warehouse_id: warehouseId || beforeData?.warehouse_id || afterData?.warehouse_id || null,
  before_data: beforeData ?? null,
  after_data: afterData ?? null,
  meta: meta ?? null,
  created_at: new Date().toISOString(),
});

const writeAuditLogsToJson = (entries) => {
  if (!Array.isArray(entries) || entries.length === 0) return;
  const currentLogs = readJson('audit_logs');
  writeJson('audit_logs', [...currentLogs, ...entries]);
};

const writeAuditLogsToDb = async (db, entries) => {
  if (!db || !Array.isArray(entries) || entries.length === 0) return;

  for (const entry of entries) {
    const normalizedEntry = normalizeRowForDb('audit_logs', entry);
    const columns = Object.keys(normalizedEntry);
    const values = Object.values(normalizedEntry);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    await db.query(
      `INSERT INTO audit_logs (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    );
  }
};

const persistAuditLogs = async (entries, db = null) => {
  if (!Array.isArray(entries) || entries.length === 0) return;

  if (!dbConnected || !db) {
    writeAuditLogsToJson(entries);
    return;
  }

  try {
    await writeAuditLogsToDb(db, entries);
  } catch (err) {
    // Auditoria nunca deve quebrar o fluxo principal da API.
    console.warn(`Audit log persistence failed: ${getErrorReason(err)}`);
    writeAuditLogsToJson(entries);
  }
};

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    database: dbConnected ? 'connected' : 'disconnected',
    mode: dbConnected ? 'production' : 'contingency-json',
    database_last_error: dbLastError,
    database_last_checked_at: dbLastCheckedAt,
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
    markDbDisconnectedIfNeeded(err);
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
    markDbDisconnectedIfNeeded(err);
    sendServerError(res, err, 'Falha ao consultar Fleet API');
  }
});

app.post('/receipts/finalize', authenticate, async (req, res) => {
  const poId = String(req.body?.po_id || req.body?.poId || '').trim();
  const requestedWarehouseId = String(req.body?.warehouse_id || req.body?.warehouseId || '').trim();
  const receiptItems = normalizeReceiptItems(req.body?.items);

  if (!poId) {
    res.status(400).json({ data: null, error: 'po_id eh obrigatorio' });
    return;
  }

  if (receiptItems.length === 0) {
    res.status(400).json({ data: null, error: 'Nenhum item valido para recebimento' });
    return;
  }

  const receivedAtIso = new Date().toISOString();
  const receiptReason = `Entrada via Recebimento de ${poId}`;
  const receiptUser = String(req.auth?.email || req.auth?.sub || 'Sistema');
  const receiptActorId = req.auth?.sub ? String(req.auth.sub) : null;

  if (!dbConnected) {
    const purchaseOrders = normalizeRowsByTable('purchase_orders', readJson('purchase_orders'));
    const poIndex = purchaseOrders.findIndex((order) => String(order.id) === poId);

    if (poIndex === -1) {
      res.status(404).json({ data: null, error: `Pedido ${poId} nao encontrado` });
      return;
    }

    const targetPo = purchaseOrders[poIndex];
    if (String(targetPo.status) !== 'enviado') {
      res.status(409).json({
        data: null,
        error: `Pedido ${poId} ja foi recebido ou nao esta em status enviado`,
      });
      return;
    }

    const targetWarehouseId = requestedWarehouseId || targetPo.warehouse_id || 'ARMZ28';
    const inventory = normalizeRowsByTable('inventory', readJson('inventory'));
    const movements = normalizeRowsByTable('movements', readJson('movements'));

    const indexedInventory = new Map();
    inventory.forEach((item, index) => {
      const key = `${String(item.sku)}::${String(item.warehouse_id || 'ARMZ28')}`;
      indexedInventory.set(key, index);
    });

    const missingSkus = receiptItems
      .filter((item) => !indexedInventory.has(`${item.sku}::${targetWarehouseId}`))
      .map((item) => item.sku);

    if (missingSkus.length > 0) {
      res.status(400).json({
        data: null,
        error: `Itens nao encontrados no estoque do armazem ${targetWarehouseId}: ${missingSkus.join(', ')}`,
      });
      return;
    }

    const inventoryUpdates = [];
    const newMovements = [];

    receiptItems.forEach((item, index) => {
      const mapKey = `${item.sku}::${targetWarehouseId}`;
      const inventoryIndex = indexedInventory.get(mapKey);
      const currentInventory = inventory[inventoryIndex];
      const previousQty = Number(currentInventory.quantity || 0);
      const nextQty = previousQty + item.received;

      inventory[inventoryIndex] = {
        ...currentInventory,
        quantity: nextQty,
      };

      inventoryUpdates.push({
        sku: item.sku,
        previous_qty: previousQty,
        received: item.received,
        new_qty: nextQty,
      });

      newMovements.push({
        id: buildReceiptMovementId(poId, index + 1),
        sku: item.sku,
        product_name: currentInventory.name || item.sku,
        type: 'entrada',
        quantity: item.received,
        timestamp: receivedAtIso,
        user: receiptUser,
        location: currentInventory.location || 'DOCA-01',
        reason: receiptReason,
        order_id: poId,
        warehouse_id: targetWarehouseId,
      });
    });

    const updatedPo = {
      ...targetPo,
      status: 'recebido',
      received_at: receivedAtIso,
    };
    purchaseOrders[poIndex] = updatedPo;

    writeJson('inventory', inventory);
    writeJson('movements', [...movements, ...newMovements]);
    writeJson('purchase_orders', purchaseOrders);

    const receiptAuditLogs = [
      buildAuditLog({
        module: 'recebimento',
        action: 'receipt_finalize',
        entity: 'purchase_orders',
        entityId: poId,
        actor: receiptUser,
        actorId: receiptActorId,
        warehouseId: targetWarehouseId,
        beforeData: targetPo,
        afterData: updatedPo,
        meta: {
          po_id: poId,
          items: receiptItems,
        },
      }),
      ...inventoryUpdates.map((entry) =>
        buildAuditLog({
          module: 'recebimento',
          action: 'inventory_increment',
          entity: 'inventory',
          entityId: entry.sku,
          actor: receiptUser,
          actorId: receiptActorId,
          warehouseId: targetWarehouseId,
          beforeData: { quantity: entry.previous_qty },
          afterData: { quantity: entry.new_qty },
          meta: {
            po_id: poId,
            received: entry.received,
          },
        })
      ),
    ];

    await persistAuditLogs(receiptAuditLogs);

    res.json({
      data: {
        po: normalizePurchaseOrderRecord(updatedPo),
        inventory_updates: inventoryUpdates,
        movements: newMovements,
      },
      error: null,
    });
    return;
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const poResult = await client.query('SELECT * FROM purchase_orders WHERE id = $1 FOR UPDATE', [poId]);
    if (poResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ data: null, error: `Pedido ${poId} nao encontrado` });
      return;
    }

    const targetPo = normalizePurchaseOrderRecord(poResult.rows[0]);
    if (String(targetPo.status) !== 'enviado') {
      await client.query('ROLLBACK');
      res.status(409).json({
        data: null,
        error: `Pedido ${poId} ja foi recebido ou nao esta em status enviado`,
      });
      return;
    }

    const targetWarehouseId = requestedWarehouseId || targetPo.warehouse_id || 'ARMZ28';
    const inventoryUpdates = [];
    const movementRows = [];

    for (let index = 0; index < receiptItems.length; index += 1) {
      const item = receiptItems[index];
      const inventoryUpdate = await client.query(
        `
          UPDATE inventory
             SET quantity = quantity + $1
           WHERE sku = $2
             AND warehouse_id = $3
         RETURNING *
        `,
        [item.received, item.sku, targetWarehouseId]
      );

      if (inventoryUpdate.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(400).json({
          data: null,
          error: `Item ${item.sku} nao encontrado no estoque do armazem ${targetWarehouseId}`,
        });
        return;
      }

      const updatedInventory = inventoryUpdate.rows[0];
      const newQty = Number(updatedInventory.quantity || 0);
      const previousQty = newQty - item.received;

      inventoryUpdates.push({
        sku: item.sku,
        previous_qty: previousQty,
        received: item.received,
        new_qty: newQty,
      });

      const movementInsert = await client.query(
        `
          INSERT INTO movements (id, sku, product_name, type, quantity, timestamp, "user", location, reason, order_id, warehouse_id)
          VALUES ($1, $2, $3, 'entrada', $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `,
        [
          crypto.randomUUID(),
          item.sku,
          updatedInventory.name || item.sku,
          item.received,
          receivedAtIso,
          receiptUser,
          updatedInventory.location || 'DOCA-01',
          receiptReason,
          poId,
          targetWarehouseId,
        ]
      );

      movementRows.push(movementInsert.rows[0]);
    }

    const poUpdate = await client.query(
      `
        UPDATE purchase_orders
           SET status = 'recebido',
               received_at = $1
         WHERE id = $2
       RETURNING *
      `,
      [receivedAtIso, poId]
    );

    const updatedPoRow = poUpdate.rows[0];
    const receiptAuditLogs = [
      buildAuditLog({
        module: 'recebimento',
        action: 'receipt_finalize',
        entity: 'purchase_orders',
        entityId: poId,
        actor: receiptUser,
        actorId: receiptActorId,
        warehouseId: targetWarehouseId,
        beforeData: targetPo,
        afterData: updatedPoRow,
        meta: {
          po_id: poId,
          items: receiptItems,
        },
      }),
      ...inventoryUpdates.map((entry) =>
        buildAuditLog({
          module: 'recebimento',
          action: 'inventory_increment',
          entity: 'inventory',
          entityId: entry.sku,
          actor: receiptUser,
          actorId: receiptActorId,
          warehouseId: targetWarehouseId,
          beforeData: { quantity: entry.previous_qty },
          afterData: { quantity: entry.new_qty },
          meta: {
            po_id: poId,
            received: entry.received,
          },
        })
      ),
    ];

    await persistAuditLogs(receiptAuditLogs, client);

    await client.query('COMMIT');

    res.json({
      data: {
        po: normalizePurchaseOrderRecord(updatedPoRow),
        inventory_updates: inventoryUpdates,
        movements: normalizeRowsByTable('movements', movementRows),
      },
      error: null,
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    markDbDisconnectedIfNeeded(err);
    sendServerError(res, err, 'Falha ao finalizar recebimento');
  } finally {
    if (client) client.release();
  }
});

app.get('/audit_logs/search', authenticate, async (req, res) => {
  const limit = parseLimit(toScalar(req.query.limit)) || 50;
  if (toScalar(req.query.limit) && !parseLimit(toScalar(req.query.limit))) {
    res.status(400).json({ data: null, error: 'Limite invalido' });
    return;
  }

  const offset = parseOffset(toScalar(req.query.offset));
  if (toScalar(req.query.offset) && offset === null) {
    res.status(400).json({ data: null, error: 'Offset invalido' });
    return;
  }

  const from = toScalar(req.query.from);
  const to = toScalar(req.query.to);
  const fromIso = from ? parseDateFilter(from) : null;
  const toIso = to ? parseDateFilter(to) : null;

  if (from && !fromIso) {
    res.status(400).json({ data: null, error: 'Data inicial invalida' });
    return;
  }

  if (to && !toIso) {
    res.status(400).json({ data: null, error: 'Data final invalida' });
    return;
  }

  const filters = {
    module: String(toScalar(req.query.module) || '').trim(),
    entity: String(toScalar(req.query.entity) || '').trim(),
    action: String(toScalar(req.query.action) || '').trim(),
    actor: String(toScalar(req.query.actor) || '').trim(),
    warehouse_id: String(toScalar(req.query.warehouse_id) || '').trim(),
    include_global: String(toScalar(req.query.include_global) || 'true').trim(),
    q: String(toScalar(req.query.q) || '').trim(),
    from: fromIso,
    to: toIso,
  };

  const safeOffset = offset || 0;

  const buildAuditResponse = (inputRows) => {
    const rows = [...inputRows].sort((a, b) => {
      const aDate = new Date(String(a?.created_at || '')).getTime();
      const bDate = new Date(String(b?.created_at || '')).getTime();
      if (!Number.isFinite(aDate) && !Number.isFinite(bDate)) return 0;
      if (!Number.isFinite(aDate)) return 1;
      if (!Number.isFinite(bDate)) return -1;
      return bDate - aDate;
    });

    const total = rows.length;
    const pageRows = rows.slice(safeOffset, safeOffset + limit);
    const hasMore = safeOffset + pageRows.length < total;

    return {
      data: sanitizeResponse(pageRows),
      total,
      has_more: hasMore,
      next_offset: hasMore ? safeOffset + pageRows.length : null,
      error: null,
    };
  };

  const getJsonFallbackRows = () => {
    let rows = normalizeRowsByTable('audit_logs', readJson('audit_logs'));
    rows = filterAuditLogRows(rows, filters);
    return rows;
  };

  if (!dbConnected) {
    res.json(buildAuditResponse(getJsonFallbackRows()));
    return;
  }

  try {
    const whereParts = [];
    const values = [];

    const pushValue = (value) => {
      values.push(value);
      return `$${values.length}`;
    };

    if (filters.module) {
      const marker = pushValue(`%${filters.module}%`);
      whereParts.push(`module ILIKE ${marker}`);
    }

    if (filters.entity) {
      const marker = pushValue(`%${filters.entity}%`);
      whereParts.push(`entity ILIKE ${marker}`);
    }

    if (filters.action) {
      const marker = pushValue(`%${filters.action}%`);
      whereParts.push(`action ILIKE ${marker}`);
    }

    if (filters.actor) {
      const marker = pushValue(`%${filters.actor}%`);
      whereParts.push(`actor ILIKE ${marker}`);
    }

    if (filters.warehouse_id && filters.warehouse_id !== 'all') {
      const marker = pushValue(filters.warehouse_id);
      const includeGlobal = String(filters.include_global).toLowerCase() !== 'false';
      if (includeGlobal) {
        whereParts.push(`(warehouse_id = ${marker} OR warehouse_id IS NULL OR warehouse_id = '')`);
      } else {
        whereParts.push(`warehouse_id = ${marker}`);
      }
    }

    if (fromIso) {
      const marker = pushValue(fromIso);
      whereParts.push(`created_at >= ${marker}`);
    }

    if (toIso) {
      const marker = pushValue(toIso);
      whereParts.push(`created_at <= ${marker}`);
    }

    if (filters.q) {
      const marker = pushValue(`%${filters.q}%`);
      whereParts.push(`(
        module ILIKE ${marker}
        OR entity ILIKE ${marker}
        OR entity_id ILIKE ${marker}
        OR action ILIKE ${marker}
        OR actor ILIKE ${marker}
        OR actor_id ILIKE ${marker}
        OR warehouse_id ILIKE ${marker}
        OR CAST(meta AS TEXT) ILIKE ${marker}
        OR CAST(before_data AS TEXT) ILIKE ${marker}
        OR CAST(after_data AS TEXT) ILIKE ${marker}
      )`);
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const jsonFallbackRows = getJsonFallbackRows();
    if (jsonFallbackRows.length > 0) {
      const allDbRowsResult = await pool.query(
        `
          SELECT *
          FROM audit_logs
          ${whereClause}
          ORDER BY created_at DESC
        `,
        values
      );

      const dbRows = normalizeRowsByTable('audit_logs', allDbRowsResult.rows);
      const merged = [];
      const seen = new Set();

      [...dbRows, ...jsonFallbackRows].forEach((row, index) => {
        const dedupeKey = row?.id
          ? `id:${row.id}`
          : `sig:${row?.module || ''}|${row?.entity || ''}|${row?.entity_id || ''}|${row?.action || ''}|${row?.created_at || ''}|${index}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        merged.push(row);
      });

      res.json(buildAuditResponse(merged));
      return;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM audit_logs ${whereClause}`,
      values
    );
    const total = Number(countResult.rows?.[0]?.total || 0);

    const dataValues = [...values];
    dataValues.push(limit, safeOffset);
    const limitMarker = `$${dataValues.length - 1}`;
    const offsetMarker = `$${dataValues.length}`;

    const dataResult = await pool.query(
      `
        SELECT *
        FROM audit_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limitMarker}
        OFFSET ${offsetMarker}
      `,
      dataValues
    );

    const rows = normalizeRowsByTable('audit_logs', dataResult.rows);
    const hasMore = safeOffset + rows.length < total;

    res.json({
      data: sanitizeResponse(rows),
      total,
      has_more: hasMore,
      next_offset: hasMore ? safeOffset + rows.length : null,
      error: null,
    });
  } catch (err) {
    markDbDisconnectedIfNeeded(err);
    console.warn(`Audit search fallback activated: ${getErrorReason(err)}`);
    res.json({
      ...buildAuditResponse(getJsonFallbackRows()),
      source: 'json-fallback',
    });
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
    markDbDisconnectedIfNeeded(err);
    sendServerError(res, err);
  }
});

app.post('/:table', authenticate, async (req, res) => {
  const { table } = req.params;
  const actor = String(req.auth?.email || req.auth?.sub || 'Sistema');
  const actorId = req.auth?.sub ? String(req.auth.sub) : null;

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
    if (table === 'cyclic_counts') {
      if (!nextRow.id) nextRow.id = crypto.randomUUID();
      if (!nextRow.status) nextRow.status = 'pendente';
    }
    if (table === 'movements' && !nextRow.id) {
      nextRow.id = crypto.randomUUID();
    }
    return nextRow;
  });

  if (!dbConnected) {
    const currentData = readJson(table);
    const updatedData = [...currentData, ...preparedRows];
    writeJson(table, updatedData);

    if (table !== 'audit_logs') {
      const auditEntries = preparedRows.map((row) =>
        buildAuditLog({
          module: table,
          action: 'create',
          entity: table,
          entityId: getEntityId(table, row),
          actor,
          actorId,
          warehouseId: row?.warehouse_id || null,
          beforeData: null,
          afterData: row,
          meta: null,
        })
      );
      await persistAuditLogs(auditEntries);
    }

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
    const preparedRowsForDb = preparedRows.map((row) => normalizeRowForDb(table, row));

    for (const row of preparedRowsForDb) {
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

    if (table !== 'audit_logs') {
      const auditEntries = normalized.map((row) =>
        buildAuditLog({
          module: table,
          action: 'create',
          entity: table,
          entityId: getEntityId(table, row),
          actor,
          actorId,
          warehouseId: row?.warehouse_id || null,
          beforeData: null,
          afterData: row,
          meta: null,
        })
      );
      await persistAuditLogs(auditEntries, client);
    }

    res.json({ data: sanitizeResponse(Array.isArray(payload) ? normalized : normalized[0]), error: null });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    markDbDisconnectedIfNeeded(err);
    sendServerError(res, err);
  } finally {
    if (client) client.release();
  }
});

app.patch('/:table', authenticate, async (req, res) => {
  const { table } = req.params;
  const actor = String(req.auth?.email || req.auth?.sub || 'Sistema');
  const actorId = req.auth?.sub ? String(req.auth.sub) : null;

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
    const beforeRows = [];

    const nextData = currentData.map((row) => {
      if (!isRowMatch(row, filters)) return row;

      beforeRows.push(row);
      const updatedRow = { ...row, ...updates };
      updatedRows.push(updatedRow);
      return updatedRow;
    });

    if (updatedRows.length === 0) {
      res.status(404).json({ data: null, error: 'Nenhum registro encontrado' });
      return;
    }

    writeJson(table, nextData);

    if (table !== 'audit_logs') {
      const auditEntries = updatedRows.map((row, index) =>
        buildAuditLog({
          module: table,
          action: 'update',
          entity: table,
          entityId: getEntityId(table, row),
          actor,
          actorId,
          warehouseId: row?.warehouse_id || beforeRows[index]?.warehouse_id || null,
          beforeData: beforeRows[index] || null,
          afterData: row,
          meta: {
            filters,
            changed_fields: Object.keys(updates),
          },
        })
      );
      await persistAuditLogs(auditEntries);
    }

    res.json({ data: sanitizeResponse(normalizeRowsByTable(table, updatedRows)), error: null });
    return;
  }

  try {
    const dbUpdates = normalizeRowForDb(table, updates);
    const updateEntries = Object.entries(dbUpdates);
    const filterEntries = Object.entries(filters);

    const setClause = updateEntries.map(([column], index) => `${column} = $${index + 1}`).join(', ');
    const whereClause = filterEntries
      .map(([column], index) => `${column} = $${updateEntries.length + index + 1}`)
      .join(' AND ');
    const beforeWhereClause = filterEntries
      .map(([column], index) => `${column} = $${index + 1}`)
      .join(' AND ');

    const values = [
      ...updateEntries.map(([, value]) => value),
      ...filterEntries.map(([, value]) => coerceValue(value)),
    ];

    const beforeQuery = `SELECT * FROM ${table} WHERE ${beforeWhereClause}`;
    const beforeResult = await pool.query(beforeQuery, filterEntries.map(([, value]) => coerceValue(value)));

    const query = `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      res.status(404).json({ data: null, error: 'Nenhum registro encontrado' });
      return;
    }

    const normalizedRows = normalizeRowsByTable(table, result.rows);

    if (table !== 'audit_logs') {
      const beforeRows = normalizeRowsByTable(table, beforeResult.rows);
      const beforeMap = new Map(beforeRows.map((row) => [getEntityId(table, row), row]));
      const auditEntries = normalizedRows.map((row) =>
        buildAuditLog({
          module: table,
          action: 'update',
          entity: table,
          entityId: getEntityId(table, row),
          actor,
          actorId,
          warehouseId: row?.warehouse_id || beforeMap.get(getEntityId(table, row))?.warehouse_id || null,
          beforeData: beforeMap.get(getEntityId(table, row)) || null,
          afterData: row,
          meta: {
            filters,
            changed_fields: Object.keys(updates),
          },
        })
      );
      await persistAuditLogs(auditEntries, pool);
    }

    res.json({ data: sanitizeResponse(normalizedRows), error: null });
  } catch (err) {
    markDbDisconnectedIfNeeded(err);
    sendServerError(res, err);
  }
});

app.delete('/:table', authenticate, async (req, res) => {
  const { table } = req.params;
  const actor = String(req.auth?.email || req.auth?.sub || 'Sistema');
  const actorId = req.auth?.sub ? String(req.auth.sub) : null;

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

    if (table !== 'audit_logs') {
      const auditEntries = deletedRows.map((row) =>
        buildAuditLog({
          module: table,
          action: 'delete',
          entity: table,
          entityId: getEntityId(table, row),
          actor,
          actorId,
          warehouseId: row?.warehouse_id || null,
          beforeData: row,
          afterData: null,
          meta: { filters },
        })
      );
      await persistAuditLogs(auditEntries);
    }

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

    const normalizedRows = normalizeRowsByTable(table, result.rows);

    if (table !== 'audit_logs') {
      const auditEntries = normalizedRows.map((row) =>
        buildAuditLog({
          module: table,
          action: 'delete',
          entity: table,
          entityId: getEntityId(table, row),
          actor,
          actorId,
          warehouseId: row?.warehouse_id || null,
          beforeData: row,
          afterData: null,
          meta: { filters },
        })
      );
      await persistAuditLogs(auditEntries, pool);
    }

    res.json({ data: sanitizeResponse(normalizedRows), error: null });
  } catch (err) {
    markDbDisconnectedIfNeeded(err);
    sendServerError(res, err);
  }
});

app.listen(port, () => {
  console.log(`API running on port ${port}`);
  if (!dbConnected) console.log('JSON contingency mode active');
});

