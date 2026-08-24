import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = requireMobileUserId(request);
    const recipe = await prisma.recipe.findFirst({ where: { id: params.id, userId } });
    if (!recipe) return NextResponse.json({ error: 'Recipe not found.' }, { status: 404 });
    return NextResponse.json({ recipe });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Unable to load recipe.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = requireMobileUserId(request);
    const parsed = z.object({ rating: z.number().int().min(0).max(5).optional(), notes: z.string().max(10000).nullable().optional() })
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid recipe update.' }, { status: 400 });
    const owned = await prisma.recipe.findFirst({ where: { id: params.id, userId }, select: { id: true } });
    if (!owned) return NextResponse.json({ error: 'Recipe not found.' }, { status: 404 });
    return NextResponse.json({ recipe: await prisma.recipe.update({ where: { id: params.id }, data: parsed.data }) });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Unable to update recipe.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = requireMobileUserId(request);
    const deleted = await prisma.recipe.deleteMany({ where: { id: params.id, userId } });
    if (!deleted.count) return NextResponse.json({ error: 'Recipe not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Unable to delete recipe.' }, { status: 500 });
  }
}
