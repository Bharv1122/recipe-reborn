import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { recipeGenerate, hasRecipeAIKey, BackupTransportError, ProviderConnectionError } from '@/lib/ai-provider';
import { RequestDeadlineError, withRequestDeadline } from '@/lib/request-deadline';
import { extractJsonPayload } from '@/lib/ai-json';
import { getRequestUserId } from '@/lib/request-auth';
import { rateLimit } from '@/lib/rate-limit';
import { limitAiRequest } from '@/lib/ai-rate-limit';
import {
  buildImportAdaptationPrompt,
  importAdaptationRequestSchema,
  parseAdaptedImportOutput,
  validateAdaptedImport,
  type AdaptedImportOutput,
  type AppliedFoodPreferences,
} from '@/lib/import-recipe-adaptation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

class AdaptationProviderError extends Error {}
class AdaptationRefusalError extends Error {}

async function requestAdaptation(prompt: string, requestSignal: AbortSignal, remainingMs: number) {
  if (!hasRecipeAIKey()) throw new AdaptationProviderError();
  let data;
  try {
    const response = await recipeGenerate({
      method: 'POST',
      signal: requestSignal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 8000, responseMimeType: 'application/json' },
      }),
    // The caller's shared deadline wins; avoid two timers racing at the same instant.
    }, { totalMs: remainingMs + 1000 });
    // Provider failures are not bad recipe content and must not become repair prompts.
    if (!response.ok) throw new AdaptationProviderError();
    data = await response.json();
  } catch {
    requestSignal.throwIfAborted();
    throw new AdaptationProviderError();
  }
  const candidate = data.candidates?.[0];
  if (data.promptFeedback?.blockReason || (candidate?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason))) throw new AdaptationRefusalError();
  if (candidate?.finishReason && candidate.finishReason !== 'STOP') throw new Error('Recipe adaptation was incomplete');
  const content = candidate?.content?.parts?.map((part: { text?: unknown }) => typeof part.text === 'string' ? part.text : '').join('');
  if (!content) throw new Error('Recipe adaptation returned no content');
  return parseAdaptedImportOutput(JSON.parse(extractJsonPayload(content)));
}

export async function POST(request: Request) {
  try {
    const userId = await getRequestUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const limited = await rateLimit(`import-adaptation:${userId}`, 8, 60);
    if (!limited.success) return NextResponse.json({ error: 'Too many recipe edits. Wait a minute and try again.' }, { status: 429 });
    const parsed = importAdaptationRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Choose a valid imported recipe change.' }, { status: 400 });
    if (parsed.data.action.type === 'remove' && parsed.data.recipe.freshIngredients.length === 1) {
      return NextResponse.json({
        error: 'That is the recipe’s only ingredient. Choose a substitute instead so the dish stays recognizable.',
        code: 'cannot_adapt',
      }, { status: 422 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { allergies: true, dislikedIngredients: true, likedIngredients: true },
    });
    if (!user) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    if (parsed.data.action.type === 'preferences' && !parsed.data.action.oneRecipeDiet &&
      !user.allergies.length && !user.dislikedIngredients.length && !user.likedIngredients.length) {
      return NextResponse.json({ error: 'No saved preferences yet. Add your food preferences in Account, then apply them here.' }, { status: 422 });
    }
    const aiLimit = await limitAiRequest(userId);
    if (aiLimit) return aiLimit;
    const preferences: AppliedFoodPreferences = {
      allergies: parsed.data.action.type === 'measurements' ? [] : user.allergies,
      dislikes: parsed.data.action.type === 'preferences' ? user.dislikedIngredients : [],
      likes: parsed.data.action.type === 'preferences' ? user.likedIngredients : [],
    };

    return await withRequestDeadline(request.signal, 50_000, async (signal) => {
      const deadlineAt = Date.now() + 50_000;
      let repairReason = '';
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const remainingMs = deadlineAt - Date.now();
        if (attempt > 0 && remainingMs < 10_000) break;
        let output: AdaptedImportOutput;
        try {
          output = await requestAdaptation(
            buildImportAdaptationPrompt(parsed.data.recipe, parsed.data.action, preferences, repairReason),
            signal,
            remainingMs,
          );
        } catch (error) {
          if (request.signal.aborted) throw new DOMException('Recipe adaptation canceled', 'AbortError');
          signal.throwIfAborted();
          if (error instanceof AdaptationProviderError || error instanceof BackupTransportError || error instanceof ProviderConnectionError || error instanceof AdaptationRefusalError) throw error;
          repairReason = error instanceof Error ? error.message : 'The provider returned an invalid adaptation';
          if (attempt === 0) continue;
          throw error;
        }
        if (output.status === 'cannot_adapt') {
          return NextResponse.json({ error: output.reason, code: 'cannot_adapt' }, { status: 422 });
        }
        try {
          const recipe = validateAdaptedImport(output.recipe, parsed.data, preferences);
          return NextResponse.json({
            recipe,
            changeSummary: output.changeSummary,
            reviewNotes: output.reviewNotes,
            appliedPreferences: parsed.data.action.type === 'preferences' ? preferences : null,
            quotaUsed: false,
          });
        } catch (error) {
          repairReason = error instanceof Error ? error.message : 'The adapted recipe failed validation';
        }
      }
      return NextResponse.json({ error: 'The recipe could not be changed coherently. Your draft was not changed or saved.' }, { status: 422 });
    });
  } catch (error) {
    if (error instanceof RequestDeadlineError) return NextResponse.json({ error: 'Recipe editing took too long. Your draft was not changed or saved. Please try again.' }, { status: 504 });
    if (error instanceof AdaptationProviderError || error instanceof BackupTransportError || error instanceof ProviderConnectionError) {
      return NextResponse.json({ error: 'Recipe editing is temporarily unavailable. Your draft was not changed or saved. Please try again later.' }, { status: 503 });
    }
    if (error instanceof AdaptationRefusalError) return NextResponse.json({ error: 'The recipe could not be adapted. Your draft was not changed or saved.' }, { status: 422 });
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Recipe adaptation canceled. Your draft was not changed or saved.' }, { status: 499 });
    }
    console.error('[import-adaptation] failed', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'The recipe could not be adapted. Your draft was not changed or saved.' }, { status: 422 });
  }
}
