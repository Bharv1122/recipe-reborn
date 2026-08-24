import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

const saveSchema = z.object({
  title: z.string().trim().min(1).max(200),
  originalIngredients: z.string().trim().min(1).max(50000),
  freshIngredients: z.array(z.string().trim().min(1).max(500)).min(1).max(150),
  instructions: z.array(z.string().trim().min(1).max(3000)).min(1).max(100),
  dietaryTags: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  prepTime: z.string().trim().max(80).optional(),
  cookTime: z.string().trim().max(80).optional(),
  servings: z.string().trim().max(40).optional(),
  estimatedCostPerServing: z.number().nonnegative().finite().optional(),
  storeBoughtCost: z.number().nonnegative().finite().optional(),
});

export async function GET(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    const recipes = await prisma.recipe.findMany({
      where: { userId },
      select: {
        id: true, title: true, dietaryTags: true, prepTime: true, cookTime: true,
        servings: true, rating: true, calories: true, createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ recipes });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Mobile recipes error:', error);
    return NextResponse.json({ error: 'Unable to load recipes.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    const parsed = saveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Recipe details are incomplete.' }, { status: 400 });
    const recipe = await prisma.recipe.create({
      data: {
        userId,
        ...parsed.data,
        freshIngredients: JSON.stringify(parsed.data.freshIngredients),
        instructions: JSON.stringify(parsed.data.instructions),
        prepTime: parsed.data.prepTime || null,
        cookTime: parsed.data.cookTime || null,
        servings: parsed.data.servings || null,
      },
    });
    return NextResponse.json({ recipe }, { status: 201 });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Mobile save recipe error:', error);
    return NextResponse.json({ error: 'Unable to save recipe.' }, { status: 500 });
  }
}
