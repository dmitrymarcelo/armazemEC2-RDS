import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '..', 'data');
const backupDir = path.resolve(__dirname, '..', 'data-backups');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJson(fileName, fallback = []) {
  const filePath = path.join(dataDir, fileName);
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(fileName, payload) {
  const filePath = path.join(dataDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function hashPassword(password) {
  const iterations = 310000;
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
  return `pbkdf2$${iterations}$${salt}$${digest}`;
}

function backupCurrentData() {
  ensureDir(backupDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(backupDir, `backup-${stamp}`);
  ensureDir(outDir);

  for (const fileName of fs.readdirSync(dataDir)) {
    if (!fileName.endsWith('.json')) continue;
    fs.copyFileSync(path.join(dataDir, fileName), path.join(outDir, fileName));
  }

  return outDir;
}

function getDefaultWarehouses() {
  return [
    {
      id: 'ARMZ28',
      name: 'Armazem Principal',
      description: 'Operacoes gerais de armazenamento e distribuicao',
      location: 'Manaus - AM',
      manager_name: 'Administrador',
      is_active: true,
    },
    {
      id: 'ARMZ33',
      name: 'Conferencia de Carga em Tempo Real',
      description: 'Recebimento, conferencia e validacao de carga',
      location: 'Manaus - AM',
      manager_name: 'Administrador',
      is_active: true,
    },
  ];
}

function normalizeAdminUser(baseUser) {
  const modules = [
    'dashboard',
    'recebimento',
    'movimentacoes',
    'estoque',
    'expedicao',
    'inventario_ciclico',
    'compras',
    'cadastro',
    'relatorios',
    'configuracoes',
  ];

  return {
    id: String(baseUser?.id || '1'),
    name: String(baseUser?.name || 'Administrador'),
    email: 'admin@nortetech.com',
    role: 'admin',
    status: 'Ativo',
    avatar: String(baseUser?.avatar || 'https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff'),
    password:
      typeof baseUser?.password === 'string' && baseUser.password.startsWith('pbkdf2$')
        ? baseUser.password
        : hashPassword('admin'),
    modules,
    allowed_warehouses: ['ARMZ28', 'ARMZ33'],
    created_at: baseUser?.created_at || new Date().toISOString(),
  };
}

ensureDir(dataDir);
const backupPath = backupCurrentData();

const users = readJson('users.json', []);
const existingAdmin =
  users.find((u) => String(u?.email || '').toLowerCase() === 'admin@nortetech.com') ||
  users.find((u) => String(u?.role || '').toLowerCase() === 'admin');

const warehouses = readJson('warehouses.json', []);
const normalizedWarehouses = Array.isArray(warehouses) && warehouses.length > 0 ? warehouses : getDefaultWarehouses();
const admin = normalizeAdminUser(existingAdmin);

writeJson('warehouses.json', normalizedWarehouses);
writeJson('users.json', [admin]);
writeJson('vendors.json', []);
writeJson('vehicles.json', []);
writeJson('inventory.json', []);
writeJson('purchase_orders.json', []);
writeJson('movements.json', []);
writeJson('material_requests.json', []);
writeJson('notifications.json', []);

const summary = {
  cleanedAt: new Date().toISOString(),
  backupPath,
  counts: {
    warehouses: normalizedWarehouses.length,
    users: 1,
    vendors: 0,
    vehicles: 0,
    inventory: 0,
    purchase_orders: 0,
    movements: 0,
    material_requests: 0,
    notifications: 0,
  },
  login: {
    email: 'admin@nortetech.com',
    password: 'admin',
  },
};

console.log(JSON.stringify(summary, null, 2));
