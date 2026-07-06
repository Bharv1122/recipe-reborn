import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// GET /api/recipes/public/[shareToken] - Get a publicly shared recipe
export async function GET(
  req: NextRequest,
  { params }: { params: { shareToken: string } }
) {
  try {
    const ip = getClientIp(req);
    const { success } = await rateLimit(`recipes-public:${ip}`, 30, 60);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again in a minute.' },
        { status: 429 }
      );
    }

    const { shareToken } = params;

    if (!shareToken) {
      return NextResponse.json(
        { error: 'Share token is required' },
        { status: 400 }
      );
    }

    // Find the recipe by share token. Explicit allowlist — a public link must
    // expose ONLY display fields, never the owner's private notes, userId,
    // folderId, or internal cost data.
    const recipe = await prisma.recipe.findFirst({
      where: {
        shareToken,
        isPublic: true,
      },
      select: {
        id: true,
        title: true,
        originalIngredients: true,
        freshIngredients: true,
        instructions: true,
        dietaryTags: true,
        prepTime: true,
        cookTime: true,
        servings: true,
        viewCount: true,
        user: {
          select: {
            name: true,
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
