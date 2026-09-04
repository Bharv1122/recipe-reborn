import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';

const schema = z.object({
  recipeId: z.string().min(1),
  day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  servings: z.number().int().min(1).max(100).default(1),
});

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = requireMobileUserId(request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Choose a recipe, weekday, meal, and valid serving count.' }, { status: 400 });
    const [plan, recipe] = await Promise.all([
      prisma.mealPlan.findFirst({ where: { id: params.id, userId }, select: { id: true } }),
      prisma.recipe.findFirst({ where: { id: parsed.data.recipeId, userId }, select: { id: true } }),
    ]);
    if (!plan || !recipe) return NextResponse.json({ error: 'Meal plan or recipe not found.' }, { status: 404 });
    const result = await prisma.mealPlanRecipe.createMany({
      data: { mealPlanId: plan.id, ...parsed.data },
      skipDuplicates: true,
    });
    const entry = await prisma.mealPlanRecipe.findUnique({
      where: {
        mealPlanId_recipeId_day_mealType: {
          mealPlanId: plan.id,
          recipeId: parsed.data.recipeId,
          day: parsed.data.day,
          mealType: parsed.data.mealType,
        },
      },
    });
    if (!entry) throw new Error('Meal-plan entry was not found after insertion.');
    return NextResponse.json({ entry, alreadyExists: result.count === 0 }, { status: result.count ? 201 : 200 });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Unable to add recipe to meal plan.' }, { status: 500 });
  }
}
