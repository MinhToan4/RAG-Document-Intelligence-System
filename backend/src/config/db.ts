import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import { env } from './env.js';
import { buildPgPoolConfig } from './pg-options.js';

export const pool = new Pool(
  buildPgPoolConfig({
    databaseUrl: env.DATABASE_URL,
    dbSslEnabled: env.DB_SSL_ENABLED,
    dbSslRejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED,
    max: 10,
  }),
);

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function assertDatabaseConnection(): Promise<void> {
  await query('SELECT 1');
}
