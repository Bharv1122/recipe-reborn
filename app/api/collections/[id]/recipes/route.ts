import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST /api/collections/[id]/recipes - Add recipe to collection
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { recipeId } = body;

    if (!recipeId) {
      return NextResponse.json(
        { error: 'Recipe ID is required' },
        { status: 400 }
      );
    }

    // Verify collection ownership
    const collection = await prisma.collection.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Verify recipe ownership
    const recipe = await prisma.recipe.findFirst({
      where: {
        id: recipeId,
        userId: session.user.id,
      },
    });

    if (!recipe) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      );
    }

    // Check if already in collection
    const existing = await prisma.collectionRecipe.findFirst({
      where: {
        collectionId: params.id,
        recipeId: recipeId,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Recipe already in collection' },
        { status: 400 }
      );
    }

    // Get the highest order value
    const maxOrder = await prisma.collectionRecipe.findFirst({
      where: { collectionId: params.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    // Add recipe to collection
    const collectionRecipe = await prisma.collectionRecipe.create({
      data: {
        collectionId: params.id,
        recipeId: recipeId,
        order: (maxOrder?.order ?? -1) + 1,
      },
      include: {
        recipe: true,
      },
    });

    return NextResponse.json(collectionRecipe, { status: 201 });
  } catch (error) {
    console.error('Error adding recipe to collection:', error);
    return NextResponse.json(
      { error: 'Failed to add recipe to collection' },
      { status: 500 }
    );
  }
}
