import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';

export async function GET(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    const collections = await prisma.collection.findMany({
      where: { userId },
      include: { _count: { select: { collectionRecipes: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ collections });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Unable to load collections.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    const parsed = z.object({ name: z.string().trim().min(1).max(100), description: z.string().trim().max(1000).optional() })
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'A collection name is required.' }, { status: 400 });
    const collection = await prisma.collection.create({ data: { userId, name: parsed.data.name, description: parsed.data.description || null } });
    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Unable to create collection.' }, { status: 500 });
  }
}
