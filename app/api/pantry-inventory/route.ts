import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  normalizePantryItems,
  pantryInventoryItemsSchema,
  pantryInventorySaveSchema,
} from '@/lib/pantry-inventory';
import { getRequestUserId } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const inventory = await prisma.pantryInventory.findUnique({
    where: { userId },
    select: { items: true, reviewedAt: true, updatedAt: true },
  });

  if (!inventory) return NextResponse.json({ inventory: null });

  const parsedItems = pantryInventoryItemsSchema.safeParse(inventory.items);
  return NextResponse.json({
    inventory: parsedItems.success
      ? { items: parsedItems.data, reviewedAt: inventory.reviewedAt, updatedAt: inventory.updatedAt }
      : null,
  });
}

export async function PUT(request: Request) {
  try {
    const userId = await getRequestUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = pantryInventorySaveSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Review and confirm at least one inventory item before saving.' },
        { status: 400 },
      );
    }

    const items = normalizePantryItems(parsed.data.items);
    if (items.length === 0) {
      return NextResponse.json({ error: 'At least one inventory item is required.' }, { status: 400 });
    }

    const reviewedAt = new Date();
    const inventory = await prisma.pantryInventory.upsert({
      where: { userId },
      create: { userId, items, reviewedAt },
      update: { items, reviewedAt },
      select: { items: true, reviewedAt: true, updatedAt: true },
    });

    return NextResponse.json({ inventory });
  } catch (error) {
    console.error('Save pantry inventory error:', error);
    return NextResponse.json({ error: 'Failed to save pantry inventory.' }, { status: 500 });
  }
}
