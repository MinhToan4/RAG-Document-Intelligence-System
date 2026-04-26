/**
 * Express middleware for upload concerns in the API request/response pipeline.
 */
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { normalizeUploadedFilename } from '../utils/filename.js';

const uploadDir = path.resolve(process.cwd(), 'backend/uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    cb(null, uploadDir);
  },
  filename: (_, file, cb) => {
    const normalizedOriginalName = normalizeUploadedFilename(file.originalname);
    file.originalname = normalizedOriginalName;
    const ext = path.extname(normalizedOriginalName);
    const safeBase = path.basename(normalizedOriginalName, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    const suffix = crypto.randomBytes(6).toString('hex');
    cb(null, `${Date.now()}_${safeBase}_${suffix}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
  },
  fileFilter: (_, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error('Unsupported file type. Only PDF, DOCX, TXT are allowed.'));
      return;
    }
    cb(null, true);
  },
});
