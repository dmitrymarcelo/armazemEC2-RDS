import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '..', 'data');
const backupDir = path.resolve(__dirname, '..', 'data-backups');

const args = process.argv.slice(2);
const argMap = new Map();

for (let i = 0; i < args.length; i += 1) {
  const item = args[i];
  if (!item.startsWith('--')) continue;
  const key = item.slice(2);
  const next = args[i + 1];
  if (!next || next.startsWith('--')) {
    argMap.set(key, 'true');
  } else {
    argMap.set(key, next);
    i += 1;
  }
}

const scale = (argMap.get('scale') || 'large').toLowerCase();
const seedInput = Number(argMap.get('seed') || 20260207);
const keepBackup = argMap.get('backup') !== 'false';

const scaleConfig = {
  demo50: {
    inventory: 50,
    movements: 50,
    purchaseOrders: 50,
    materialRequests: 50,
    notifications: 50,
    vendors: 50,
    vehicles: 50,
    extraUsers: 50,
  },
  medium: {
    inventory: 25000,
    movements: 90000,
    purchaseOrders: 18000,
    materialRequests: 30000,
    notifications: 30000,
    vendors: 4000,
    vehicles: 2200,
    extraUsers: 150,
  },
  large: {
    inventory: 60000,
    movements: 240000,
    purchaseOrders: 42000,
    materialRequests: 90000,
    notifications: 85000,
    vendors: 9000,
    vehicles: 5000,
    extraUsers: 400,
  },
  xlarge: {
    inventory: 100000,
    movements: 400000,
    purchaseOrders: 70000,
    materialRequests: 150000,
    notifications: 140000,
    vendors: 14000,
    vehicles: 9000,
    extraUsers: 800,
  },
};

if (!scaleConfig[scale]) {
  console.error(`Escala invalida: ${scale}. Use demo50 | medium | large | xlarge.`);
  process.exit(1);
}

const cfg = scaleConfig[scale];

const now = Date.now();
const dayMs = 24 * 60 * 60 * 1000;

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const rnd = createRng(seedInput);
const randInt = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(fileName, fallback = []) {
  const p = path.join(dataDir, fileName);
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(fileName, payload) {
  const p = path.join(dataDir, fileName);
  fs.writeFileSync(p, JSON.stringify(payload, null, 2));
}

function hashPassword(password) {
  const iterations = 310000;
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
  return `pbkdf2$${iterations}$${salt}$${digest}`;
}

function makeSku(n) {
  return `SKU-${String(n).padStart(7, '0')}`;
}

function makePlate(n) {
  const a = String.fromCharCode(65 + (n % 26));
  const b = String.fromCharCode(65 + ((n + 7) % 26));
  const c = String.fromCharCode(65 + ((n + 13) % 26));
  return `${a}${b}${c}-${String(1000 + (n % 9000))}`;
}

function sampleDateInPast(maxDays) {
  return new Date(now - randInt(0, maxDays) * dayMs).toISOString();
}

function sampleDateInFuture(maxDays) {
  return new Date(now + randInt(30, maxDays) * dayMs).toISOString().slice(0, 10);
}

function backupCurrentData() {
  if (!keepBackup) return null;

  ensureDir(backupDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(backupDir, `backup-${stamp}`);
  ensureDir(outDir);

  for (const f of fs.readdirSync(dataDir)) {
    if (!f.endsWith('.json')) continue;
    fs.copyFileSync(path.join(dataDir, f), path.join(outDir, f));
  }

  return outDir;
}

ensureDir(dataDir);
const backupPath = backupCurrentData();

const categories = ['Lubrificantes', 'Motor', 'Freios', 'Suspensao', 'Eletrica', 'Cabine', 'Ferramentas', 'EPIs'];
const statuses = ['Em Estoque', 'Estoque Critico', 'Aguardando Inspecao'];
const movementTypes = ['entrada', 'saida', 'ajuste'];
const poStatuses = ['requisicao', 'cotacao', 'pendente', 'enviado', 'aprovado', 'reprovado', 'recebido'];
const priorities = ['normal', 'urgente'];
const requestStatuses = ['aprovacao', 'separacao', 'entregue'];
const requestPriorities = ['Baixa', 'Media', 'Alta'];
const vendorCategories = ['Pecas Pesadas', 'Lubrificantes', 'Pneus', 'Eletrica', 'Ferramentas'];
const vehicleModels = ['Volvo FH', 'Scania R450', 'Mercedes Actros', 'Iveco Stralis', 'VW Constellation'];
const vehicleTypes = ['Caminhao', 'Carreta', 'Utilitario', 'Empilhadeira'];
const vehicleStatuses = ['Ativo', 'Manutencao', 'Em Rota'];
const departments = ['Manutencao', 'Operacoes', 'Frota', 'Oficina Central', 'Logistica'];
const costCenters = ['FROTA-LOG', 'FROTA-EQUIP', 'OPS-CD', 'MAN-OFI', 'SUP-ALMOX'];

const existingUsers = readJson('users.json', []);
const adminUsers = existingUsers.filter((u) => String(u.email || '').toLowerCase() === 'admin@nortetech.com');
const preservedUsers = adminUsers.length > 0 ? adminUsers : existingUsers.slice(0, 1);

if (preservedUsers.length === 0) {
  preservedUsers.push({
    id: '1',
    name: 'Administrador',
    email: 'admin@nortetech.com',
    role: 'admin',
    status: 'Ativo',
    avatar: 'https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff',
    password: hashPassword('admin'),
    modules: ['dashboard', 'recebimento', 'movimentacoes', 'estoque', 'expedicao', 'inventario_ciclico', 'compras', 'cadastro', 'relatorios', 'configuracoes'],
    allowed_warehouses: ['ARMZ28', 'ARMZ33'],
  });
}

const warehouses = readJson('warehouses.json', []);
const whIds = warehouses.length > 0 ? warehouses.map((w) => w.id) : ['ARMZ28', 'ARMZ33'];
const demoWarehouseId = scale === 'demo50'
  ? (whIds.includes('ARMZ28') ? 'ARMZ28' : whIds[0])
  : null;

const vendors = [];
for (let i = 1; i <= cfg.vendors; i += 1) {
  vendors.push({
    id: `V-${String(i).padStart(5, '0')}`,
    name: `Fornecedor ${i}`,
    contact: `Contato ${i}`,
    email: `fornecedor${i}@example.com`,
    phone: `(92) 9${String(10000000 + (i % 89999999)).padStart(8, '0')}`,
    category: pick(vendorCategories),
    cnpj: String(10000000000000 + i),
    status: i % 15 === 0 ? 'Inativo' : 'Ativo',
    created_at: sampleDateInPast(1400),
  });
}

const vehicles = [];
for (let i = 1; i <= cfg.vehicles; i += 1) {
  vehicles.push({
    plate: makePlate(i),
    model: pick(vehicleModels),
    type: pick(vehicleTypes),
    status: pick(vehicleStatuses),
    last_maintenance: sampleDateInPast(240),
    cost_center: pick(costCenters),
    created_at: sampleDateInPast(1400),
  });
}

const inventory = [];
for (let i = 1; i <= cfg.inventory; i += 1) {
  const minQty = randInt(5, 80);
  const maxQty = minQty + randInt(80, 900);
  const quantity = randInt(0, maxQty + 150);
  const status = quantity < minQty ? 'Estoque Critico' : pick(statuses);
  const category = pick(categories);
  const abc = rnd() > 0.7 ? (rnd() > 0.5 ? 'B' : 'C') : 'A';
  const wh = demoWarehouseId || pick(whIds);
  const sku = makeSku(i);

  inventory.push({
    sku,
    name: `${category} Item ${i}`,
    location: `${String.fromCharCode(65 + (i % 20))}-${String((i % 60) + 1).padStart(2, '0')}-${String((i % 40) + 1).padStart(2, '0')}`,
    batch: `B-${String(10000 + (i % 90000))}`,
    expiry: sampleDateInFuture(2000),
    quantity,
    status,
    category,
    abc_category: abc,
    unit: rnd() > 0.8 ? 'CX' : 'UN',
    min_qty: minQty,
    max_qty: maxQty,
    warehouse_id: wh,
    lead_time: randInt(2, 35),
    safety_stock: randInt(3, 70),
    created_at: sampleDateInPast(1200),
  });
}

const skuIdx = inventory.map((item) => item.sku);
const skuMap = new Map(inventory.map((item) => [item.sku, item]));

const purchaseOrders = [];
for (let i = 1; i <= cfg.purchaseOrders; i += 1) {
  const itemCount = randInt(1, 4);
  const items = [];
  let total = 0;

  for (let n = 0; n < itemCount; n += 1) {
    const sku = pick(skuIdx);
    const invItem = skuMap.get(sku);
    const qty = randInt(1, 120);
    const price = Number((rnd() * 800 + 10).toFixed(2));
    total += qty * price;
    items.push({
      sku,
      name: invItem?.name || `Produto ${sku}`,
      qty,
      price,
    });
  }

  const status = pick(poStatuses);
  const wh = demoWarehouseId || pick(whIds);

  purchaseOrders.push({
    id: `PO-2026-${String(i).padStart(6, '0')}`,
    vendor: pick(vendors).name,
    request_date: sampleDateInPast(700),
    status,
    priority: pick(priorities),
    total: Number(total.toFixed(2)),
    requester: `Comprador ${randInt(1, 120)}`,
    items,
    quotes: [],
    selected_quote_id: null,
    sent_to_vendor_at: status === 'enviado' || status === 'aprovado' || status === 'recebido' ? sampleDateInPast(600) : null,
    received_at: status === 'recebido' ? sampleDateInPast(300) : null,
    quotes_added_at: status !== 'requisicao' ? sampleDateInPast(650) : null,
    approved_at: status === 'aprovado' || status === 'recebido' ? sampleDateInPast(500) : null,
    rejected_at: status === 'reprovado' ? sampleDateInPast(500) : null,
    vendor_order_number: `VN-${100000 + i}`,
    approval_history: [],
    cost_center: pick(costCenters),
    warehouse_id: wh,
    created_at: sampleDateInPast(900),
  });
}

const movements = [];
for (let i = 1; i <= cfg.movements; i += 1) {
  const sku = pick(skuIdx);
  const invItem = skuMap.get(sku);
  const type = pick(movementTypes);
  const wh = invItem?.warehouse_id || demoWarehouseId || pick(whIds);

  movements.push({
    id: `MOV-${String(i).padStart(9, '0')}`,
    timestamp: sampleDateInPast(900),
    type,
    sku,
    product_name: invItem?.name || `Produto ${sku}`,
    quantity: randInt(1, 80),
    user: `Operador ${randInt(1, 500)}`,
    location: invItem?.location || 'N/A',
    reason: type === 'entrada' ? 'Recebimento de compra' : type === 'saida' ? 'Separacao para expedicao' : 'Ajuste inventario',
    order_id: i % 3 === 0 ? `PO-2026-${String(randInt(1, cfg.purchaseOrders)).padStart(6, '0')}` : null,
    warehouse_id: wh,
  });
}

const materialRequests = [];
for (let i = 1; i <= cfg.materialRequests; i += 1) {
  const sku = pick(skuIdx);
  const invItem = skuMap.get(sku);
  const vehicle = vehicles.length > 0 ? pick(vehicles) : null;
  const wh = invItem?.warehouse_id || demoWarehouseId || pick(whIds);

  materialRequests.push({
    id: `REQ-${String(i).padStart(8, '0')}`,
    sku,
    name: invItem?.name || `Produto ${sku}`,
    qty: randInt(1, 40),
    plate: vehicle?.plate || makePlate(i),
    dept: pick(departments),
    priority: pick(requestPriorities),
    status: pick(requestStatuses),
    created_at: sampleDateInPast(700),
    cost_center: pick(costCenters),
    warehouse_id: wh,
  });
}

const notifications = [];
for (let i = 1; i <= cfg.notifications; i += 1) {
  const sku = pick(skuIdx);
  const nType = rnd() > 0.8 ? 'warning' : rnd() > 0.5 ? 'info' : 'success';
  notifications.push({
    id: `NTF-${String(i).padStart(9, '0')}`,
    title: nType === 'warning' ? `Alerta de estoque ${sku}` : `Evento operacional ${i}`,
    message: nType === 'warning'
      ? `Item ${sku} requer atencao operacional para reposicao.`
      : `Atualizacao automatica de processo #${i}.`,
    type: nType,
    read: rnd() > 0.7,
    user_id: String(randInt(1, 400)),
    created_at: sampleDateInPast(700),
  });
}

const generatedUsers = [];
for (let i = 1; i <= cfg.extraUsers; i += 1) {
  generatedUsers.push({
    id: `u-${String(i).padStart(5, '0')}`,
    name: `Operador ${i}`,
    email: `operador${i}@nortetech.com`,
    role: i % 25 === 0 ? 'manager' : 'operator',
    status: i % 30 === 0 ? 'Inativo' : 'Ativo',
    avatar: `https://ui-avatars.com/api/?name=Operador+${i}&background=0D8ABC&color=fff`,
    password: hashPassword('senha123'),
    modules: i % 25 === 0
      ? ['dashboard', 'movimentacoes', 'estoque', 'expedicao', 'relatorios']
      : ['dashboard', 'movimentacoes', 'estoque', 'expedicao'],
    allowed_warehouses: i % 2 === 0 ? ['ARMZ28'] : ['ARMZ33'],
    last_access: sampleDateInPast(45),
    created_at: sampleDateInPast(600),
  });
}

const users = [...preservedUsers, ...generatedUsers];

writeJson('warehouses.json', warehouses.length > 0 ? warehouses : [
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
]);

writeJson('users.json', users);
writeJson('vendors.json', vendors);
writeJson('vehicles.json', vehicles);
writeJson('inventory.json', inventory);
writeJson('purchase_orders.json', purchaseOrders);
writeJson('movements.json', movements);
writeJson('material_requests.json', materialRequests);
writeJson('notifications.json', notifications);

const summary = {
  generatedAt: new Date().toISOString(),
  scale,
  seed: seedInput,
  backupPath,
  counts: {
    warehouses: warehouses.length > 0 ? warehouses.length : 2,
    users: users.length,
    vendors: vendors.length,
    vehicles: vehicles.length,
    inventory: inventory.length,
    purchase_orders: purchaseOrders.length,
    movements: movements.length,
    material_requests: materialRequests.length,
    notifications: notifications.length,
  },
  loginSeed: {
    admin: {
      email: 'admin@nortetech.com',
      password: 'admin',
    },
    sampleOperator: {
      email: 'operador1@nortetech.com',
      password: 'senha123',
    },
  },
};

const summaryPath = path.resolve(__dirname, '..', 'reports', `seed-summary-${Date.now()}.json`);
ensureDir(path.dirname(summaryPath));
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

console.log(JSON.stringify(summary, null, 2));
