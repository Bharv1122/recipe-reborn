import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AI_API_KEY, AI_GENERATE_URL } from '@/lib/ai';
import { extractJsonPayload } from '@/lib/ai-json';
import { getRequestUserId } from '@/lib/request-auth';
import { rateLimit } from '@/lib/rate-limit';
import { ImportInputError, importFile, normalizeImportedRecipe, recipePage, type ImportPart } from '@/lib/recipe-import';
import { resolvePartnerTrial } from '@/lib/partner-offer-server';
import { findBlockedFoodInRecipe } from '@/lib/food-preferences';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TIER_LIMITS = { free: 3, premium: 100, pro: Infinity };

function extractionPrompt() {
  return `Transcribe the first complete recipe in this source faithfully. This is an import, not a request to invent, modernize, simplify, or adapt a recipe.

Return JSON only with this structure:
{
  "title": "title exactly as shown",
  "ingredients": ["every ingredient with its printed quantity"],
  "instructions": ["every instruction in source order"],
  "prepTime": "shown value or empty string",
  "cookTime": "shown value or empty string",
  "servings": "shown value or empty string",
  "reviewNotes": ["short note for any illegible, cropped, or uncertain text"]
}

Do not silently fix or substitute ingredients because of food preferences. Do not add ingredients or steps that are not visible. Preserve handwritten wording when readable. Put [unclear] exactly where text cannot be read and explain it in reviewNotes. If a title, ingredient list, or instructions cannot be recovered, return empty values instead of inventing certainty.`;
}

async function readSource(req: NextRequest): Promise<ImportPart> {
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
  const body = await req.json().catch(() => null) as { url?: unknown } | null;
  if (typeof body?.url !== 'string' || !body.url.trim()) throw new ImportInputError('Enter a valid HTTPS recipe link.');
  return { text: await recipePage(body.url.trim()) };
}

async function extractRecipe(source: ImportPart, requestSignal: AbortSignal) {
  if (!AI_API_KEY) throw new Error('AI API key not configured');
  const parts = 'inlineData' in source
    ? [source, { text: extractionPrompt() }]
    : [{ text: `${extractionPrompt()}\n\nRECIPE SOURCE:\n${source.text}` }];
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (requestSignal.aborted) controller.abort();
  else requestSignal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 45_000);
  let response: Response;
  try {
    response = await fetch(AI_GENERATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': AI_API_KEY },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0, maxOutputTokens: 8000, responseMimeType: 'application/json' },
      }),
    });
  } finally {
    clearTimeout(timeout);
    requestSignal.removeEventListener('abort', abort);
  }
  if (!response.ok) {
    console.error('[recipe-import] provider status', response.status);
    throw new Error('Recipe extraction failed');
  }
  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason && candidate.finishReason !== 'STOP') throw new Error('Recipe extraction was incomplete');
  const content = candidate?.content?.parts?.map((part: { text?: unknown }) => typeof part.text === 'string' ? part.text : '').join('');
  if (!content) throw new Error('Recipe extraction returned no content');
  return normalizeImportedRecipe(JSON.parse(extractJsonPayload(content)));
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
    if (Math.floor((now.getTime() - new Date(user.lastGenerationReset).getTime()) / 86_400_000) >= 30) {
      await prisma.user.update({ where: { id: user.id }, data: { generationCount: 0, lastGenerationReset: now } });
      user.generationCount = 0;
    }
    const isTrialing = user.subscriptionTier !== 'free' && user.subscriptionStatus === 'trialing';
    const { offer, trialRecipeLimit } = await resolvePartnerTrial(user);
    const limit = isTrialing ? trialRecipeLimit : TIER_LIMITS[user.subscriptionTier as keyof typeof TIER_LIMITS] ?? TIER_LIMITS.free;
    if (user.generationCount >= limit) {
      return NextResponse.json({
        error: 'Generation limit reached', limit, current: user.generationCount, tier: user.subscriptionTier,
        message: isTrialing
          ? offer ? `Your ${offer.label} free trial includes ${trialRecipeLimit} recipes, and you've used them all.` : `Your free trial includes ${trialRecipeLimit} recipes.`
          : user.subscriptionTier === 'free' ? 'You have reached your free tier limit of 3 recipes per month.' : `You have reached your ${user.subscriptionTier} tier limit of ${limit} recipes this month.`,
      }, { status: 403 });
    }

    const recipe = await extractRecipe(await readSource(req), req.signal);
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
    const charged = Number.isFinite(limit)
      ? await prisma.user.updateMany({ where: { id: user.id, generationCount: { lt: limit } }, data: { generationCount: { increment: 1 } } })
      : await prisma.user.update({ where: { id: user.id }, data: { generationCount: { increment: 1 } } }).then(() => ({ count: 1 }));
    if (charged.count !== 1) return NextResponse.json({ error: 'Generation limit reached' }, { status: 403 });
    return NextResponse.json({ recipe });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return NextResponse.json({ error: 'Recipe import canceled. Nothing was saved or charged.' }, { status: 499 });
    if (error instanceof ImportInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'The source did not contain a readable complete recipe.' }, { status: 422 });
    console.error('[recipe-import] failed', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'The recipe could not be read. Try a clearer photo or another supported source.' }, { status: 422 });
  }
}
