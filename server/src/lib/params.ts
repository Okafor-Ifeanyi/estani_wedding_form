import type { Request } from 'express';
import { HttpError } from '../middleware/error.js';

/**
 * Read a required route parameter.
 *
 * Express only runs a handler when the path matched, so `:id` is always
 * present — but it is typed as optional. This makes that guarantee explicit
 * instead of asserting it away, and turns a route/handler mismatch into a
 * clear 400 rather than a query with `undefined` in the where clause.
 */
export function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value === '') {
    throw new HttpError(`Missing route parameter: ${name}`, 400);
  }
  return value;
}
