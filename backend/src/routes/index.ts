import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { authRouter } from './auth.routes.js';
import { documentRouter } from './document.routes.js';
import { queryRouter } from './query.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRouter);
router.use('/documents', authMiddleware, documentRouter);
router.use('/query', authMiddleware, queryRouter);

export { router as apiRouter };
