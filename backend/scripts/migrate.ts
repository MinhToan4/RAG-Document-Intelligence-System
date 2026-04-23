import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { config } from 'dotenv';
import { buildPgPoolConfig } from '../src/config/pg-options.js';

const currentFile = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(currentFile);
const backendRoot = path.resolve(scriptsDir, '..');

config({ path: path.resolve(backendRoot, '.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const sqlDir = path.resolve(backendRoot, 'sql');
const pool = new Pool(
  buildPgPoolConfig({
    databaseUrl,
    dbSslEnabled: process.env.DB_SSL_ENABLED,
    dbSslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED,
  }),
);

async function ensureMigrationTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      file_name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function appliedFiles(): Promise<Set<string>> {
  const result = await pool.query<{ file_name: string }>('SELECT file_name FROM schema_migrations');
  return new Set(result.rows.map((row) => row.file_name));
}

async function run() {
  await ensureMigrationTable();

  const files = (await fs.readdir(sqlDir)).filter((file) => file.endsWith('.sql')).sort();
  const done = await appliedFiles();

  for (const file of files) {
    if (done.has(file)) {
      // eslint-disable-next-line no-console
      console.log(`skip ${file}`);
      continue;
    }

    const filePath = path.join(sqlDir, file);
    const sql = await fs.readFile(filePath, 'utf8');
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations(file_name) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      // eslint-disable-next-line no-console
      console.log(`applied ${file}`);
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  }
}

run()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await pool.end();
    process.exit(1);
  });
