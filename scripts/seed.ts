import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Check if test user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: 'john@doe.com' },
  });

  if (existingUser) {
    console.log('Test user already exists');
    return;
  }

  // Create test user
  const hashedPassword = await bcrypt.hash('johndoe123', 12);
  const user = await prisma.user.create({
    data: {
      email: 'john@doe.com',
      password: hashedPassword,
    },
  });

  console.log('Test user created:', user.email);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });