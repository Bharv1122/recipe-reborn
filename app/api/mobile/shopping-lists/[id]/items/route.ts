import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';

const singleItemSchema = z.object({
  ingredient: z.string().trim().min(1).max(200),
  quantity: z.string().trim().max(40).optional(),
  unit: z.string().trim().max(40).optional(),
  category: z.string().trim().max(80).optional(),
});

const bulkItemSchema = z.object({
  ingredients: z.array(z.string().trim().min(1).max(200)).min(1).max(100),
});

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = requireMobileUserId(request);
    const body = await request.json().catch(() => null);
    const bulk = bulkItemSchema.safeParse(body);
    const single = singleItemSchema.safeParse(body);
    if (!bulk.success && !single.success) return NextResponse.json({ error: 'One or more ingredients are required.' }, { status: 400 });

    const requestedItems: Array<{ ingredient: string; quantity?: string; unit?: string; category?: string }> = bulk.success
      ? bulk.data.ingredients.map((ingredient) => ({ ingredient }))
      : single.success ? [single.data] : [];

    const list = await prisma.shoppingList.findFirst({ where: { id: params.id, userId } });
    if (!list) return NextResponse.json({ error: 'Shopping list not found.' }, { status: 404 });
    const items = await prisma.$transaction(async (tx) => {
      const max = await tx.shoppingListItem.findFirst({
        where: { shoppingListId: params.id }, orderBy: { order: 'desc' }, select: { order: true },
      });
      const firstOrder = (max?.order ?? -1) + 1;
      const created = [];
      for (const [index, item] of requestedItems.entries()) {
        created.push(await tx.shoppingListItem.create({
          data: {
            shoppingListId: params.id,
            ingredient: item.ingredient,
            quantity: 'quantity' in item ? item.quantity || null : null,
            unit: 'unit' in item ? item.unit || null : null,
            category: 'category' in item ? item.category || 'Other' : 'Other',
            order: firstOrder + index,
          },
        }));
      }
      return created;
    });
    return NextResponse.json(bulk.success ? { items } : items[0], { status: 201 });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Mobile add shopping item error:', error);
    return NextResponse.json({ error: 'Unable to add item.' }, { status: 500 });
  }
}
