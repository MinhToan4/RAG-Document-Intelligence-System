import type { PoolConfig } from 'pg';

type DbSslConfigInput = {
  databaseUrl: string;
  dbSslEnabled?: string;
  dbSslRejectUnauthorized?: string;
  max?: number;
};

function isLocalPostgresHost(databaseUrl: string): boolean {
  try {
    const url = new URL(databaseUrl);
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

function parseBooleanFlag(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value === 'true';
}

export function buildPgPoolConfig(input: DbSslConfigInput): PoolConfig {
  const sslEnabled =
    parseBooleanFlag(input.dbSslEnabled) ?? !isLocalPostgresHost(input.databaseUrl);
  const rejectUnauthorized = parseBooleanFlag(input.dbSslRejectUnauthorized) ?? true;

  return {
    connectionString: input.databaseUrl,
    max: input.max ?? 10,
    ssl: sslEnabled ? { rejectUnauthorized } : undefined,
  };
}
