import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { loginSchema } from '../lib/validation.js';
import { signToken, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait a few minutes.' },
});

/**
 * POST /api/auth/login
 */
router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const admin = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });

    // Compare against a dummy hash when the user is unknown to blunt timing hints.
    const hash = admin?.passwordHash || '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidin';
    const ok = await bcrypt.compare(password, hash);

    if (!admin || !ok) {
      res.status(401).json({ error: 'Email or password is incorrect.' });
      return;
    }

    const token = signToken(admin);
    res.json({
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    });
  }),
);

/**
 * GET /api/auth/me
 */
router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

export default router;
