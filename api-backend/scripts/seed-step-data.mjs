import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '..', 'data');

const args = process.argv.slice(2);
const argMap = new Map();
for (let i = 0; i < args.length; i += 1) {
  const current = args[i];
  if (!current.startsWith('--')) continue;
  const key = current.slice(2);
  const next = args[i + 1];
  if (!next || next.startsWith('--')) {
    argMap.set(key, 'true');
  } else {
    argMap.set(key, next);
    i += 1;
  }
}

const table = String(argMap.get('table') || '').toLowerCase();
const count = Math.max(1, Number.parseInt(String(argMap.get('count') || '1'), 10) || 1);
const warehouseId = String(argMap.get('warehouse') || 'ARMZ28');

const allowedTables = new Set([
  'users',
  'vendors',
  'vehicles',
  'inventory',
  'purchase_orders',
  'movements',
  'material_requests',
  'notifications',
]);

if (!allowedTables.has(table)) {
  console.error(
    `Tabela invalida: ${table}. Use --table users|vendors|vehicles|inventory|purchase_orders|movements|material_requests|notifications`
  );
  process.exit(1);
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
  fs.writeFileSync(path.join(dataDir, fileName), JSON.stringify(payload, null, 2));
}

function nextNumber(existing, getter) {
  let max = 0;
  for (const item of existing) {
    const raw = String(getter(item) || '');
    const parsed = Number.parseInt(raw.replace(/\D/g, ''), 10);
    if (!Number.isNaN(parsed) && parsed > max) max = parsed;
  }
  return max + 1;
}

function makePlate(n) {
  const a = String.fromCharCode(65 + (n % 26));
  const b = String.fromCharCode(65 + ((n + 5) % 26));
  const c = String.fromCharCode(65 + ((n + 11) % 26));
  return `${a}${b}${c}-${String(1000 + (n % 9000))}`;
}

const now = Date.now();
const dayMs = 24 * 60 * 60 * 1000;
const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pastIso = (maxDays = 180) => new Date(now - Math.floor(Math.random() * maxDays) * dayMs).toISOString();

const users = readJson('users.json', []);
const vendors = readJson('vendors.json', []);
const vehicles = readJson('vehicles.json', []);
const inventory = readJson('inventory.json', []);
const purchaseOrders = readJson('purchase_orders.json', []);
const movements = readJson('movements.json', []);
const materialRequests = readJson('material_requests.json', []);
const notifications = readJson('notifications.json', []);

const inventoryStatuses = ['disponivel', 'excesso', 'divergente', 'transito', 'vencimento'];
const categories = ['Lubrificantes', 'Motor', 'Freios', 'Suspensao', 'Eletrica'];
const poStatuses = ['requisicao', 'cotacao', 'pendente', 'aprovado', 'enviado', 'recebido'];
const movementTypes = ['entrada', 'saida', 'ajuste'];
const requestStatuses = ['aprovacao', 'separacao', 'entregue'];
const priorities = ['normal', 'alta', 'urgente'];

if (table === 'users') {
  let n = nextNumber(users, (u) => u?.id);
  for (let i = 0; i < count; i += 1) {
    const num = n + i;
    users.push({
      id: `u-${String(num).padStart(5, '0')}`,
      name: `Operador ${num}`,
      email: `operador${num}@nortetech.com`,
      role: 'operator',
      status: 'Ativo',
      avatar: `https://ui-avatars.com/api/?name=Operador+${num}&background=0D8ABC&color=fff`,
      password: users.find((u) => u.email === 'admin@nortetech.com')?.password || '',
      modules: ['dashboard', 'movimentacoes', 'estoque', 'expedicao'],
      allowed_warehouses: [warehouseId],
      last_access: pastIso(30),
      created_at: pastIso(300),
    });
  }
  writeJson('users.json', users);
}

if (table === 'vendors') {
  let n = nextNumber(vendors, (v) => v?.id);
  for (let i = 0; i < count; i += 1) {
    const num = n + i;
    vendors.push({
      id: `V-${String(num).padStart(5, '0')}`,
      name: `Fornecedor ${num}`,
      contact: `Contato ${num}`,
      email: `fornecedor${num}@example.com`,
      cnpj: String(10000000000000 + num),
      category: randomFrom(['Pecas', 'Lubrificantes', 'Ferramentas']),
      status: 'Ativo',
      created_at: pastIso(400),
    });
  }
  writeJson('vendors.json', vendors);
}

if (table === 'vehicles') {
  let n = nextNumber(vehicles, (v) => v?.plate);
  for (let i = 0; i < count; i += 1) {
    const num = n + i;
    vehicles.push({
      plate: makePlate(num),
      model: randomFrom(['Volvo FH', 'Scania R450', 'Mercedes Actros']),
      type: randomFrom(['Caminhao', 'Carreta', 'Utilitario']),
      status: 'Disponivel',
      last_maintenance: pastIso(120),
      cost_center: randomFrom(['FROTA-LOG', 'OPS-CD', 'MAN-OFI']),
      created_at: pastIso(500),
    });
  }
  writeJson('vehicles.json', vehicles);
}

if (table === 'inventory') {
  let n = nextNumber(inventory, (item) => item?.sku);
  for (let i = 0; i < count; i += 1) {
    const num = n + i;
    const min = 10 + (num % 30);
    const max = min + 80;
    const qty = min + (num % 50);
    inventory.push({
      sku: `SKU-${String(num).padStart(6, '0')}`,
      name: `Item Teste ${num}`,
      location: `A-${String((num % 20) + 1).padStart(2, '0')}-01`,
      batch: `B-${String(1000 + num)}`,
      expiry: new Date(now + 180 * dayMs).toISOString().slice(0, 10),
      quantity: qty,
      status: randomFrom(inventoryStatuses),
      image_url: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400&q=80',
      category: randomFrom(categories),
      abc_category: randomFrom(['A', 'B', 'C']),
      min_qty: min,
      max_qty: max,
      unit: 'UN',
      lead_time: 7,
      safety_stock: 5,
      warehouse_id: warehouseId,
      created_at: pastIso(700),
    });
  }
  writeJson('inventory.json', inventory);
}

if (table === 'purchase_orders') {
  let n = nextNumber(purchaseOrders, (po) => po?.id);
  const vendorPool = vendors.length > 0 ? vendors : [{ id: 'V-00000', name: 'Fornecedor Base' }];
  const itemPool =
    inventory.length > 0
      ? inventory
      : [{ sku: 'SKU-BASE-001', name: 'Item Base', warehouse_id: warehouseId }];

  for (let i = 0; i < count; i += 1) {
    const num = n + i;
    const inv = randomFrom(itemPool);
    const qty = 1 + (num % 20);
    const unitPrice = 50 + (num % 90);
    purchaseOrders.push({
      id: `PO-TEST-${String(num).padStart(5, '0')}`,
      vendor: randomFrom(vendorPool).name,
      request_date: pastIso(180),
      status: randomFrom(poStatuses),
      priority: randomFrom(['normal', 'urgente']),
      total: Number((qty * unitPrice).toFixed(2)),
      requester: 'Comprador Teste',
      items: [{ sku: inv.sku, name: inv.name, qty, price: unitPrice }],
      quotes: [],
      selected_quote_id: null,
      sent_to_vendor_at: null,
      received_at: null,
      quotes_added_at: null,
      approved_at: null,
      rejected_at: null,
      vendor_order_number: `VN-${String(100000 + num)}`,
      approval_history: [],
      cost_center: 'OPS-CD',
      warehouse_id: inv.warehouse_id || warehouseId,
      created_at: pastIso(180),
    });
  }
  writeJson('purchase_orders.json', purchaseOrders);
}

if (table === 'movements') {
  let n = nextNumber(movements, (m) => m?.id);
  const itemPool =
    inventory.length > 0
      ? inventory
      : [{ sku: 'SKU-BASE-001', name: 'Item Base', location: 'A-01-01', warehouse_id: warehouseId }];

  for (let i = 0; i < count; i += 1) {
    const num = n + i;
    const inv = randomFrom(itemPool);
    movements.push({
      id: `MOV-TEST-${String(num).padStart(6, '0')}`,
      sku: inv.sku,
      product_name: inv.name,
      type: randomFrom(movementTypes),
      quantity: 1 + (num % 15),
      timestamp: pastIso(120),
      user: 'Operador Teste',
      location: inv.location || 'A-01-01',
      reason: 'Movimento de teste',
      order_id: null,
      warehouse_id: inv.warehouse_id || warehouseId,
    });
  }
  writeJson('movements.json', movements);
}

if (table === 'material_requests') {
  let n = nextNumber(materialRequests, (r) => r?.id);
  const itemPool =
    inventory.length > 0
      ? inventory
      : [{ sku: 'SKU-BASE-001', name: 'Item Base', warehouse_id: warehouseId }];
  const platePool = vehicles.length > 0 ? vehicles.map((v) => v.plate) : ['ABC-1234'];

  for (let i = 0; i < count; i += 1) {
    const num = n + i;
    const inv = randomFrom(itemPool);
    materialRequests.push({
      id: `REQ-TEST-${String(num).padStart(6, '0')}`,
      sku: inv.sku,
      name: inv.name,
      qty: 1 + (num % 10),
      plate: randomFrom(platePool),
      dept: randomFrom(['Manutencao', 'Operacoes', 'Logistica']),
      priority: randomFrom(priorities),
      status: randomFrom(requestStatuses),
      cost_center: 'OPS-CD',
      warehouse_id: inv.warehouse_id || warehouseId,
      created_at: pastIso(120),
    });
  }
  writeJson('material_requests.json', materialRequests);
}

if (table === 'notifications') {
  let n = nextNumber(notifications, (n1) => n1?.id);
  for (let i = 0; i < count; i += 1) {
    const num = n + i;
    notifications.push({
      id: `NTF-TEST-${String(num).padStart(6, '0')}`,
      title: `Notificacao ${num}`,
      message: `Mensagem de teste ${num}`,
      type: randomFrom(['info', 'warning', 'success']),
      read: false,
      user_id: '1',
      created_at: pastIso(90),
    });
  }
  writeJson('notifications.json', notifications);
}

const counts = {
  users: readJson('users.json', []).length,
  vendors: readJson('vendors.json', []).length,
  vehicles: readJson('vehicles.json', []).length,
  inventory: readJson('inventory.json', []).length,
  purchase_orders: readJson('purchase_orders.json', []).length,
  movements: readJson('movements.json', []).length,
  material_requests: readJson('material_requests.json', []).length,
  notifications: readJson('notifications.json', []).length,
};

console.log(
  JSON.stringify(
    {
      table,
      added: count,
      warehouseId,
      counts,
    },
    null,
    2
  )
);

