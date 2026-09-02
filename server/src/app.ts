import express from 'express';
import type { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config, isProd } from './config.js';
import { prisma } from './lib/prisma.js';
import { notFound, errorHandler } from './middleware/error.js';
import submissionsRoute from './routes/submissions.js';
import authRoute from './routes/auth.js';
import adminRoute from './routes/admin.js';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(isProd ? 'combined' : 'dev'));

  // Health includes a real database round-trip: with a hosted database, "the
  // process is up" and "the app can serve requests" are no longer the same thing.
  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, uptime: process.uptime(), database: 'up' });
    } catch {
      res.status(503).json({ ok: false, uptime: process.uptime(), database: 'down' });
    }
  });

  app.use('/api/submissions', submissionsRoute);
  app.use('/api/auth', authRoute);
  app.use('/api/admin', adminRoute);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
