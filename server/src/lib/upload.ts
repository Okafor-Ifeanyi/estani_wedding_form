import multer from 'multer';
import type { FileFilterCallback } from 'multer';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config.js';
import { HttpError } from '../middleware/error.js';

const uploadRoot = path.resolve(config.uploads.dir);
fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 12);
    cb(null, `${randomUUID()}${ext}`);
  },
});

// Accept only images and audio — the two media types the form asks for.
function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  const ok = /^image\//.test(file.mimetype) || /^audio\//.test(file.mimetype);
  if (ok) {
    cb(null, true);
    return;
  }
  cb(new HttpError('Unsupported file type.', 415));
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.uploads.maxBytes, files: 20 },
});

export { uploadRoot };
