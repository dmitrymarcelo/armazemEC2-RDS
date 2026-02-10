import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const dataDir = path.resolve(__dirname, '..', 'data');
const backupsDir = path.resolve(__dirname, '..', 'data-backups');
const inventoryFile = path.join(dataDir, 'inventory.json');

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

const toBool = (value) => String(value || '').toLowerCase() === 'true';

const inputPath = argMap.get('file')
  ? path.resolve(String(argMap.get('file')))
  : path.resolve(projectRoot, 'template_itens_logiwms.xlsx');
const sheetNameArg = argMap.get('sheet') ? String(argMap.get('sheet')) : null;
const warehouseId = String(argMap.get('warehouse') || 'ARMZ28').trim() || 'ARMZ28';
const dryRun = toBool(argMap.get('dry-run'));
const mode = String(argMap.get('mode') || 'upsert').toLowerCase();

if (!['upsert', 'append'].includes(mode)) {
  console.error('Parametro --mode invalido. Use "upsert" ou "append".');
  process.exit(1);
}

if (!fs.existsSync(inputPath)) {
  console.error(`Arquivo XLSX nao encontrado: ${inputPath}`);
  process.exit(1);
}

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const normalizeToken = (value) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');

const toNumber = (value, fallback = 0) => {
  const n = Number(String(value ?? '').replace(',', '.'));
  if (Number.isFinite(n)) return n;
  return fallback;
};

const toInt = (value, fallback = 0) => {
  const parsed = Math.round(toNumber(value, fallback));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sanitizeName = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const ensureInventoryFile = () => {
  if (!fs.existsSync(inventoryFile)) {
    fs.writeFileSync(inventoryFile, '[]\n');
  }
};

const readInventory = () => {
  ensureInventoryFile();
  try {
    const raw = fs.readFileSync(inventoryFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeInventory = (rows) => {
  fs.writeFileSync(inventoryFile, `${JSON.stringify(rows, null, 2)}\n`);
};

const ensureBackup = (rows) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const folder = path.join(backupsDir, `backup-${stamp}`);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'inventory.json'), `${JSON.stringify(rows, null, 2)}\n`);
  return folder;
};

const inferCategory = (name) => {
  const token = normalizeToken(name);
  if (!token) return 'Geral';
  if (token.includes('oleo') || token.includes('lubrificante') || token.includes('graxa')) return 'Lubrificantes';
  if (token.includes('filtro')) return 'Filtros';
  if (token.includes('parafuso') || token.includes('porca') || token.includes('arruela') || token.includes('rebite')) return 'Fixadores';
  if (token.includes('pneu')) return 'Pneus';
  if (token.includes('correia')) return 'Transmissao';
  return 'Geral';
};

const nextSkuSeed = (rows) => {
  let max = 0;
  for (const row of rows) {
    const raw = String(row?.sku || '').trim();
    const match = raw.match(/^SKU-(\d{1,6})$/i);
    if (!match) continue;
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isNaN(parsed) && parsed > max) max = parsed;
  }
  return max + 1;
};

const buildRowFromSheet = (sheetRow, sku) => {
  const name = sanitizeName(sheetRow.Nome);
  const unit = sanitizeName(sheetRow['Unidade de Medida']) || 'UN';
  const quantity = Math.max(0, toInt(sheetRow.Quantidade, 0));
  const minQty = Math.max(0, toInt(sheetRow['Quantidade Mínima'], 0));
  const maxQty = Math.max(minQty + 1, Math.max(quantity, minQty) * 3 || 100);

  return {
    sku,
    name,
    location: 'DOCA-01',
    batch: 'N/A',
    expiry: 'N/A',
    quantity,
    status: quantity > 0 ? 'disponivel' : 'baixo',
    image_url: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400&q=80',
    category: inferCategory(name),
    min_qty: minQty,
    max_qty: maxQty,
    unit,
    lead_time: 7,
    safety_stock: Math.max(1, Math.round(minQty * 0.2)),
    warehouse_id: warehouseId,
    created_at: new Date().toISOString(),
  };
};

const buildKey = (name, unit, wh) => `${normalizeToken(name)}|${normalizeToken(unit)}|${normalizeToken(wh)}`;

const workbook = XLSX.readFile(inputPath);
const selectedSheetName = sheetNameArg && workbook.SheetNames.includes(sheetNameArg) ? sheetNameArg : workbook.SheetNames[0];
const worksheet = workbook.Sheets[selectedSheetName];
const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

if (!rows.length) {
  console.error(`Nenhuma linha encontrada na planilha (${selectedSheetName}).`);
  process.exit(1);
}

const normalizedRows = rows
  .map((row) => ({
    Nome: sanitizeName(row.Nome),
    'Unidade de Medida': sanitizeName(row['Unidade de Medida']) || 'UN',
    Quantidade: toInt(row.Quantidade, 0),
    'Quantidade Mínima': toInt(row['Quantidade Mínima'], 0),
  }))
  .filter((row) => row.Nome.length > 0);

if (!normalizedRows.length) {
  console.error('A planilha nao possui itens validos (coluna Nome vazia).');
  process.exit(1);
}

const currentInventory = readInventory();
const currentByKey = new Map();
currentInventory.forEach((row, index) => {
  const key = buildKey(row?.name, row?.unit || 'UN', row?.warehouse_id || 'ARMZ28');
  if (!currentByKey.has(key)) {
    currentByKey.set(key, index);
  }
});

let skuSeed = nextSkuSeed(currentInventory);
let inserted = 0;
let updated = 0;
let ignored = 0;

const nextInventory = [...currentInventory];

for (const row of normalizedRows) {
  const key = buildKey(row.Nome, row['Unidade de Medida'], warehouseId);
  const existingIndex = currentByKey.get(key);

  if (mode === 'upsert' && existingIndex !== undefined) {
    const prev = nextInventory[existingIndex] || {};
    nextInventory[existingIndex] = {
      ...prev,
      name: row.Nome,
      unit: row['Unidade de Medida'],
      quantity: Math.max(0, row.Quantidade),
      min_qty: Math.max(0, row['Quantidade Mínima']),
      max_qty: Math.max(
        Math.max(0, row['Quantidade Mínima']) + 1,
        Math.max(0, row.Quantidade, row['Quantidade Mínima']) * 3 || Number(prev.max_qty || 100)
      ),
      status: row.Quantidade > 0 ? 'disponivel' : 'baixo',
      warehouse_id: warehouseId,
      category: prev.category || inferCategory(row.Nome),
    };
    updated += 1;
    continue;
  }

  if (existingIndex !== undefined) {
    ignored += 1;
    continue;
  }

  const sku = `SKU-${String(skuSeed).padStart(6, '0')}`;
  skuSeed += 1;
  const created = buildRowFromSheet(row, sku);
  nextInventory.push(created);
  currentByKey.set(key, nextInventory.length - 1);
  inserted += 1;
}

if (!dryRun) {
  const backupPath = ensureBackup(currentInventory);
  writeInventory(nextInventory);
  console.log(`Backup criado em: ${backupPath}`);
}

const summary = {
  file: inputPath,
  sheet: selectedSheetName,
  warehouse_id: warehouseId,
  mode,
  dry_run: dryRun,
  source_rows: rows.length,
  valid_rows: normalizedRows.length,
  inserted,
  updated,
  ignored,
  total_before: currentInventory.length,
  total_after: nextInventory.length,
};

console.log(JSON.stringify(summary, null, 2));
