import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/recipes/public/[shareToken] - Get a publicly shared recipe
export async function GET(
  req: NextRequest,
  { params }: { params: { shareToken: string } }
) {
  try {
    const { shareToken } = params;

    if (!shareToken) {
      return NextResponse.json(
        { error: 'Share token is required' },
        { status: 400 }
      );
    }

    // Find the recipe by share token
    const recipe = await prisma.recipe.findFirst({
      where: {
        shareToken,
        isPublic: true,
      },
      include: {
        user: {
          select: {
            name: true,
            email: false,
          },
        },
      },
    });

    if (!recipe) {
      return NextResponse.json(
        { error: 'Recipe not found or not public' },
        { status: 404 }
      );
    }

    // Increment view count
    await prisma.recipe.update({
      where: { id: recipe.id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    });

    return NextResponse.json({ recipe });
  } catch (error) {
    console.error('Error fetching public recipe:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipe' },
      { status: 500 }
    );
  }
}
