import { NextRequest, NextResponse } from 'next/server';
import { MODEL_SMART } from '@/lib/ai';
import { recipeChat, canRetryRecipeAI, BackupTransportError, ProviderConnectionError } from '@/lib/ai-provider';
import { extractJsonPayload } from '@/lib/ai-json';
import { RequestDeadlineError, withRequestDeadline } from '@/lib/request-deadline';
import { checkGuestLimit } from '@/lib/guest-rate-limit';
import { getClientIp } from '@/lib/rate-limit';
import {
  createGuestRecipeHandoff,
  guestRecipeHandoffRecipeSchema,
} from '@/lib/guest-recipe-handoff';

export const dynamic = 'force-dynamic';

type GuestRecipe = {
  title?: unknown;
  freshIngredients?: unknown;
  instructions?: unknown;
  prepTime?: unknown;
  cookTime?: unknown;
  servings?: unknown;
  estimatedCostPerServing?: unknown;
  storeBoughtCost?: unknown;
};

const NON_FOOD_ITEM =
  /\b(skewers?|toothpicks?|parchment(?: paper)?|aluminum foil|baking sheets?|mixing bowls?|whisks?|spatulas?|knives?|pans?|pots?|ramekins?|muffin liners?)\b/i;
const PROCESSED_SHORTCUT =
  /\b(hot dogs?|frankfurters?|deli meats?|processed cheese|cheese powder|boxed (?:cake|brownie|pancake|waffle) mix|packaged (?:cookies?|biscuits?|crackers?))\b/i;

// Up to four sequential model calls (first try, transient retry, JSON retry,
// quality repair) share this one bound.
const GUEST_DEADLINE_MS = 55_000;
const BUSY_MESSAGE =
  "Recipe generation is temporarily unavailable. Your ingredients are still here — please try again in a few minutes.";

// Errors whose message was written for visitors and is safe to return.
class GuestRecipeError extends Error {}
class GuestBusyError extends Error {}

type Completion = { choices?: Array<{ finish_reason?: string; message?: { refusal?: unknown; content?: unknown } }> };

function isUnsafeStop(data: Completion) {
  const choice = data?.choices?.[0];
  return Boolean(choice?.message?.refusal) || choice?.finish_reason === 'content_filter';
}

// Only a clean stop is a finished answer; a missing or unknown reason is not.
function finishedContent(data: Completion): string | null {
  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  return choice?.finish_reason === 'stop' && typeof content === 'string' ? content : null;
}

function parseRecipe(content: string): GuestRecipe {
  return JSON.parse(extractJsonPayload(content));
}

function recipeQualityIssues(recipe: GuestRecipe): string[] {
  const ingredients = Array.isArray(recipe.freshIngredients)
    ? recipe.freshIngredients.filter((item): item is string => typeof item === 'string')
    : [];
  const issues: string[] = [];

  if (typeof recipe.title !== 'string' || !recipe.title.trim()) {
    issues.push('The recipe needs a recognizable title.');
  }
  if (ingredients.length < 3) {
    issues.push('The recipe needs at least three food ingredients.');
  }
  if (ingredients.some((item) => NON_FOOD_ITEM.test(item))) {
    issues.push('Equipment or serving supplies were listed as food ingredients.');
  }
  if (ingredients.some((item) => PROCESSED_SHORTCUT.test(item))) {
    issues.push('A processed packaged shortcut was used instead of a from-scratch ingredient.');
  }
  if (!Array.isArray(recipe.instructions) || recipe.instructions.length < 2) {
    issues.push('The recipe needs complete step-by-step instructions.');
  }
  if (typeof recipe.prepTime !== 'string' || !recipe.prepTime.trim()) {
    issues.push('The recipe needs a preparation time.');
  }
  if (typeof recipe.cookTime !== 'string' || !recipe.cookTime.trim()) {
    issues.push('The recipe needs a cooking time.');
  }
  if (typeof recipe.servings !== 'string' || !recipe.servings.trim()) {
    issues.push('The recipe needs a serving count.');
  }

  return issues;
}

// Anonymous "try it free" recipe generation. No auth. Hard IP rate limit.
// Returns a full recipe; the client shows a teaser + signup wall.
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limit = await checkGuestLimit(ip);
    if (!limit.allowed) {
      const message =
        limit.reason === 'global'
          ? "We've hit today's free-preview limit. Sign up free to keep transforming — no card needed."
          : "You've used your free previews for today. Sign up free to keep transforming — 3 recipes a month, no card needed.";
      return NextResponse.json({ error: 'Guest limit reached', message }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const rawIngredients = typeof body.ingredients === 'string' ? body.ingredients.trim() : '';

    if (!rawIngredients) {
      return NextResponse.json({ error: 'Ingredients are required' }, { status: 400 });
    }
    // Cap prompt size — anonymous endpoint, don't let it be abused for long calls
    const ingredients = rawIngredients.slice(0, 2000);

    const prompt = `You are a professional chef. Someone has read the ingredient list off a packaged food and wants to make that same food at home, without the additives.

Ingredient list copied from the package: ${ingredients}

First work out what the product actually is from that list. Pasta, whey and cheese cultures means boxed macaroni cheese. Tomato paste, corn syrup and vinegar means ketchup. Enriched flour, cocoa and palm oil means a packaged chocolate cookie.

Then write a homemade recipe for THAT SAME DISH using whole, unprocessed ingredients.

Rules:
- The result must be recognisably the food they were about to eat out of the package. Never swap in a different dish.
- Every ingredient you list must genuinely belong in that dish. Do not introduce unrelated ingredients such as lentils, peppers or mushrooms unless the product itself contained them.
- Where the package used an additive, use the real ingredient it was imitating: real cheese instead of cheese powder, real vanilla instead of artificial flavour, paprika or annatto instead of Yellow 5.
- freshIngredients must contain food only. Never list equipment, packaging or serving supplies such as skewers, toothpicks, parchment, foil, pans or bowls.
- Do not rebuild one processed food with another processed shortcut. Never use hot dogs, frankfurters, deli meat, processed cheese, cheese powder or a boxed mix. If the recognizable dish normally contains one, make that component from ground meat, dairy, flour, spices or other whole grocery ingredients.
- Put preparation actions such as "pat dry", "chopped" or "thread onto skewers" in the instructions, not in the ingredient name.
- Title it so they recognise it as the homemade version of what they were holding.
- Keep the response compact and complete: use 6 to 12 ingredients and 5 to 8 concise instruction steps, with no step longer than 30 words.

Provide clear, step-by-step instructions.

Provide a JSON response with this exact structure:
{
  "title": "Recipe name",
  "freshIngredients": ["ingredient 1 with quantity", "ingredient 2 with quantity"],
  "instructions": ["Step 1 description", "Step 2 description"],
  "prepTime": "15 minutes",
  "cookTime": "30 minutes",
  "servings": "4",
  "estimatedCostPerServing": 2.50,
  "storeBoughtCost": 6.75
}

For the cost fields, estimate using average US grocery prices: "estimatedCostPerServing" is the cost in USD to make one serving from the fresh ingredients, and "storeBoughtCost" is the cost in USD of one serving of the equivalent store-bought/packaged product. Both must be plain numbers (not strings), rounded to 2 decimal places.

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;

    // One deadline covers every model call below; the handoff write runs after it.
    const recipe = await withRequestDeadline(request.signal, GUEST_DEADLINE_MS, async (signal) => {
      const ask = (messages: Array<{ role: string; content: string }>) => recipeChat({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          model: MODEL_SMART,
          messages,
          max_tokens: 6000,
          response_format: { type: 'json_object' },
        }),
      }, { totalMs: GUEST_DEADLINE_MS });

      let response = await ask([{ role: 'user', content: prompt }]);
      // Retry only transient Gemini 5xx — NOT 429 (retrying into a quota wall
      // just burns more of the shared budget) and never a failed backup answer,
      // which would repeat the same paid call.
      if (response.status >= 500 && canRetryRecipeAI(response)) {
        await response.body?.cancel();
        signal.throwIfAborted();
        response = await ask([{ role: 'user', content: prompt }]);
      }
      if (!response.ok) {
        console.error('Guest generation LLM failed:', response.status);
        await response.body?.cancel();
        // Provider quota is exhausted — degrade gracefully; the visitor keeps their input
        throw new GuestBusyError();
      }

      const data = await response.json();
      // A refusal or safety stop is an answer, not malformed JSON: never re-ask.
      if (isUnsafeStop(data)) throw new GuestRecipeError('Could not build a recipe from that — try a fuller ingredient list.');
      // Truncation earns the one compact retry below; any other unfinished answer is final.
      const finishReason = data.choices?.[0]?.finish_reason;
      if (finishReason !== 'stop' && finishReason !== 'length') {
        throw new GuestRecipeError('Could not build a recipe from that — try a fuller ingredient list.');
      }
      const content = finishedContent(data) ?? '';

      let draft: GuestRecipe;
      try {
        draft = parseRecipe(content);
      } catch {
        console.warn('Guest generation returned invalid JSON; requesting one compact retry.', {
          length: content.length,
          finishReason: data.choices?.[0]?.finish_reason,
        });

        const retryResponse = await ask([
          { role: 'user', content: prompt },
          {
            role: 'user',
            content:
              'The previous response was incomplete or invalid. Start over and return one complete, compact JSON object only. Use 6 to 10 ingredients and 5 to 7 concise instruction steps.',
          },
        ]);

        if (!retryResponse.ok) {
          console.error('Guest generation JSON retry failed:', retryResponse.status);
          await retryResponse.body?.cancel();
          throw new GuestBusyError();
        }

        const retryData = await retryResponse.json();
        const retryContent = finishedContent(retryData);
        try {
          if (isUnsafeStop(retryData) || retryContent === null) throw new Error('unfinished answer');
          draft = parseRecipe(retryContent);
        } catch {
          console.error('Guest generation JSON retry was invalid:', {
            length: retryContent?.length ?? 0,
            finishReason: retryData.choices?.[0]?.finish_reason,
          });
          throw new GuestRecipeError('Could not build a recipe from that — try a fuller ingredient list.');
        }
      }

      const qualityIssues = recipeQualityIssues(draft);
      if (qualityIssues.length > 0) {
        const repairResponse = await ask([
          { role: 'user', content: prompt },
          { role: 'assistant', content: JSON.stringify(draft) },
          {
            role: 'user',
            content: `Revise the JSON recipe before returning it. Fix every issue below:\n- ${qualityIssues.join('\n- ')}\nReturn raw JSON only.`,
          },
        ]);
        if (!repairResponse.ok) {
          console.error('Guest generation quality repair failed:', repairResponse.status);
          await repairResponse.body?.cancel();
          throw new GuestBusyError();
        }

        const repairData = await repairResponse.json();
        const repairedContent = finishedContent(repairData);
        if (isUnsafeStop(repairData) || repairedContent === null) throw new GuestRecipeError('Could not build a fully fresh recipe — try another ingredient list.');
        draft = parseRecipe(repairedContent);

        const remainingIssues = recipeQualityIssues(draft);
        if (remainingIssues.length > 0) {
          console.error('Guest generation failed quality checks:', remainingIssues);
          throw new GuestRecipeError('Could not build a fully fresh recipe — try another ingredient list.');
        }
      }
      return draft;
    });

    const validatedRecipe = guestRecipeHandoffRecipeSchema.safeParse(recipe);
    if (!validatedRecipe.success) {
      // Issue paths only: messages can quote model output.
      console.error('Guest generation was complete but not safe to hand off:', validatedRecipe.error.issues.map((issue) => issue.path.join('.')));
      throw new GuestRecipeError('Could not build a complete recipe — try another ingredient list.');
    }

    const handoff = await createGuestRecipeHandoff({
      originalIngredients: ingredients,
      recipe: validatedRecipe.data,
    });

    return NextResponse.json({
      recipe: validatedRecipe.data,
      remaining: limit.remaining,
      handoffToken: handoff.token,
      handoffExpiresAt: handoff.expiresAt.toISOString(),
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (request.signal.aborted) return new NextResponse(null, { status: 499 });
    if (error instanceof GuestBusyError || error instanceof BackupTransportError || error instanceof ProviderConnectionError) {
      return NextResponse.json({ error: 'Busy', message: BUSY_MESSAGE }, { status: 503 });
    }
    if (error instanceof RequestDeadlineError || (error as { name?: string })?.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Timeout', message: 'That took too long — please try again.' }, { status: 504 });
    }
    // Only messages written for visitors are returned; raw errors can quote provider output.
    console.error('Guest generate error:', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json(
      { error: error instanceof GuestRecipeError ? error.message : 'Failed to generate recipe' },
      { status: 500 }
    );
  }
}
