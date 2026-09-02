import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';

/** The admin fields safe to put in a token or hand back to the client. */
export interface AdminSummary {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
}

export function signToken(user: AdminSummary): string {
  const options: SignOptions = {
    // Read from the environment as a string ("7d", "24h", ...); jsonwebtoken's
    // types want its own template literal, so narrow to the option's own type.
    expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, config.jwt.secret, options);
}

/**
 * Requires a valid Bearer token and loads the admin onto req.admin.
 */
export const requireAdmin: RequestHandler = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      res.status(401).json({ error: 'Not signed in.' });
      return;
    }

    const payload = jwt.verify(token, config.jwt.secret) as TokenPayload;
    const admin = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
    if (!admin) {
      res.status(401).json({ error: 'Session no longer valid.' });
      return;
    }

    req.admin = { id: admin.id, email: admin.email, name: admin.name, role: admin.role };
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Sign in again.' });
  }
};
