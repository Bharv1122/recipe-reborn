import { extractRecipe } from '@/lib/recipe-extraction';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestUserId } from '@/lib/request-auth';
import { rateLimit } from '@/lib/rate-limit';
import { limitAiRequest } from '@/lib/ai-rate-limit';
import { ImportInputError, importFile, recipePage, type ImportPart } from '@/lib/recipe-import';
import { resolvePartnerTrial } from '@/lib/partner-offer-server';
import { findBlockedFoodInRecipe } from '@/lib/food-preferences';
import { hasPremiumAccess } from '@/lib/entitlement';
import { RequestDeadlineError, withRequestDeadline } from '@/lib/request-deadline';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TIER_LIMITS = { free: 3, premium: 100, pro: Infinity };

async function readSource(req: NextRequest, signal: AbortSignal): Promise<ImportPart> {
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData().catch(() => null);
    const file = formData?.get('file');
    if (!(file instanceof File)) throw new ImportInputError('Choose a recipe photo or file.');
    return importFile(file);
  }
  if (!contentType.includes('application/json')) {
    throw new ImportInputError('Send a recipe website link, photo, or supported file.', 415);
  }
  const body = await req.json().catch(() => null) as { url?: unknown; text?: unknown } | null;
  if (typeof body?.text === 'string') {
    const text = body.text.trim();
    if (!text || Buffer.byteLength(text) > 100 * 1024) throw new ImportInputError('Paste recipe text under 100 KB.');
    return { text };
  }
  if (typeof body?.url !== 'string' || !body.url.trim()) throw new ImportInputError('Enter a valid HTTPS recipe link.');
  return { text: await recipePage(body.url.trim(), 0, signal) };
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const limited = await rateLimit(`import-recipe:${userId}`, 10, 60);
    if (!limited.success) return NextResponse.json({ error: 'Too many imports. Wait a minute and try again.' }, { status: 429 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, subscriptionTier: true, subscriptionStatus: true, generationCount: true,
        lastGenerationReset: true, signupSource: true, createdAt: true, currentPeriodEnd: true,
        allergies: true, dislikedIngredients: true,
      },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const now = new Date();
    const resetBefore = new Date(now.getTime() - 30 * 86_400_000);
    if (user.lastGenerationReset <= resetBefore) {
      await prisma.user.updateMany({ where: { id: user.id, lastGenerationReset: { lte: resetBefore } }, data: { generationCount: 0, lastGenerationReset: now } });
      const refreshed = await prisma.user.findUnique({ where: { id: user.id }, select: { generationCount: true } });
      if (!refreshed) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      user.generationCount = refreshed.generationCount;
    }
    const tier = hasPremiumAccess(user, now) ? user.subscriptionTier : 'free';
    const isTrialing = tier !== 'free' && user.subscriptionStatus === 'trialing';
    const { offer, trialRecipeLimit } = await resolvePartnerTrial(user);
    const limit = isTrialing ? trialRecipeLimit : TIER_LIMITS[tier as keyof typeof TIER_LIMITS] ?? TIER_LIMITS.free;
    if (user.generationCount >= limit) {
      return NextResponse.json({
        error: 'Generation limit reached', limit, current: user.generationCount, tier: user.subscriptionTier,
        message: isTrialing
          ? offer ? `Your ${offer.label} free trial includes ${trialRecipeLimit} recipes, and you've used them all.` : `Your free trial includes ${trialRecipeLimit} recipes.`
          : user.subscriptionTier === 'free' ? 'You have reached your free tier limit of 3 recipes per month.' : `You have reached your ${user.subscriptionTier} tier limit of ${limit} recipes this month.`,
      }, { status: 403 });
    }

    const aiLimit = await limitAiRequest(userId);
    if (aiLimit) return aiLimit;
    const recipe = await withRequestDeadline(req.signal, 55_000, async (signal) =>
      extractRecipe(await readSource(req, signal), signal, req.headers.get('x-recipe-partial-review') === '1'));
    const importedContent = {
      title: recipe.title,
      ingredients: recipe.freshIngredients.split('\n').filter(Boolean),
      instructions: recipe.instructions,
    };
    const allergyConflict = findBlockedFoodInRecipe(importedContent, user.allergies, 'allergy');
    const dislikeConflict = findBlockedFoodInRecipe(importedContent, user.dislikedIngredients, 'dislike');
    recipe.reviewNotes = [
      recipe.reviewNotes,
      allergyConflict ? `Review carefully: the source appears to include an ingredient matching your saved allergy (${allergyConflict}). The import was kept faithful and was not rewritten.` : '',
      dislikeConflict ? `Review: the source appears to include an ingredient matching your saved dislike (${dislikeConflict}). The import was kept faithful and was not rewritten.` : '',
    ].filter(Boolean).join('\n');
    if (req.signal.aborted) throw new DOMException('Recipe import canceled', 'AbortError');
    // A recoverable partial read is not a completed import. Keep rate/AI limits,
    // but don't charge recipe quota or pass it off as a saveable source recipe.
    if (recipe.needsDirections) return NextResponse.json({ status: 'partial', recipe, quotaUsed: false });
    const charged = Number.isFinite(limit)
      ? await prisma.user.updateMany({ where: { id: user.id, generationCount: { lt: limit } }, data: { generationCount: { increment: 1 } } })
      : await prisma.user.update({ where: { id: user.id }, data: { generationCount: { increment: 1 } } }).then(() => ({ count: 1 }));
    if (charged.count !== 1) return NextResponse.json({ error: 'Generation limit reached' }, { status: 403 });
    return NextResponse.json({ recipe });
  } catch (error) {
    if (error instanceof RequestDeadlineError) return NextResponse.json({ error: error.message }, { status: 504 });
    if (error instanceof DOMException && error.name === 'AbortError') return NextResponse.json({ error: 'Recipe import canceled. Nothing was saved or charged.' }, { status: 499 });
    if (error instanceof ImportInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'The source did not contain a readable complete recipe.' }, { status: 422 });
    console.error('[recipe-import] failed', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'The recipe could not be read. Try a clearer photo or another supported source.' }, { status: 422 });
  }
}
