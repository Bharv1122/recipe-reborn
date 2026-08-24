import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = requireMobileUserId(request);
    const mealPlan = await prisma.mealPlan.findFirst({
      where: { id: params.id, userId },
      include: { mealPlanRecipes: { include: { recipe: true }, orderBy: [{ day: 'asc' }, { order: 'asc' }] } },
    });
    if (!mealPlan) return NextResponse.json({ error: 'Meal plan not found.' }, { status: 404 });
    return NextResponse.json({ mealPlan });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Unable to load meal plan.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = requireMobileUserId(request);
    const deleted = await prisma.mealPlan.deleteMany({ where: { id: params.id, userId } });
    if (!deleted.count) return NextResponse.json({ error: 'Meal plan not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Unable to delete meal plan.' }, { status: 500 });
  }
}
