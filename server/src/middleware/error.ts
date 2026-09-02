import { ZodError } from 'zod';
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';

/** An error carrying the HTTP status it should be reported as. */
export class HttpError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * Wrap an async route handler so thrown errors reach the error middleware.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found.' });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Some answers were not in the expected format.',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  if (isMulterLimitError(err)) {
    res.status(413).json({ error: 'A file was larger than the allowed size.' });
    return;
  }

  console.error(err);
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : 'Something went wrong on our end.';
  res.status(status).json({ error: status === 500 ? 'Something went wrong on our end.' : message });
};

function isMulterLimitError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 'LIMIT_FILE_SIZE'
  );
}
