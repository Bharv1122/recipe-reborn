import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

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

    const body = await request.json();
    const {
      title,
      originalIngredients,
      freshIngredients,
      instructions,
      dietaryTags,
      prepTime,
      cookTime,
      servings,
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