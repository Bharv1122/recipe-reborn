import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// DELETE /api/meal-plans/[id]/recipes/[recipeId] - Remove a recipe from a meal plan
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; recipeId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Delete the entry — scoped to THIS meal plan so a valid owner can't
    // target another user's MealPlanRecipe by passing its (global) id
    const { count } = await prisma.mealPlanRecipe.deleteMany({
      where: {
        id: params.recipeId,
        mealPlanId: params.id,
      },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: 'Meal plan recipe not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing recipe from meal plan:', error);
    return NextResponse.json(
      { error: 'Failed to remove recipe from meal plan' },
      { status: 500 }
    );
  }
}

// PATCH /api/meal-plans/[id]/recipes/[recipeId] - Update a meal plan recipe
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; recipeId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { day, mealType, servings, notes } = await req.json();

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

    const updateData: any = {};
    if (day !== undefined) updateData.day = day.toLowerCase();
    if (mealType !== undefined) updateData.mealType = mealType.toLowerCase();
    if (servings !== undefined) updateData.servings = servings;
    if (notes !== undefined) updateData.notes = notes;

    // Scope the update to THIS meal plan so a valid owner can't edit another
    // user's MealPlanRecipe by passing its (global) id
    const { count } = await prisma.mealPlanRecipe.updateMany({
      where: {
        id: params.recipeId,
        mealPlanId: params.id,
      },
      data: updateData,
    });

    if (count === 0) {
      return NextResponse.json(
        { error: 'Meal plan recipe not found' },
        { status: 404 }
      );
    }

    const mealPlanRecipe = await prisma.mealPlanRecipe.findUnique({
      where: { id: params.recipeId },
      include: {
        recipe: true,
      },
    });

    return NextResponse.json(mealPlanRecipe);
  } catch (error) {
    console.error('Error updating meal plan recipe:', error);
    return NextResponse.json(
      { error: 'Failed to update meal plan recipe' },
      { status: 500 }
    );
  }
}