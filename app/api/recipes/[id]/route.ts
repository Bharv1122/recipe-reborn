import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const recipeUpdateSchema = z.object({
  rating: z.number().int().min(0).max(5).optional(),
  notes: z.string().max(10000).nullable().optional(),
  folderId: z.string().min(1).nullable().optional(),
  winePairing: z.string().max(50000).nullable().optional(),
  freshIngredients: z.string().max(50000).optional().refine((value) => {
    if (value === undefined) return true;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string');
    } catch {
      return false;
    }
  }, 'Fresh ingredients must be a JSON array of strings'),
});

// Get a single recipe
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const recipe = await prisma.recipe.findFirst({
      where: {
        id: params?.id,
        userId: session.user.id,
      },
    });

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    return NextResponse.json({ recipe }, { status: 200 });
  } catch (error) {
    console.error('Get recipe error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipe' },
      { status: 500 }
    );
  }
}

// Update a recipe (rating and notes)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const recipe = await prisma.recipe.findFirst({
      where: {
        id: params?.id,
        userId: session.user.id,
      },
    });

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    const update = recipeUpdateSchema.safeParse(await request.json());
    if (!update.success) {
      return NextResponse.json(
        { error: 'Invalid recipe update', details: update.error.flatten() },
        { status: 400 }
      );
    }

    const { rating, notes, folderId, winePairing, freshIngredients } = update.data;

    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, userId: session.user.id },
        select: { id: true },
      });
      if (!folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      }
    }

    const updatedRecipe = await prisma.recipe.update({
      where: { id: params?.id },
      data: {
        ...(rating !== undefined && { rating }),
        ...(notes !== undefined && { notes }),
        ...(folderId !== undefined && { folderId }),
        ...(winePairing !== undefined && { winePairing }),
        ...(freshIngredients !== undefined && { freshIngredients }),
      },
    });

    return NextResponse.json({ recipe: updatedRecipe }, { status: 200 });
  } catch (error) {
    console.error('Update recipe error:', error);
    return NextResponse.json(
      { error: 'Failed to update recipe' },
      { status: 500 }
    );
  }
}

// Delete a recipe
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const recipe = await prisma.recipe.findFirst({
      where: {
        id: params?.id,
        userId: session.user.id,
      },
    });

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    await prisma.recipe.delete({
      where: {
        id: params?.id,
      },
    });

    return NextResponse.json(
      { message: 'Recipe deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete recipe error:', error);
    return NextResponse.json(
      { error: 'Failed to delete recipe' },
      { status: 500 }
    );
  }
}
