import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const client = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 5000,
});

try {
  await client.connect();
  const result = await client.query('SELECT NOW() AS now');
  console.log(
    JSON.stringify(
      {
        ok: true,
        host: process.env.DB_HOST || null,
        database: process.env.DB_NAME || null,
        server_time: result.rows?.[0]?.now || null,
      },
      null,
      2
    )
  );
  process.exit(0);
} catch (err) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        host: process.env.DB_HOST || null,
        database: process.env.DB_NAME || null,
        error: err instanceof Error ? err.message : String(err),
      },
      null,
      2
    )
  );
  process.exit(1);
} finally {
  try {
    await client.end();
  } catch {
    // noop
  }
}
