import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { recipeComparisonSchema } from '@/lib/recipe-comparison-validation';

export const dynamic = 'force-dynamic';

// Get all recipes for the logged-in user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const recipes = await prisma.recipe.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ recipes }, { status: 200 });
  } catch (error) {
    console.error('Get recipes error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipes' },
      { status: 500 }
    );
  }
}

// Save a new recipe
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid recipe details' }, { status: 400 });
    }
    const comparison = recipeComparisonSchema.optional().safeParse(body.comparisonSnapshot);
    if (!comparison.success) {
      return NextResponse.json({ error: 'Invalid recipe comparison details' }, { status: 400 });
    }
    const nutrition = comparison.data?.freshNutrition;
    const {
      title,
      originalIngredients,
      freshIngredients,
      instructions,
      dietaryTags,
      prepTime,
      cookTime,
      servings,
      estimatedCostPerServing,
      storeBoughtCost,
    } = body;

    if (!title || !originalIngredients || !freshIngredients || !instructions) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const recipe = await prisma.recipe.create({
      data: {
        userId: session.user.id,
        title,
        originalIngredients,
        freshIngredients: JSON.stringify(freshIngredients),
        instructions: JSON.stringify(instructions),
        dietaryTags: dietaryTags ?? [],
        prepTime,
        cookTime,
        servings,
        ...(comparison.data && { comparisonSnapshot: comparison.data }),
        ...(nutrition && {
          calories: nutrition.calories === null ? null : Math.round(nutrition.calories),
          protein: nutrition.protein,
          carbs: nutrition.carbs,
          fat: nutrition.fat,
          fiber: nutrition.fiber,
          sodium: nutrition.sodium === null ? null : Math.round(nutrition.sodium),
        }),
        estimatedCostPerServing:
          typeof estimatedCostPerServing === 'number' && isFinite(estimatedCostPerServing)
            ? estimatedCostPerServing
            : null,
        storeBoughtCost:
          typeof storeBoughtCost === 'number' && isFinite(storeBoughtCost)
            ? storeBoughtCost
            : null,
      },
    });

    return NextResponse.json(
      { message: 'Recipe saved successfully', recipe },
      { status: 201 }
    );
  } catch (error) {
    console.error('Save recipe error:', error);
    return NextResponse.json(
      { error: 'Failed to save recipe' },
      { status: 500 }
    );
  }
}
