import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = requireMobileUserId(request);
    const collection = await prisma.collection.findFirst({
      where: { id: params.id, userId },
      include: { collectionRecipes: { include: { recipe: true }, orderBy: { order: 'asc' } } },
    });
    if (!collection) return NextResponse.json({ error: 'Collection not found.' }, { status: 404 });
    return NextResponse.json({ collection });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Unable to load collection.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = requireMobileUserId(request);
    const deleted = await prisma.collection.deleteMany({ where: { id: params.id, userId } });
    if (!deleted.count) return NextResponse.json({ error: 'Collection not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Unable to delete collection.' }, { status: 500 });
  }
}
