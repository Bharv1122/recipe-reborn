import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// PATCH /api/shopping-lists/[id]/items/[itemId] - Update a shopping list item
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { checked, ingredient, quantity, unit, category, notes } = await req.json();

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

    const updateData: any = {};
    if (checked !== undefined) updateData.checked = checked;
    if (ingredient !== undefined) updateData.ingredient = ingredient;
    if (quantity !== undefined) updateData.quantity = quantity;
    if (unit !== undefined) updateData.unit = unit;
    if (category !== undefined) updateData.category = category;
    if (notes !== undefined) updateData.notes = notes;

    // Scope the update to THIS list so a valid owner can't edit another
    // user's ShoppingListItem by passing its (global) id
    const { count } = await prisma.shoppingListItem.updateMany({
      where: {
        id: params.itemId,
        shoppingListId: params.id,
      },
      data: updateData,
    });

    if (count === 0) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    const item = await prisma.shoppingListItem.findUnique({
      where: { id: params.itemId },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error('Error updating shopping list item:', error);
    return NextResponse.json(
      { error: 'Failed to update shopping list item' },
      { status: 500 }
    );
  }
}

// DELETE /api/shopping-lists/[id]/items/[itemId] - Delete a shopping list item
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Scope the delete to THIS list so a valid owner can't delete another
    // user's ShoppingListItem by passing its (global) id
    const { count } = await prisma.shoppingListItem.deleteMany({
      where: {
        id: params.itemId,
        shoppingListId: params.id,
      },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting shopping list item:', error);
    return NextResponse.json(
      { error: 'Failed to delete shopping list item' },
      { status: 500 }
    );
  }
}