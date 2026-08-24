import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { AI_CHAT_URL, AI_API_KEY, MODEL_SMART } from '@/lib/ai';
import { rateLimit } from '@/lib/rate-limit';
import { resolvePartnerTrial } from '@/lib/partner-offer-server';
import { z } from 'zod';
import { logServerError } from '@/lib/server-error-log';
import { clearGenerationCancellation, wasGenerationCanceled } from '@/lib/generation-cancellation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const recipeResultSchema = z.object({
  title: z.string().trim().min(1),
  freshIngredients: z.array(z.string().trim().min(1)).min(2),
  instructions: z.array(z.string().trim().min(1)).min(2),
  prepTime: z.string().trim().min(1),
  cookTime: z.string().trim().min(1),
  servings: z.string().trim().min(1),
  estimatedCostPerServing: z.number().nonnegative().optional(),
  storeBoughtCost: z.number().nonnegative().optional(),
}).passthrough();

function findIncludedAllergen(ingredients: string[], allergies: string[]) {
  const ingredientText = ingredients.join(' ').toLowerCase();

  return allergies.find((rawAllergen) => {
    const allergen = rawAllergen.trim().toLowerCase();
    if (allergen.length < 2) return false;
    const escaped = allergen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, 'i').test(ingredientText);
  });
}

// Tier limits
const TIER_LIMITS = {
  free: 3,
  premium: 100,
  pro: Infinity, // legacy fallback for grandfathered Pro subscribers; no longer sold
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { success } = await rateLimit(`generate-recipe:${session.user.id}`, 10, 60);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down and try again in a minute.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { ingredients, dietaryRestriction, isSubstitutionRegeneration, originalRecipe, substitution, source } = body;
    const pantryTargetTitleResult = z.string().trim().min(1).max(100).safeParse(body.pantryTargetTitle);
    const pantryExtraIngredientResult = z.string().trim().min(1).max(80).safeParse(body.pantryExtraIngredient);
    const pantryTargetTitle = pantryTargetTitleResult.success ? pantryTargetTitleResult.data : undefined;
    const pantryExtraIngredient = pantryExtraIngredientResult.success ? pantryExtraIngredientResult.data : undefined;
    const generationId = z.string().uuid().safeParse(body.generationId);

    if (!ingredients) {
      return NextResponse.json(
        { error: 'Ingredients are required' },
        { status: 400 }
      );
    }

    if (!generationId.success) {
      return NextResponse.json({ error: 'A valid generation ID is required' }, { status: 400 });
    }

    // Get user with subscription info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        generationCount: true,
        lastGenerationReset: true,
        allergies: true,
        dislikedIngredients: true,
        signupSource: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if we need to reset monthly counter
    const now = new Date();
    const lastReset = new Date(user.lastGenerationReset);
    const daysSinceReset = Math.floor(
      (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceReset >= 30) {
      // Reset counter after 30 days
      await prisma.user.update({
        where: { id: user.id },
        data: {
          generationCount: 0,
          lastGenerationReset: now,
        },
      });
      user.generationCount = 0;
    }

    // Check subscription limits — trial users get a reduced cap until their
    // first real payment (prevents stockpiling recipes on a free trial). A
    // partner offer runs a month rather than a week, so it carries its own
    // allowance; resolvePartnerTrial is the single authority on which applies.
    const isTrialing =
      user.subscriptionTier !== 'free' && user.subscriptionStatus === 'trialing';

    const { offer: partnerOffer, trialRecipeLimit: trialLimit } =
      await resolvePartnerTrial(user);

    const limit = isTrialing
      ? trialLimit
      : TIER_LIMITS[user.subscriptionTier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free;

    if (user.generationCount >= limit) {
      return NextResponse.json(
        {
          error: 'Generation limit reached',
          limit,
          current: user.generationCount,
          tier: user.subscriptionTier,
          message: isTrialing
            ? partnerOffer
              // This trial has no card behind it, so it will never "convert" on
              // its own — point them at subscribing instead of implying it.
              ? `Your ${partnerOffer.label} trial includes ${trialLimit} recipes, and you've used them all. Subscribe to Premium for 100 a month.`
              : `Your free trial includes ${trialLimit} recipes. Your full 100 per month unlocks when your trial converts to Premium.`
            : user.subscriptionTier === 'free'
              ? 'You have reached your free tier limit of 3 recipes per month. Upgrade to Premium for 100 recipes per month.'
              : `You have reached your ${user.subscriptionTier} tier limit of ${limit} recipes this month.`,
        },
        { status: 403 }
      );
    }

    // Charge quota only after a validated recipe is ready. The conditional
    // update keeps concurrent successful requests within the finite tier cap,
    // while canceled or failed requests never need a delayed refund.
    let generationChargeState: 'unpaid' | 'charged' | 'completed' = 'unpaid';
    const chargeGenerationSlot = async () => {
      if (generationChargeState !== 'unpaid') return true;

      if (Number.isFinite(limit)) {
        const update = await prisma.user.updateMany({
          where: { id: user.id, generationCount: { lt: limit } },
          data: { generationCount: { increment: 1 } },
        });
        if (update.count !== 1) return false;
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { generationCount: { increment: 1 } },
        });
      }

      generationChargeState = 'charged';
      return true;
    };

    const rollbackGenerationCharge = async () => {
      if (generationChargeState !== 'charged') return;
      generationChargeState = 'unpaid';
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { generationCount: { decrement: 1 } },
        });
      } catch (releaseError) {
        logServerError('generation_quota_release_failed', releaseError);
      }
    };

    // Construct the prompt based on the type of request
    let prompt = '';
    if (isSubstitutionRegeneration && originalRecipe && substitution) {
      // Handle ingredient substitution regeneration
      prompt = `You are a professional chef. A user wants to substitute an ingredient in their recipe and needs the ENTIRE recipe regenerated to work with the substitute.

ORIGINAL RECIPE:
Title: ${originalRecipe.title}

Original Ingredients:
${originalRecipe.ingredients.map((ing: string, i: number) => `${i + 1}. ${ing}`).join('\n')}

Original Instructions:
${originalRecipe.instructions.map((inst: string, i: number) => `${i + 1}. ${inst}`).join('\n')}

SUBSTITUTION REQUEST:
Replace: "${substitution.original}"
With: "${substitution.substitute}"

Please regenerate the ENTIRE recipe, adapting:
1. Update the ingredient list to include the substitute with proper quantities
2. Adjust ALL instructions that mention the original ingredient
3. Modify cooking times if the substitute requires different preparation
4. Update the recipe title if appropriate to reflect the substitution
5. Ensure the recipe remains cohesive and delicious with the new ingredient

Provide a JSON response with this exact structure:
{
  "title": "Recipe name (updated if needed)",
  "freshIngredients": ["ingredient 1 with quantity", "ingredient 2 with quantity"],
  "instructions": ["Step 1 description", "Step 2 description"],
  "prepTime": "15 minutes",
  "cookTime": "30 minutes",
  "servings": "4",
  "estimatedCostPerServing": 2.50,
  "storeBoughtCost": 6.75
}

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;
    } else if (dietaryRestriction) {
      prompt = `Transform the following recipe to be ${dietaryRestriction} compliant. Ensure ALL ingredients and instructions align with ${dietaryRestriction} dietary restrictions.

Original processed ingredients: ${ingredients}

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

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;
    } else if (source === 'pantry') {
      prompt = `You are a professional chef helping users cook with what they already have at home.

The user has these ingredients on hand in their pantry/fridge: ${ingredients}
${pantryTargetTitle ? `The user selected this specific dish idea: ${pantryTargetTitle}` : ''}
${pantryExtraIngredient ? `They intentionally chose to buy exactly one additional ingredient: ${pantryExtraIngredient}. Include it as a required ingredient, do not mark it optional, and do not add any other required grocery ingredients beyond basic staples.` : ''}

Create a delicious, healthy recipe that primarily uses these on-hand ingredients. You may assume basic staples (salt, pepper, cooking oil, water). Minimize ingredients they would need to buy — if something extra is truly needed, keep it to one or two common items and mark each as "(optional)" or "(if you have it)" in the ingredient line. Provide clear, step-by-step instructions.
${pantryTargetTitle ? 'Create the selected dish, keeping its title or a very close equivalent.' : ''}

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

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;
    } else {
      prompt = `You are a professional chef. Someone has read the ingredient list off a packaged food and wants to make that same food at home, without the additives.

Ingredient list copied from the package: ${ingredients}

First work out what the product actually is from that list. Pasta, whey and cheese cultures means boxed macaroni cheese. Tomato paste, corn syrup and vinegar means ketchup. Enriched flour, cocoa and palm oil means a packaged chocolate cookie.

Then write a homemade recipe for THAT SAME DISH using whole, unprocessed ingredients.

Rules:
- The result must be recognisably the food they were about to eat out of the package. Never swap in a different dish.
- Every ingredient you list must genuinely belong in that dish. Do not introduce unrelated ingredients such as lentils, peppers or mushrooms unless the product itself contained them.
- Where the package used an additive, use the real ingredient it was imitating: real cheese instead of cheese powder, real vanilla instead of artificial flavour, paprika or annatto instead of Yellow 5.
- Title it so they recognise it as the homemade version of what they were holding.

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

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;
    }

    // Apply the user's saved food preferences to every generation variant
    const prefLines: string[] = [];
    if (user.allergies.length > 0) {
      prefLines.push(
        `CRITICAL — FOOD ALLERGIES: The user is allergic to: ${user.allergies.join(', ')}. NEVER include these ingredients or anything derived from them, in any form. If an allergen is essential to the dish, use a safe substitute and note it.`
      );
    }
    if (user.dislikedIngredients.length > 0) {
      prefLines.push(
        `DISLIKED INGREDIENTS: The user dislikes: ${user.dislikedIngredients.join(', ')}. Avoid them unless truly essential to the dish concept; prefer substitutes.`
      );
    }
    if (prefLines.length > 0) {
      prompt += `\n\nUSER FOOD PREFERENCES (must be respected):\n${prefLines.join('\n')}`;
    }

    const messages = [
      {
        role: 'user',
        content: prompt,
      },
    ];

    const llmRequest = {
      method: 'POST' as const,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL_SMART,
        messages: messages,
        stream: true,
        // Keep the interactive recipe response focused and concise. Cost and
        // nutrition estimates run after the recipe is visible to the user.
        max_tokens: 3500,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
      }),
    };

    const openModelStream = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 52_000);
      const abortForClient = () => controller.abort();
      request.signal.addEventListener('abort', abortForClient, { once: true });

      const cleanup = () => {
        clearTimeout(timeout);
        request.signal.removeEventListener('abort', abortForClient);
      };

      try {
        const modelResponse = await fetch(AI_CHAT_URL, {
          ...llmRequest,
          signal: controller.signal,
        });
        return {
          response: modelResponse,
          abort: () => controller.abort(),
          cleanup,
        };
      } catch (error) {
        cleanup();
        throw error;
      }
    };

    let modelStream: Awaited<ReturnType<typeof openModelStream>>;
    try {
      modelStream = await openModelStream();
    } catch (modelError) {
      throw modelError;
    }

    let response = modelStream.response;

    if (!response?.ok) {
      logServerError('generation_model_non_ok', undefined, { status: response.status });
      modelStream.cleanup();
      // Gemini occasionally returns transient 429/5xx — one retry recovers most of them
      if (response.status === 429 || response.status >= 500) {
        try {
          modelStream = await openModelStream();
          response = modelStream.response;
        } catch (modelError) {
          throw modelError;
        }
      }
    }

    if (!response?.ok) {
      logServerError('generation_model_retry_failed', undefined, { status: response.status });
      modelStream.cleanup();
      throw new Error(`LLM API request failed (${response.status})`);
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response?.body?.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = '';
        let partialRead = '';

        try {
          while (true) {
            const result = await reader?.read();
            if (result?.done) break;

            partialRead += decoder.decode(result?.value, { stream: true });
            let lines = partialRead?.split('\n') ?? [];
            partialRead = lines?.pop() ?? '';

            for (const line of lines) {
              if (line?.startsWith('data: ')) {
                const data = line?.slice(6);
                if (data === '[DONE]') {
                  try {
                    const validation = recipeResultSchema.safeParse(JSON.parse(buffer));
                    if (!validation.success) {
                      throw new Error('Recipe response did not match the required structure');
                    }
                    const finalResult = validation.data;
                    const includedAllergen = findIncludedAllergen(
                      finalResult.freshIngredients,
                      user.allergies
                    );
                    if (includedAllergen) {
                      throw new Error('Recipe response included a saved allergen');
                    }
                    if (await wasGenerationCanceled(user.id, generationId.data)) {
                      throw new DOMException('Recipe generation canceled', 'AbortError');
                    }
                    const charged = await chargeGenerationSlot();
                    if (!charged) {
                      throw new Error('Recipe generation limit reached before completion');
                    }
                    const finalData = JSON.stringify({
                      status: 'completed',
                      result: finalResult,
                    });
                    controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
                    generationChargeState = 'completed';
                    await clearGenerationCancellation(user.id, generationId.data);
                  } catch (e) {
                    const wasCanceled = e instanceof DOMException && e.name === 'AbortError';
                    if (!wasCanceled) {
                      logServerError('generation_validation_failed', e);
                    }
                    await rollbackGenerationCharge();
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          status: 'error',
                          message: wasCanceled
                            ? 'Recipe generation canceled.'
                            : 'Recipe failed validation. Please try again.',
                        })}\n\n`
                      )
                    );
                  }
                  controller.close();
                  modelStream.cleanup();
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  buffer += parsed?.choices?.[0]?.delta?.content ?? '';
                  const progressData = JSON.stringify({
                    status: 'processing',
                    message: 'Generating recipe...',
                  });
                  controller.enqueue(encoder.encode(`data: ${progressData}\n\n`));
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (error) {
          logServerError('generation_stream_failed', error);
          modelStream.abort();
          modelStream.cleanup();
          await rollbackGenerationCharge();
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ status: 'error', message: 'Stream failed' })}\n\n`
            )
          );
          controller.close();
          return;
        }

        modelStream.cleanup();
        await rollbackGenerationCharge();
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ status: 'error', message: 'Recipe generation ended early. Please try again.' })}\n\n`
          )
        );
        controller.close();
      },
      async cancel() {
        modelStream.abort();
        modelStream.cleanup();
        await rollbackGenerationCharge();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    logServerError('generation_request_failed', error);
    return NextResponse.json(
      { error: 'Failed to generate recipe' },
      { status: 500 }
    );
  }
}
