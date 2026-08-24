import { prisma } from '@/lib/db';

const CANCELLATION_TTL_MS = 2 * 60 * 1000;

export async function markGenerationCanceled(userId: string, generationId: string) {
  const now = new Date();

  await prisma.$transaction([
    prisma.generationCancellation.deleteMany({
      where: { expiresAt: { lte: now } },
    }),
    prisma.generationCancellation.upsert({
      where: { userId_generationId: { userId, generationId } },
      create: {
        userId,
        generationId,
        expiresAt: new Date(now.getTime() + CANCELLATION_TTL_MS),
      },
      update: {
        expiresAt: new Date(now.getTime() + CANCELLATION_TTL_MS),
      },
    }),
  ]);
}

export async function wasGenerationCanceled(userId: string, generationId: string) {
  const marker = await prisma.generationCancellation.findUnique({
    where: { userId_generationId: { userId, generationId } },
    select: { expiresAt: true },
  });

  return Boolean(marker && marker.expiresAt > new Date());
}

export async function clearGenerationCancellation(userId: string, generationId: string) {
  await prisma.generationCancellation.deleteMany({
    where: { userId, generationId },
  });
}
