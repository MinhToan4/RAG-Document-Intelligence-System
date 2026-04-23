type Level = 'info' | 'warn' | 'error';

function log(level: Level, message: string, meta?: unknown): void {
  const timestamp = new Date().toISOString();
  if (meta !== undefined) {
    // eslint-disable-next-line no-console
    console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`, meta);
    return;
  }
  // eslint-disable-next-line no-console
  console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`);
}

export const logger = {
  info: (message: string, meta?: unknown) => log('info', message, meta),
  warn: (message: string, meta?: unknown) => log('warn', message, meta),
  error: (message: string, meta?: unknown) => log('error', message, meta),
};
