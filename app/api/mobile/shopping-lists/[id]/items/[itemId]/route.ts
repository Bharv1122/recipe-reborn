import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string; itemId: string }> }
) {
  const params = await props.params;
  try {
    const userId = requireMobileUserId(request);
    const parsed = z.object({ checked: z.boolean() }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'A checked value is required.' }, { status: 400 });

    const list = await prisma.shoppingList.findFirst({ where: { id: params.id, userId }, select: { id: true } });
    if (!list) return NextResponse.json({ error: 'Shopping list not found.' }, { status: 404 });
    const updated = await prisma.shoppingListItem.updateMany({
      where: { id: params.itemId, shoppingListId: params.id },
      data: { checked: parsed.data.checked },
    });
    if (!updated.count) return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
    return NextResponse.json(await prisma.shoppingListItem.findUnique({ where: { id: params.itemId } }));
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Mobile update shopping item error:', error);
    return NextResponse.json({ error: 'Unable to update item.' }, { status: 500 });
  }
}
