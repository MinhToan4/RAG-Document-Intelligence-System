import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';

const router = Router();
const controller = new AuthController();

import { authMiddleware } from '../middlewares/auth.middleware.js';

router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/refresh', controller.refresh);
router.post('/introspect', controller.introspect);
router.put('/profile', authMiddleware, controller.updateProfile);

export { router as authRouter };
