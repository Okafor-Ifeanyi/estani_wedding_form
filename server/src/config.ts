import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export interface Config {
  env: string;
  databaseUrl: string;
  directDatabaseUrl: string;
  port: number;
  corsOrigins: string[];
  jwt: { secret: string; expiresIn: string };
  uploads: { dir: string; maxBytes: number };
}

export const config: Config = {
  env: process.env.NODE_ENV || 'development',
  // Prisma reads DATABASE_URL / DIRECT_DATABASE_URL itself; we only assert they
  // are present so a missing value fails at boot with a clear message rather
  // than on the first query. `directUrl` is required by prisma/schema.prisma.
  databaseUrl: required('DATABASE_URL'),
  directDatabaseUrl: required('DIRECT_DATABASE_URL'),
  port: Number(process.env.PORT || 4000),
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  jwt: {
    secret: required('JWT_SECRET', 'dev-only-insecure-secret'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  uploads: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxBytes: Number(process.env.MAX_UPLOAD_MB || 25) * 1024 * 1024,
  },
};

export const isProd = config.env === 'production';
