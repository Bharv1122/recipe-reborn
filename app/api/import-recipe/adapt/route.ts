import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AI_API_KEY, AI_GENERATE_URL } from '@/lib/ai';
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

async function requestAdaptation(prompt: string, requestSignal: AbortSignal) {
  if (!AI_API_KEY) throw new Error('AI API key not configured');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (requestSignal.aborted) controller.abort();
  else requestSignal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 25_000);
  try {
    const response = await fetch(AI_GENERATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': AI_API_KEY },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 8000, responseMimeType: 'application/json' },
      }),
    });
    if (!response.ok) throw new Error(`Recipe adaptation provider returned ${response.status}`);
    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') throw new Error('Recipe adaptation was incomplete');
    const content = candidate?.content?.parts?.map((part: { text?: unknown }) => typeof part.text === 'string' ? part.text : '').join('');
    if (!content) throw new Error('Recipe adaptation returned no content');
    return parseAdaptedImportOutput(JSON.parse(extractJsonPayload(content)));
  } catch (error) {
    if (controller.signal.aborted && !requestSignal.aborted) throw new Error('Recipe adaptation provider timed out');
    throw error;
  } finally {
    clearTimeout(timeout);
    requestSignal.removeEventListener('abort', abort);
  }
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

    let repairReason = '';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let output: AdaptedImportOutput;
      try {
        output = await requestAdaptation(
          buildImportAdaptationPrompt(parsed.data.recipe, parsed.data.action, preferences, repairReason),
          request.signal,
        );
      } catch (error) {
        if (request.signal.aborted) throw new DOMException('Recipe adaptation canceled', 'AbortError');
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
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Recipe adaptation canceled. Your draft was not changed or saved.' }, { status: 499 });
    }
    console.error('[import-adaptation] failed', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'The recipe could not be adapted. Your draft was not changed or saved.' }, { status: 422 });
  }
}
