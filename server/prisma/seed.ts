import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@yourstudio.com').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'changeme123';
  const name = process.env.SEED_ADMIN_NAME || 'Studio Admin';

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: { name },
    create: { email, name, passwordHash, role: 'OWNER' },
  });

  console.log(`Seeded admin: ${admin.email}`);
  console.log('You can sign in at /admin/login with the SEED_ADMIN_* credentials from .env');
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
