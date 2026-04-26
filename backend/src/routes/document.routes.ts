/**
 * Route module for document endpoints. Binds HTTP paths to controllers and required middleware.
 */
import { Router } from 'express';
import { DocumentController } from '../controllers/document.controller.js';
import { upload } from '../middlewares/upload.middleware.js';

const router = Router();
const controller = new DocumentController();

router.post('/upload', upload.single('file'), controller.upload);
router.get('/', controller.list);
router.get('/:id', controller.detail);
router.delete('/:id', controller.remove);
router.get('/:id/chunks', controller.chunks);
router.post('/:id/reprocess', controller.reprocess);

export { router as documentRouter };
