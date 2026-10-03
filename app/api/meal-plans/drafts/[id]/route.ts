import { NextResponse } from 'next/server';
import { getRequestUserId } from '@/lib/request-auth';
import { getMealPlanDraft, MealPlanDraftError } from '@/lib/meal-plan-drafts';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getRequestUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json({ draft: await getMealPlanDraft((await context.params).id, userId) }, { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return NextResponse.json({ error: error instanceof MealPlanDraftError ? error.message : 'Could not load preview. Please try again.' }, { status: error instanceof MealPlanDraftError ? error.status : 503 }); }
}
