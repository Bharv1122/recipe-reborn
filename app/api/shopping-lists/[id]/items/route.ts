import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// POST /api/shopping-lists/[id]/items - Add an item to a shopping list
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ingredient, quantity, unit, category, notes } = await req.json();

    if (!ingredient) {
      return NextResponse.json(
        { error: 'Ingredient is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const shoppingList = await prisma.shoppingList.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!shoppingList) {
      return NextResponse.json(
        { error: 'Shopping list not found' },
        { status: 404 }
      );
    }

    // Get max order
    const maxOrder = await prisma.shoppingListItem.findFirst({
      where: { shoppingListId: params.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const item = await prisma.shoppingListItem.create({
      data: {
        shoppingListId: params.id,
        ingredient,
        quantity,
        unit,
        category: category || 'Other',
        notes,
        order: (maxOrder?.order ?? -1) + 1,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Error adding item to shopping list:', error);
    return NextResponse.json(
      { error: 'Failed to add item to shopping list' },
      { status: 500 }
    );
  }
}