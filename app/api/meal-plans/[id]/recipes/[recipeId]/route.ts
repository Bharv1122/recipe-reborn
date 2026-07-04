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

    // Delete the meal plan recipe entry
    await prisma.mealPlanRecipe.delete({
      where: {
        id: params.recipeId,
      },
    });

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

    const mealPlanRecipe = await prisma.mealPlanRecipe.update({
      where: { id: params.recipeId },
      data: updateData,
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