import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// DELETE /api/collections/[id]/recipes/[recipeId] - Remove recipe from collection
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; recipeId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Find and delete the CollectionRecipe entry
    const collectionRecipe = await prisma.collectionRecipe.findFirst({
      where: {
        collectionId: params.id,
        recipeId: params.recipeId,
      },
    });

    if (!collectionRecipe) {
      return NextResponse.json(
        { error: 'Recipe not found in collection' },
        { status: 404 }
      );
    }

    await prisma.collectionRecipe.delete({
      where: { id: collectionRecipe.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing recipe from collection:', error);
    return NextResponse.json(
      { error: 'Failed to remove recipe from collection' },
      { status: 500 }
    );
  }
}
