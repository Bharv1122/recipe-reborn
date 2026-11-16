import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';
import { removeFromLibraryUpdate, saveToLibraryUpdate } from '@/lib/recipe-library';

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
    const parsed = z.object({ rating: z.number().int().min(0).max(5).optional(), notes: z.string().max(10000).nullable().optional(), saveToLibrary: z.literal(true).optional() })
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid recipe update.' }, { status: 400 });
    const owned = await prisma.recipe.findFirst({ where: { id: params.id, userId }, select: { id: true, savedAt: true, librarySource: true } });
    if (!owned) return NextResponse.json({ error: 'Recipe not found.' }, { status: 404 });
    const { saveToLibrary, ...changes } = parsed.data;
    return NextResponse.json({ recipe: await prisma.recipe.update({ where: { id: params.id }, data: { ...changes, ...(saveToLibrary && saveToLibraryUpdate(owned.savedAt, owned.librarySource)) } }) });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Unable to update recipe.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = requireMobileUserId(request);
    const owned = await prisma.recipe.findFirst({ where: { id: params.id, userId }, select: { id: true } });
    if (!owned) return NextResponse.json({ error: 'Recipe not found.' }, { status: 404 });
    await prisma.recipe.update({ where: { id: owned.id }, data: removeFromLibraryUpdate() });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Unable to remove saved recipe.' }, { status: 500 });
  }
}
