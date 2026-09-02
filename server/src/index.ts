import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './lib/prisma.js';

const app = createApp();

// The database lives over the network now, so prove we can reach it before
// accepting traffic — a bad URL or a paused instance should be obvious at boot
// rather than showing up as a 500 on the first submission.
try {
  await prisma.$queryRaw`SELECT 1`;
  const host = new URL(config.databaseUrl).host;
  console.log(`Database reachable at ${host}`);
} catch (err) {
  console.error('Could not reach the database. Check DATABASE_URL in server/.env.');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const server = app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port} (${config.env})`);
});

function shutdown(signal: string): void {
  console.log(`\n${signal} received, shutting down.`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
