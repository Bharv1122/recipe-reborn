import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// POST /api/recipes/share/[id] - Generate or toggle share link for a recipe
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Verify recipe ownership
    const recipe = await prisma.recipe.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!recipe) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { isPublic } = body;

    // Generate a share token if making public and no token exists
    let shareToken = recipe.shareToken;
    if (isPublic && !shareToken) {
      shareToken = crypto.randomBytes(16).toString('hex');
    }

    // Update the recipe
    const updatedRecipe = await prisma.recipe.update({
      where: { id },
      data: {
        isPublic,
        shareToken: isPublic ? shareToken : null,
      },
    });

    return NextResponse.json({
      recipe: updatedRecipe,
      shareUrl: isPublic && shareToken ? `/share/${shareToken}` : null,
    });
  } catch (error) {
    console.error('Error toggling recipe sharing:', error);
    return NextResponse.json(
      { error: 'Failed to update recipe sharing' },
      { status: 500 }
    );
  }
}
