// Declaration merging: `requireAdmin` attaches the signed-in admin to the
// request, and every route below it reads `req.admin`.
import type { AdminSummary } from '../middleware/auth.js';

declare global {
  namespace Express {
    interface Request {
      admin?: AdminSummary;
    }
  }
}

export {};
