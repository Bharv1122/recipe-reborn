import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestUserId } from '@/lib/request-auth';
import { hasRecipeAIKey } from '@/lib/ai-provider';
import { limitAiRequest } from '@/lib/ai-rate-limit';
import { ENTITLEMENT_SELECT, hasPremiumAccess, premiumRequiredMessage } from '@/lib/entitlement';
import { RequestDeadlineError, withRequestDeadline } from '@/lib/request-deadline';
import { MealPlanProviderError } from '@/lib/meal-plan-generation';
import { generateMealReplacement } from '@/lib/meal-plan-replacement';
import { changeMealPlanDraftMeal, MealPlanDraftError, parseDraftMealChange } from '@/lib/meal-plan-drafts';

export const maxDuration = 60;

const kept = 'Your current meal was kept.';
class RateLimited extends Error { constructor(readonly response: NextResponse) { super('rate limited'); } }

// Change one meal in an unsaved preview. Never writes Recipe or MealPlan rows;
// saving remains the explicit /save action.
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getRequestUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const input = parseDraftMealChange(await req.json().catch(() => null));
  if (!input) return NextResponse.json({ error: 'Invalid meal change.' }, { status: 400 });
  const { id } = await context.params;
  try {
    // Same gates as replacing a saved-plan meal. Edits use no AI and stay free.
    if (input.change.kind === 'replace') {
      if (!hasRecipeAIKey()) return NextResponse.json({ error: `Meal replacement is temporarily unavailable. ${kept}` }, { status: 503 });
      const user = await prisma.user.findUnique({ where: { id: userId }, select: ENTITLEMENT_SELECT });
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (!hasPremiumAccess(user)) return NextResponse.json({ error: 'Premium feature', message: premiumRequiredMessage(user, 'Meal replacement') }, { status: 403 });
    }
    const draft = await changeMealPlanDraftMeal(id, userId, input, {
      // Counted only once the preview checks pass, right before the AI call.
      replace: async request => {
        const limited = await limitAiRequest(userId);
        if (limited) throw new RateLimited(limited);
        return withRequestDeadline(req.signal, 50_000, signal => generateMealReplacement({ ...request, signal }));
      },
    });
    return NextResponse.json({ draft }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof RateLimited) return error.response;
    if (error instanceof MealPlanDraftError) return NextResponse.json({ error: error.message, ...error.details }, { status: error.status });
    if (error instanceof RequestDeadlineError) return NextResponse.json({ error: `${error.message} ${kept}` }, { status: 504 });
    console.error('[meal-draft-change] failed', { kind: error instanceof MealPlanProviderError ? error.failureKind : error instanceof Error ? error.name : 'Unknown' });
    return NextResponse.json({ error: `Meal change is temporarily unavailable. ${kept} Please try again.` }, { status: 503 });
  }
}
