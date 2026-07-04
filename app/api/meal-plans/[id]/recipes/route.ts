import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// POST /api/meal-plans/[id]/recipes - Add a recipe to a meal plan
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recipeId, day, mealType, servings, notes } = await req.json();

    if (!recipeId || !day || !mealType) {
      return NextResponse.json(
        { error: 'Recipe ID, day, and meal type are required' },
        { status: 400 }
      );
    }

    // Verify ownership of meal plan
    const mealPlan = await prisma.mealPlan.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!mealPlan) {
      return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 });
    }

    // Verify ownership of recipe
    const recipe = await prisma.recipe.findFirst({
      where: {
        id: recipeId,
        userId: session.user.id,
      },
    });

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Get the current max order for this day/mealType
    const maxOrder = await prisma.mealPlanRecipe.findFirst({
      where: {
        mealPlanId: params.id,
        day,
        mealType,
      },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const mealPlanRecipe = await prisma.mealPlanRecipe.create({
      data: {
        mealPlanId: params.id,
        recipeId,
        day: day.toLowerCase(),
        mealType: mealType.toLowerCase(),
        servings: servings || 1,
        notes,
        order: (maxOrder?.order ?? -1) + 1,
      },
      include: {
        recipe: true,
      },
    });

    return NextResponse.json(mealPlanRecipe, { status: 201 });
  } catch (error) {
    console.error('Error adding recipe to meal plan:', error);
    return NextResponse.json(
      { error: 'Failed to add recipe to meal plan' },
      { status: 500 }
    );
  }
}