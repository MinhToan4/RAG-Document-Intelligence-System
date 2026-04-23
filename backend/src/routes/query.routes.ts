import { Router } from 'express';
import { QueryController } from '../controllers/query.controller.js';

const router = Router();
const controller = new QueryController();

router.post('/', controller.ask);
router.post('/stream', controller.stream);
router.get('/history', controller.history);
router.delete('/history/:id', controller.deleteHistory);

export { router as queryRouter };
