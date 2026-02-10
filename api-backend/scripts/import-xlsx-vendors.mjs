import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

const normalizeDigits = (value) => String(value ?? '').replace(/\D+/g, '');

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

const buildVendorId = (dedupeKey) => {
  const hash = crypto.createHash('sha256').update(dedupeKey).digest('hex').slice(0, 12).toUpperCase();
  return `VEN-${hash}`;
};

const inputPathArg = argMap.get('file') ? String(argMap.get('file')) : '';
const inputPath = inputPathArg ? path.resolve(inputPathArg) : path.resolve(process.cwd(), 'template_fornecedores_logiwms.xlsx');
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

const dedupedByKey = new Map();
let invalidRows = 0;

for (const row of sourceRows) {
  const name = normalizeText(resolveSheetValue(row, ['NOME', 'RAZAO SOCIAL', 'NOME FANTASIA']));
  const cnpj = normalizeDigits(resolveSheetValue(row, ['CNPJ', 'DOCUMENTO']));
  const contact = normalizeText(resolveSheetValue(row, ['CONTATO', 'RESPONSAVEL', 'EMAIL']));

  if (!name && !cnpj) {
    invalidRows += 1;
    continue;
  }

  const dedupeKey = `${cnpj}|${normalizeKey(contact)}`;
  dedupedByKey.set(dedupeKey, {
    id: buildVendorId(dedupeKey),
    name: name || contact || cnpj || 'Fornecedor sem nome',
    cnpj,
    category: null,
    contact,
    email: null,
    status: 'Ativo',
  });
}

const normalizedVendors = Array.from(dedupedByKey.values());
const validRows = normalizedVendors.length;
const ignoredRows = sourceRows.length - validRows;

if (!validRows) {
  console.error('Nao ha fornecedores validos para importar.');
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
  const columns = ['id', 'name', 'cnpj', 'category', 'contact', 'email', 'status'];
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
    INSERT INTO vendors (${columns.join(', ')})
    VALUES ${rowPlaceholders}
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      cnpj = EXCLUDED.cnpj,
      contact = EXCLUDED.contact,
      status = EXCLUDED.status,
      category = COALESCE(vendors.category, EXCLUDED.category),
      email = COALESCE(vendors.email, EXCLUDED.email)
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

  const beforeResult = await client.query('SELECT COUNT(*)::int AS total FROM vendors');
  totalBefore = Number(beforeResult.rows?.[0]?.total || 0);

  const batches = chunk(normalizedVendors, batchSize);
  for (const batchRows of batches) {
    const ids = batchRows.map((row) => row.id);
    const existingResult = await client.query(
      'SELECT id FROM vendors WHERE id = ANY($1::text[])',
      [ids]
    );
    const existingIds = new Set(existingResult.rows.map((row) => row.id));

    for (const row of batchRows) {
      if (existingIds.has(row.id)) updated += 1;
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

  totalAfter = dryRun ? totalBefore + inserted : Number((await client.query('SELECT COUNT(*)::int AS total FROM vendors')).rows?.[0]?.total || 0);

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
        'vendors',
        'bulk-import',
        'cadastro',
        'import_vendors',
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
  console.error('Falha ao importar fornecedores:', errorText);
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
