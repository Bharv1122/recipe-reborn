import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  weekStartDate: z.string().datetime(),
  description: z.string().trim().max(1000).optional(),
});

const recipeSelect = {
  id: true, title: true, prepTime: true, cookTime: true, servings: true,
  dietaryTags: true, calories: true, protein: true, carbs: true, fat: true,
} as const;

export async function GET(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    const mealPlans = await prisma.mealPlan.findMany({
      where: { userId },
      include: { mealPlanRecipes: { include: { recipe: { select: recipeSelect } }, orderBy: [{ day: 'asc' }, { order: 'asc' }] } },
      orderBy: { weekStartDate: 'desc' },
    });
    return NextResponse.json({ mealPlans });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Unable to load meal plans.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Name and a valid week start are required.' }, { status: 400 });
    const mealPlan = await prisma.mealPlan.create({
      data: { userId, name: parsed.data.name, weekStartDate: new Date(parsed.data.weekStartDate), description: parsed.data.description || null },
      include: { mealPlanRecipes: true },
    });
    return NextResponse.json({ mealPlan }, { status: 201 });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Unable to create meal plan.' }, { status: 500 });
  }
}
