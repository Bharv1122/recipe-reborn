import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { AI_CHAT_URL, AI_API_KEY, MODEL_SMART } from '@/lib/ai';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

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

    if (!ingredients) {
      return NextResponse.json(
        { error: 'Ingredients are required' },
        { status: 400 }
      );
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
    // first real payment (prevents stockpiling recipes on a free trial)
    const TRIAL_LIMIT = 15;
    const isTrialing =
      user.subscriptionTier !== 'free' && user.subscriptionStatus === 'trialing';
    const limit = isTrialing
      ? TRIAL_LIMIT
      : TIER_LIMITS[user.subscriptionTier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free;

    if (user.generationCount >= limit) {
      return NextResponse.json(
        {
          error: 'Generation limit reached',
          limit,
          current: user.generationCount,
          tier: user.subscriptionTier,
          message: isTrialing
            ? `Your free trial includes ${TRIAL_LIMIT} recipes. Your full 100 per month unlocks when your trial converts to Premium.`
            : user.subscriptionTier === 'free'
              ? 'You have reached your free tier limit of 3 recipes per month. Upgrade to Premium for 100 recipes per month.'
              : `You have reached your ${user.subscriptionTier} tier limit of ${limit} recipes this month.`,
        },
        { status: 403 }
      );
    }

    // Increment generation count
    await prisma.user.update({
      where: { id: user.id },
      data: {
        generationCount: { increment: 1 },
      },
    });

    // Reserve the quota slot up front to keep concurrent requests within the
    // tier limit, but give it back if the model or stream fails.
    let generationSlotSettled = false;
    const releaseGenerationSlot = async () => {
      if (generationSlotSettled) return;
      generationSlotSettled = true;
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { generationCount: { decrement: 1 } },
        });
      } catch (releaseError) {
        console.error('Failed to release recipe generation quota:', releaseError);
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

For the cost fields, estimate using average US grocery prices: "estimatedCostPerServing" is the cost in USD to make one serving of this recipe from the fresh ingredients, and "storeBoughtCost" is the cost in USD of one serving of the equivalent store-bought/packaged product. Both must be plain numbers (not strings), rounded to 2 decimal places.

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

For the cost fields, estimate using average US grocery prices: "estimatedCostPerServing" is the cost in USD to make one serving of this recipe from the fresh ingredients, and "storeBoughtCost" is the cost in USD of one serving of the equivalent store-bought/packaged product. Both must be plain numbers (not strings), rounded to 2 decimal places.

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;
    } else if (source === 'pantry') {
      prompt = `You are a professional chef helping users cook with what they already have at home.

The user has these ingredients on hand in their pantry/fridge: ${ingredients}

Create a delicious, healthy recipe that primarily uses these on-hand ingredients. You may assume basic staples (salt, pepper, cooking oil, water). Minimize ingredients they would need to buy — if something extra is truly needed, keep it to one or two common items and mark each as "(optional)" or "(if you have it)" in the ingredient line. Provide clear, step-by-step instructions.

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

For the cost fields, estimate using average US grocery prices: "estimatedCostPerServing" is the cost in USD of one serving of this recipe, and "storeBoughtCost" is the cost in USD of one serving of the closest equivalent store-bought, takeout, or packaged version of this dish. Both must be plain numbers (not strings), rounded to 2 decimal places.

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;
    } else {
      prompt = `You are a professional chef helping users create fresh, healthy recipes from processed food ingredients.

The user has these processed food ingredients: ${ingredients}

Create a fresh, healthy recipe using whole, unprocessed ingredients that captures the essence of these processed foods. Provide clear, step-by-step instructions.

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

For the cost fields, estimate using average US grocery prices: "estimatedCostPerServing" is the cost in USD to make one serving of this recipe from the fresh ingredients, and "storeBoughtCost" is the cost in USD of one serving of the equivalent store-bought/packaged product. Both must be plain numbers (not strings), rounded to 2 decimal places.

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
        // Gemini 2.5 thinking tokens count against this budget; cost estimation
        // added in Phase 3e needs the extra headroom or the JSON gets truncated
        max_tokens: 6000,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
      }),
    };

    const fetchModelResponse = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 52_000);
      try {
        return await fetch(AI_CHAT_URL, { ...llmRequest, signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
    };

    let response: Response;
    try {
      response = await fetchModelResponse();
    } catch (modelError) {
      await releaseGenerationSlot();
      throw modelError;
    }

    if (!response?.ok) {
      const errText = await response.text().catch(() => '');
      console.error('LLM API non-OK response:', response.status, errText.slice(0, 500));
      // Gemini occasionally returns transient 429/5xx — one retry recovers most of them
      if (response.status === 429 || response.status >= 500) {
        try {
          response = await fetchModelResponse();
        } catch (modelError) {
          await releaseGenerationSlot();
          throw modelError;
        }
      }
    }

    if (!response?.ok) {
      const errText = await response.text().catch(() => '');
      console.error('LLM API retry also failed:', response.status, errText.slice(0, 500));
      await releaseGenerationSlot();
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
                    const finalData = JSON.stringify({
                      status: 'completed',
                      result: finalResult,
                    });
                    controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
                    generationSlotSettled = true;
                  } catch (e) {
                    console.error('Error parsing final JSON:', e);
                    await releaseGenerationSlot();
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ status: 'error', message: 'Recipe failed validation. Please try again.' })}\n\n`
                      )
                    );
                  }
                  controller.close();
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
          console.error('Stream error:', error);
          await releaseGenerationSlot();
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ status: 'error', message: 'Stream failed' })}\n\n`
            )
          );
          controller.close();
          return;
        }

        await releaseGenerationSlot();
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ status: 'error', message: 'Recipe generation ended early. Please try again.' })}\n\n`
          )
        );
        controller.close();
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
    console.error('Generate recipe error:', error);
    return NextResponse.json(
      { error: 'Failed to generate recipe' },
      { status: 500 }
    );
  }
}
