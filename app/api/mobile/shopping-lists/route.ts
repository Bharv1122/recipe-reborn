import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    const lists = await prisma.shoppingList.findMany({
      where: { userId },
      include: { items: { orderBy: [{ checked: 'asc' }, { category: 'asc' }, { order: 'asc' }] } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(lists);
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Mobile shopping lists error:', error);
    return NextResponse.json({ error: 'Unable to load shopping lists.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    const parsed = z.object({ name: z.string().trim().min(1).max(100), notes: z.string().trim().max(1000).optional() })
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'A list name is required.' }, { status: 400 });
    const list = await prisma.shoppingList.create({
      data: { userId, name: parsed.data.name, notes: parsed.data.notes || null },
      include: { items: true },
    });
    return NextResponse.json(list, { status: 201 });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Mobile create shopping list error:', error);
    return NextResponse.json({ error: 'Unable to create shopping list.' }, { status: 500 });
  }
}
