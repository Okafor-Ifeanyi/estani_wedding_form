import { PrismaClient } from '@prisma/client';

// A single shared client for the process. `tsx watch` can re-import modules, so
// we cache on globalThis to avoid exhausting the connection pool in dev.
const globalForPrisma = globalThis as typeof globalThis & { __prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}
