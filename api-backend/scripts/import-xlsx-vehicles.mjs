import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import pg from 'pg';
import XLSX from 'xlsx';

dotenv.config();

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

const toBool = (value) => String(value || '').trim().toLowerCase() === 'true';
const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const normalizeKey = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const normalizeText = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizePlate = (value) => {
  const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!raw) return '';
  if (/^[A-Z]{3}\d{4}$/.test(raw) || /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(raw)) {
    return `${raw.slice(0, 3)}-${raw.slice(3)}`;
  }
  return raw;
};

const normalizeStatus = (value) => {
  const token = normalizeKey(value);
  if (!token) return 'Disponivel';
  if (token.includes('vencid') || token.includes('manut') || token.includes('oficina')) return 'Manutencao';
  if (token.includes('viagem') || token.includes('transito')) return 'Em Viagem';
  if (token.includes('inativ') || token.includes('bloque')) return 'Inativo';
  return 'Disponivel';
};

const parseDateToIso = (value) => {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'number') {
    const excelDate = XLSX.SSF.parse_date_code(value);
    if (excelDate) {
      const parsed = new Date(
        Date.UTC(
          excelDate.y,
          Math.max(0, excelDate.m - 1),
          excelDate.d,
          excelDate.H || 0,
          excelDate.M || 0,
          excelDate.S || 0
        )
      );
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
  }

  const text = String(value).trim();
  if (!text) return null;

  const ddmmyyyy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (ddmmyyyy) {
    const [, day, month, year, hh = '0', mm = '0', ss = '0'] = ddmmyyyy;
    const parsed = new Date(
      Date.UTC(
        Number(year),
        Math.max(0, Number(month) - 1),
        Number(day),
        Number(hh),
        Number(mm),
        Number(ss)
      )
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const resolveSheetValue = (row, aliases) => {
  const rowKeys = Object.keys(row || {});
  for (const alias of aliases) {
    const target = normalizeKey(alias);
    const matched = rowKeys.find((key) => normalizeKey(key) === target);
    if (!matched) continue;
    return row[matched];
  }
  return undefined;
};

const inputPathArg = argMap.get('file') ? String(argMap.get('file')) : '';
const inputPath = inputPathArg
  ? path.resolve(inputPathArg)
  : path.resolve(process.cwd(), 'controle_de_manutencoes.xlsx');
const sheetArg = argMap.get('sheet') ? String(argMap.get('sheet')) : '';
const mode = String(argMap.get('mode') || 'upsert').trim().toLowerCase();
const batchSize = parsePositiveInt(argMap.get('batch-size'), 500);
const dryRun = toBool(argMap.get('dry-run'));

if (!['upsert'].includes(mode)) {
  console.error('Parametro --mode invalido. Valor suportado: upsert');
  process.exit(1);
}

if (!fs.existsSync(inputPath)) {
  console.error(`Arquivo XLSX nao encontrado: ${inputPath}`);
  process.exit(1);
}

const workbook = XLSX.readFile(inputPath);
if (!Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
  console.error('A planilha nao possui abas validas.');
  process.exit(1);
}

const selectedSheet =
  sheetArg && workbook.SheetNames.includes(sheetArg)
    ? sheetArg
    : workbook.SheetNames[0];

const worksheet = workbook.Sheets[selectedSheet];
const sourceRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

if (!sourceRows.length) {
  console.error(`Nenhuma linha encontrada na aba "${selectedSheet}".`);
  process.exit(1);
}

const dedupedByPlate = new Map();
let invalidRows = 0;

for (const row of sourceRows) {
  const plate = normalizePlate(resolveSheetValue(row, ['Placa', 'PLACA', 'cod_placa']));
  const model = normalizeText(resolveSheetValue(row, ['Modelo', 'MODELO', 'modelo_veiculo']));
  const type = normalizeText(resolveSheetValue(row, ['Modalidade', 'Tipo', 'TIPO'])) || 'PROPRIO';
  const status = normalizeStatus(resolveSheetValue(row, ['Situacao', 'Situação', 'Status']));
  const costCenter = normalizeText(
    resolveSheetValue(row, ['Centro de custo', 'Centro de Custo', 'CENTRO_CUSTO', 'Cost Center'])
  );
  const lastMaintenance = parseDateToIso(
    resolveSheetValue(row, ['Data Ultima Manutencao', 'Data Última Manutenção', 'ULTIMA_MANUTENCAO'])
  );

  if (!plate || !model) {
    invalidRows += 1;
    continue;
  }

  dedupedByPlate.set(plate, {
    plate,
    model,
    type,
    status,
    last_maintenance: lastMaintenance,
    cost_center: costCenter || null,
  });
}

const normalizedVehicles = Array.from(dedupedByPlate.values());
const validRows = normalizedVehicles.length;
const ignoredRows = sourceRows.length - validRows;

if (!validRows) {
  console.error('Nao ha registros validos para importar.');
  process.exit(1);
}

const dbSslEnabled = String(process.env.DB_SSL || '').toLowerCase() === 'true';
const dbSslRejectUnauthorized =
  String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'false').toLowerCase() === 'true';

const client = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl: dbSslEnabled ? { rejectUnauthorized: dbSslRejectUnauthorized } : undefined,
  connectionTimeoutMillis: 10000,
});

const buildBatchUpsertQuery = (rows) => {
  const columns = ['plate', 'model', 'type', 'status', 'last_maintenance', 'cost_center'];
  const values = [];

  const rowPlaceholders = rows
    .map((row, rowIndex) => {
      const placeholders = columns
        .map((column, columnIndex) => {
          values.push(row[column] ?? null);
          return `$${rowIndex * columns.length + columnIndex + 1}`;
        })
        .join(', ');
      return `(${placeholders})`;
    })
    .join(', ');

  const query = `
    INSERT INTO vehicles (${columns.join(', ')})
    VALUES ${rowPlaceholders}
    ON CONFLICT (plate) DO UPDATE SET
      model = EXCLUDED.model,
      type = EXCLUDED.type,
      status = EXCLUDED.status,
      last_maintenance = COALESCE(EXCLUDED.last_maintenance, vehicles.last_maintenance),
      cost_center = COALESCE(NULLIF(EXCLUDED.cost_center, ''), vehicles.cost_center)
  `;

  return { query, values };
};

const chunk = (rows, size) => {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
};

let inserted = 0;
let updated = 0;
let totalBefore = 0;
let totalAfter = 0;
let auditLogged = false;

try {
  await client.connect();

  const beforeResult = await client.query('SELECT COUNT(*)::int AS total FROM vehicles');
  totalBefore = Number(beforeResult.rows?.[0]?.total || 0);

  const batches = chunk(normalizedVehicles, batchSize);
  for (const batchRows of batches) {
    const plates = batchRows.map((row) => row.plate);
    const existingResult = await client.query(
      'SELECT plate FROM vehicles WHERE plate = ANY($1::text[])',
      [plates]
    );
    const existingPlates = new Set(existingResult.rows.map((row) => row.plate));

    for (const row of batchRows) {
      if (existingPlates.has(row.plate)) updated += 1;
      else inserted += 1;
    }

    if (dryRun) continue;

    const { query, values } = buildBatchUpsertQuery(batchRows);
    await client.query('BEGIN');
    try {
      await client.query(query, values);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }

  totalAfter = dryRun
    ? totalBefore + inserted
    : Number((await client.query('SELECT COUNT(*)::int AS total FROM vehicles')).rows?.[0]?.total || 0);

  if (!dryRun) {
    const summaryMeta = {
      file: inputPath,
      sheet: selectedSheet,
      mode,
      batch_size: batchSize,
      source_rows: sourceRows.length,
      valid_rows: validRows,
      inserted,
      updated,
      ignored: ignoredRows,
      total_before: totalBefore,
      total_after: totalAfter,
    };

    await client.query(
      `
        INSERT INTO audit_logs (
          entity,
          entity_id,
          module,
          action,
          actor,
          actor_id,
          warehouse_id,
          before_data,
          after_data,
          meta
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `,
      [
        'vehicles',
        'bulk-import',
        'oficina',
        'import_vehicles',
        'system',
        'system',
        null,
        null,
        {
          inserted,
          updated,
          ignored: ignoredRows,
          total_after: totalAfter,
        },
        summaryMeta,
      ]
    );
    auditLogged = true;
  }
} catch (err) {
  const errorText =
    err instanceof Error ? `${err.name}: ${err.message || '(sem mensagem)'}` : String(err || '(erro desconhecido)');
  console.error('Falha ao importar frota:', errorText);
  process.exitCode = 1;
} finally {
  try {
    await client.end();
  } catch {
    // noop
  }
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}

const summary = {
  file: inputPath,
  sheet: selectedSheet,
  mode,
  batch_size: batchSize,
  dry_run: dryRun,
  source_rows: sourceRows.length,
  valid_rows: validRows,
  inserted,
  updated,
  ignored: ignoredRows,
  invalid_rows: invalidRows,
  total_before: totalBefore,
  total_after: totalAfter,
  audit_logged: auditLogged,
};

console.log(JSON.stringify(summary, null, 2));
