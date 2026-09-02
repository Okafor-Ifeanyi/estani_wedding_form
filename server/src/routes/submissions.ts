import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { submissionSchema } from '../lib/validation.js';
import { countAnswered, promotedColumns } from '../lib/submission.js';
import { upload } from '../lib/upload.js';
import { asyncHandler } from '../middleware/error.js';
import { routeParam } from '../lib/params.js';

const router = Router();

// Guard the public endpoint against abuse: a handful of submissions per IP.
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions from this address. Please try again shortly.' },
});

/**
 * POST /api/submissions
 * Public. Creates a submission from the intake form's answers.
 * Media files are uploaded separately to keep this endpoint JSON-only.
 */
router.post(
  '/',
  submitLimiter,
  asyncHandler(async (req, res) => {
    const { data } = submissionSchema.parse(req.body);
    const { answered, total } = countAnswered(data);

    const submission = await prisma.submission.create({
      data: {
        data,
        answered,
        total,
        ...promotedColumns(data),
      },
      select: { id: true, createdAt: true },
    });

    res.status(201).json({ id: submission.id, createdAt: submission.createdAt });
  }),
);

/**
 * POST /api/submissions/:id/files
 * Public. Attaches uploaded media to an existing submission. Field name of each
 * file part should match the form input (photo_hero, photo_gallery, ...).
 */
router.post(
  '/:id/files',
  submitLimiter,
  upload.any(),
  asyncHandler(async (req, res) => {
    const submission = await prisma.submission.findUnique({
      where: { id: routeParam(req, 'id') },
    });
    if (!submission) {
      res.status(404).json({ error: 'Submission not found.' });
      return;
    }

    // `upload.any()` fills req.files with an array; the typing covers the
    // `.fields()` object form too, so narrow before mapping.
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length) {
      await prisma.mediaFile.createMany({
        data: files.map((f) => ({
          submissionId: submission.id,
          field: f.fieldname,
          originalName: f.originalname,
          storedName: f.filename,
          mimeType: f.mimetype,
          size: f.size,
        })),
      });
    }

    res.status(201).json({ attached: files.length });
  }),
);

export default router;
