import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestUserId } from '@/lib/request-auth';
import { removeFromLibraryUpdate } from '@/lib/recipe-library';

const requestSchema = z.object({
  recipeIds: z.array(z.string().min(1).max(100)).min(1).max(200),
  action: z.literal('remove'),
});

export async function PATCH(request: Request) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose at least one saved recipe.' }, { status: 400 });
  const result = await prisma.recipe.updateMany({
    where: { id: { in: [...new Set(parsed.data.recipeIds)] }, userId, savedAt: { not: null } },
    data: removeFromLibraryUpdate(),
  });
  return NextResponse.json({ removed: result.count });
}
