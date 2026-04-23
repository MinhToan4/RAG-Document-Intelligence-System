import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { notFoundMiddleware } from './middlewares/not-found.middleware.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    }),
  );
  app.use(helmet());
  app.use(morgan('dev'));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/', (_req, res) => {
    res.json({
      name: 'RAG Document Intelligence API',
      version: '1.0.0',
      docs: '/api/health',
    });
  });

  app.use('/api', apiRouter);
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
