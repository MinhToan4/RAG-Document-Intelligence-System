/**
 * Route module for conversation endpoints. Binds HTTP paths to controllers and required middleware.
 */
import { Router } from 'express';
import { ConversationController } from '../controllers/conversation.controller.js';

const router = Router();
const controller = new ConversationController();

router.get('/', controller.list);
router.get('/:id/messages', controller.listMessages);
router.delete('/:id', controller.delete);

export { router as conversationRouter };

