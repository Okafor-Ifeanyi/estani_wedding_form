import { Router } from 'express';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { statusSchema, noteSchema, SUBMISSION_STATUSES } from '../lib/validation.js';
import type { SubmissionStatusValue } from '../lib/validation.js';
import { buildBrief } from '../lib/submission.js';
import { routeParam } from '../lib/params.js';
import { uploadRoot } from '../lib/upload.js';

const router = Router();

// Everything below requires a signed-in admin.
router.use(requireAdmin);

/** Read a query parameter that may arrive repeated or nested. */
function queryString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStatus(value: string): SubmissionStatusValue | null {
  return (SUBMISSION_STATUSES as readonly string[]).includes(value)
    ? (value as SubmissionStatusValue)
    : null;
}

/**
 * GET /api/admin/submissions
 * Query: status, q (search), page, pageSize
 * Returns a paginated list for the dashboard.
 */
router.get(
  '/submissions',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const status = asStatus(queryString(req.query.status));
    const q = queryString(req.query.q).trim();

    const where: Prisma.SubmissionWhereInput = {};
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { contactName: { contains: q, mode: 'insensitive' } },
        { contactEmail: { contains: q, mode: 'insensitive' } },
        { brideName: { contains: q, mode: 'insensitive' } },
        { groomName: { contains: q, mode: 'insensitive' } },
        { domain: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, rows, statusCounts] = await Promise.all([
      prisma.submission.count({ where }),
      prisma.submission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          status: true,
          contactName: true,
          contactEmail: true,
          brideName: true,
          groomName: true,
          weddingDate: true,
          domain: true,
          answered: true,
          total: true,
          _count: { select: { notes: true, files: true } },
        },
      }),
      prisma.submission.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    res.json({
      rows,
      page,
      pageSize,
      total,
      pages: Math.ceil(total / pageSize),
      statusCounts: statusCounts.reduce<Record<string, number>>(
        (acc, s) => ({ ...acc, [s.status]: s._count._all }),
        {},
      ),
    });
  }),
);

/**
 * GET /api/admin/submissions/:id
 * Full detail including answers, notes and files.
 */
router.get(
  '/submissions/:id',
  asyncHandler(async (req, res) => {
    const id = routeParam(req, 'id');
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        notes: { orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true } } } },
        files: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!submission) {
      res.status(404).json({ error: 'Submission not found.' });
      return;
    }
    res.json({ submission });
  }),
);

/**
 * PATCH /api/admin/submissions/:id
 * Update the follow-up status.
 */
router.patch(
  '/submissions/:id',
  asyncHandler(async (req, res) => {
    const id = routeParam(req, 'id');
    const { status } = statusSchema.parse(req.body);
    try {
      const submission = await prisma.submission.update({
        where: { id },
        data: { status },
        select: { id: true, status: true },
      });
      res.json({ submission });
    } catch {
      res.status(404).json({ error: 'Submission not found.' });
    }
  }),
);

/**
 * POST /api/admin/submissions/:id/notes
 * Add a follow-up note.
 */
router.post(
  '/submissions/:id/notes',
  asyncHandler(async (req, res) => {
    const id = routeParam(req, 'id');
    const { body } = noteSchema.parse(req.body);
    const admin = req.admin;
    if (!admin) throw new HttpError('Not signed in.', 401);

    const exists = await prisma.submission.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      res.status(404).json({ error: 'Submission not found.' });
      return;
    }

    const note = await prisma.followUpNote.create({
      data: { body, submissionId: id, authorId: admin.id },
      include: { author: { select: { name: true } } },
    });
    res.status(201).json({ note });
  }),
);

/**
 * GET /api/admin/submissions/:id/brief
 * Download the human-readable brief as text.
 */
router.get(
  '/submissions/:id/brief',
  asyncHandler(async (req, res) => {
    const id = routeParam(req, 'id');
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { files: true },
    });
    if (!submission) {
      res.status(404).json({ error: 'Submission not found.' });
      return;
    }

    const brief = buildBrief(submission);
    const slug = (submission.brideName || 'wedding').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="brief-${slug}.txt"`);
    res.send(brief);
  }),
);

/**
 * GET /api/admin/files/:id
 * Stream a stored media file back to the admin.
 */
router.get(
  '/files/:id',
  asyncHandler(async (req, res) => {
    const file = await prisma.mediaFile.findUnique({ where: { id: routeParam(req, 'id') } });
    if (!file) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.originalName.replace(/"/g, '')}"`);
    res.sendFile(path.join(uploadRoot, file.storedName));
  }),
);

export default router;
