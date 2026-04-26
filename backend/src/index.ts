/**
 * Backend process entry point that boots the HTTP server and startup lifecycle.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';
import { assertDatabaseConnection, pool } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  const uploadDir = path.resolve(process.cwd(), 'backend/uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  await assertDatabaseConnection();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Backend API is running at http://localhost:${env.PORT}`);
  });

  const shutdown = async () => {
    logger.info('Shutting down server...');
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
