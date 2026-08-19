import { NextRequest, NextResponse } from 'next/server';
import { AI_CHAT_URL, AI_API_KEY, MODEL_SMART } from '@/lib/ai';
import { extractJsonPayload } from '@/lib/ai-json';
import { checkGuestLimit } from '@/lib/guest-rate-limit';
import { getClientIp } from '@/lib/rate-limit';

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

    const llmRequest = {
      method: 'POST' as const,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL_SMART,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 6000,
        response_format: { type: 'json_object' },
      }),
    };

    let response = await fetch(AI_CHAT_URL, llmRequest);
    // Retry only transient 5xx/network errors — NOT 429 (retrying into a
    // quota wall just burns more of the shared Gemini budget)
    if (!response.ok && response.status !== 429) {
      response = await fetch(AI_CHAT_URL, llmRequest);
    }
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('Guest generation LLM failed:', response.status, errText.slice(0, 300));
      if (response.status === 429) {
        // Gemini quota is exhausted — degrade gracefully, push to signup
        return NextResponse.json(
          {
            error: 'Busy',
            message:
              "Recipe Reborn is really popular right now — try again in a minute, or sign up free to skip the wait.",
          },
          { status: 503 }
        );
      }
      throw new Error('AI request failed');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    let recipe: GuestRecipe;
    try {
      recipe = parseRecipe(content);
    } catch (parseError) {
      console.warn('Guest generation returned invalid JSON; requesting one compact retry.', {
        length: content.length,
        finishReason: data.choices?.[0]?.finish_reason,
      });

      const retryResponse = await fetch(AI_CHAT_URL, {
        ...llmRequest,
        body: JSON.stringify({
          model: MODEL_SMART,
          messages: [
            { role: 'user', content: prompt },
            {
              role: 'user',
              content:
                'The previous response was incomplete or invalid. Start over and return one complete, compact JSON object only. Use 6 to 10 ingredients and 5 to 7 concise instruction steps.',
            },
          ],
          max_tokens: 6000,
          response_format: { type: 'json_object' },
        }),
      });

      if (!retryResponse.ok) {
        console.error('Guest generation JSON retry failed:', retryResponse.status);
        throw new Error('Could not build a recipe from that — try a fuller ingredient list.');
      }

      const retryData = await retryResponse.json();
      const retryContent = retryData.choices?.[0]?.message?.content ?? '';
      try {
        recipe = parseRecipe(retryContent);
      } catch {
        console.error('Guest generation JSON retry was invalid:', {
          length: retryContent.length,
          finishReason: retryData.choices?.[0]?.finish_reason,
        });
        throw new Error('Could not build a recipe from that — try a fuller ingredient list.');
      }
    }

    const qualityIssues = recipeQualityIssues(recipe);
    if (qualityIssues.length > 0) {
      const repairRequest = {
        ...llmRequest,
        body: JSON.stringify({
          model: MODEL_SMART,
          messages: [
            { role: 'user', content: prompt },
            { role: 'assistant', content: JSON.stringify(recipe) },
            {
              role: 'user',
              content: `Revise the JSON recipe before returning it. Fix every issue below:\n- ${qualityIssues.join('\n- ')}\nReturn raw JSON only.`,
            },
          ],
          max_tokens: 6000,
          response_format: { type: 'json_object' },
        }),
      };

      const repairResponse = await fetch(AI_CHAT_URL, repairRequest);
      if (!repairResponse.ok) {
        console.error('Guest generation quality repair failed:', repairResponse.status);
        throw new Error('Could not build a fully fresh recipe — try another ingredient list.');
      }

      const repairData = await repairResponse.json();
      const repairedContent = repairData.choices?.[0]?.message?.content ?? '';
      recipe = parseRecipe(repairedContent);

      const remainingIssues = recipeQualityIssues(recipe);
      if (remainingIssues.length > 0) {
        console.error('Guest generation failed quality checks:', remainingIssues);
        throw new Error('Could not build a fully fresh recipe — try another ingredient list.');
      }
    }

    return NextResponse.json({ recipe, remaining: limit.remaining });
  } catch (error: any) {
    console.error('Guest generate error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate recipe' },
      { status: 500 }
    );
  }
}
