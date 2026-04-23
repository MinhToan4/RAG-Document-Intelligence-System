import { Router } from 'express';
import { ConversationController } from '../controllers/conversation.controller.js';

const router = Router();
const controller = new ConversationController();

router.get('/', controller.list);
router.get('/:id/messages', controller.listMessages);
router.delete('/:id', controller.delete);

export { router as conversationRouter };

