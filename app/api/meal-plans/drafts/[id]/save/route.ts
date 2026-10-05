import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestUserId } from '@/lib/request-auth';
import { saveMealPlanDraft, MealPlanDraftError } from '@/lib/meal-plan-drafts';
import { DAYS, MEAL_TYPES } from '@/lib/meal-plan-validation';

const selection = z.union([
  z.object({ kind: z.literal('meal'), day: z.enum(DAYS), mealType: z.enum(MEAL_TYPES) }).strict(),
  z.object({ kind: z.literal('plan') }).strict(),
]);

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getRequestUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = selection.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Choose a meal or the whole plan to save.' }, { status: 400 });
  try {
    return NextResponse.json(await saveMealPlanDraft((await context.params).id, userId,
      body.data.kind === 'meal' ? body.data : undefined));
  } catch (error) {
    return NextResponse.json({ error: error instanceof MealPlanDraftError ? error.message : 'Could not save. Your preview is still here; please try again.' }, { status: error instanceof MealPlanDraftError ? error.status : 503 });
  }
}
