import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import pg from 'pg';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationPath = process.env.DB_MIGRATION_FILE
  ? path.resolve(process.env.DB_MIGRATION_FILE)
  : path.resolve(__dirname, '..', '..', 'migration.sql');

if (!fs.existsSync(migrationPath)) {
  console.error(`Arquivo de migracao nao encontrado: ${migrationPath}`);
  process.exit(1);
}

const rawSql = fs.readFileSync(migrationPath, 'utf8');
const sanitizedSql = rawSql
  .replace(/^\uFEFF/, '')
  .split(/\r?\n/)
  .filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (trimmed.startsWith('\\')) return false;
    return true;
  })
  .join('\n');

const client = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 10000,
});

try {
  console.log(`Aplicando migration em: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  await client.connect();
  await client.query(sanitizedSql);
  console.log('Migration aplicada com sucesso.');
  process.exit(0);
} catch (err) {
  console.error('Falha ao aplicar migration.');
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
} finally {
  try {
    await client.end();
  } catch {
    // noop
  }
}
