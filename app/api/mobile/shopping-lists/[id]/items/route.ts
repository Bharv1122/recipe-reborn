import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = requireMobileUserId(request);
    const parsed = z.object({
      ingredient: z.string().trim().min(1).max(200),
      quantity: z.string().trim().max(40).optional(),
      unit: z.string().trim().max(40).optional(),
      category: z.string().trim().max(80).optional(),
    }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'An ingredient is required.' }, { status: 400 });

    const list = await prisma.shoppingList.findFirst({ where: { id: params.id, userId } });
    if (!list) return NextResponse.json({ error: 'Shopping list not found.' }, { status: 404 });
    const max = await prisma.shoppingListItem.findFirst({
      where: { shoppingListId: params.id }, orderBy: { order: 'desc' }, select: { order: true },
    });
    const item = await prisma.shoppingListItem.create({
      data: {
        shoppingListId: params.id,
        ingredient: parsed.data.ingredient,
        quantity: parsed.data.quantity || null,
        unit: parsed.data.unit || null,
        category: parsed.data.category || 'Other',
        order: (max?.order ?? -1) + 1,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Mobile add shopping item error:', error);
    return NextResponse.json({ error: 'Unable to add item.' }, { status: 500 });
  }
}
