import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = requireMobileUserId(request);
    const parsed = z.object({ recipeId: z.string().min(1) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'A recipe is required.' }, { status: 400 });
    const [collection, recipe] = await Promise.all([
      prisma.collection.findFirst({ where: { id: params.id, userId }, select: { id: true } }),
      prisma.recipe.findFirst({ where: { id: parsed.data.recipeId, userId }, select: { id: true } }),
    ]);
    if (!collection || !recipe) return NextResponse.json({ error: 'Collection or recipe not found.' }, { status: 404 });
    const max = await prisma.collectionRecipe.findFirst({ where: { collectionId: params.id }, orderBy: { order: 'desc' }, select: { order: true } });
    const entry = await prisma.collectionRecipe.upsert({
      where: { collectionId_recipeId: { collectionId: params.id, recipeId: recipe.id } },
      create: { collectionId: params.id, recipeId: recipe.id, order: (max?.order ?? -1) + 1 },
      update: {},
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Unable to add recipe to collection.' }, { status: 500 });
  }
}
