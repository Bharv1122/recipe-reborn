import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/collections/public/[shareToken] - Get public collection by share token
export async function GET(
  req: NextRequest,
  { params }: { params: { shareToken: string } }
) {
  try {
    const collection = await prisma.collection.findFirst({
      where: {
        shareToken: params.shareToken,
        isPublic: true,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
        collectionRecipes: {
          include: {
            recipe: {
              select: {
                id: true,
                title: true,
                freshIngredients: true,
                instructions: true,
                dietaryTags: true,
                prepTime: true,
                cookTime: true,
                servings: true,
                rating: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found or not public' },
        { status: 404 }
      );
    }

    // Increment view count
    await prisma.collection.update({
      where: { id: collection.id },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json(collection);
  } catch (error) {
    console.error('Error fetching public collection:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collection' },
      { status: 500 }
    );
  }
}
