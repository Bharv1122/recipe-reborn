import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { AI_CHAT_URL, AI_API_KEY, MODEL_FAST } from '@/lib/ai';
import { extractJsonPayload } from '@/lib/ai-json';
import { lookupNutrients } from '@/lib/usda';

interface NutritionValues {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
}

interface ParsedIngredient {
  name: string;
  grams: number;
}

// Minimum share of total ingredient weight that must resolve against USDA
// before we trust the hybrid sum over the pure-AI estimate.
const MIN_USDA_COVERAGE = 0.6;

async function callGemini(system: string, user: string): Promise<string> {
  const response = await fetch(AI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL_FAST,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      // gemini-2.5-flash thinking tokens count against this budget
      max_tokens: 6000,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

function parseJsonReply(content: string): any {
  return JSON.parse(extractJsonPayload(content));
}

// Step 1 of the hybrid path: Gemini turns free-form ingredient lines into
// generic food names + gram weights that USDA search can resolve.
async function parseIngredients(
  freshIngredients: string
): Promise<ParsedIngredient[]> {
  const prompt = `Parse each recipe ingredient line into a generic food name and its total weight in grams.

**Ingredients:**
${freshIngredients}

Rules:
- "name": a short generic food name as it would appear in the USDA food database (e.g. "chicken breast", "olive oil", "all-purpose flour"). No brands. Drop cutting/prep words ("chopped", "minced", "fresh"), but KEEP words that change the food's nutrition ("dried", "cooked", "canned", "powder").
- "grams": estimated total edible grams used in the whole recipe. Convert volumes and counts using typical values (1 cup flour ≈ 120 g, 1 tbsp oil ≈ 14 g, 1 medium onion ≈ 110 g, 1 large egg ≈ 50 g).
- Skip water entirely. For "to taste" seasonings estimate a small amount (salt ≈ 1 g).

Return JSON:
{"ingredients": [{"name": "...", "grams": <number>}, ...]}`;

  const content = await callGemini(
    'You parse recipe ingredients into structured data. Return only valid JSON without any markdown formatting or code blocks.',
    prompt
  );

  const parsed = parseJsonReply(content);
  if (!Array.isArray(parsed?.ingredients)) return [];

  return parsed.ingredients.filter(
    (i: any): i is ParsedIngredient =>
      typeof i?.name === 'string' &&
      i.name.trim() !== '' &&
      typeof i?.grams === 'number' &&
      isFinite(i.grams) &&
      i.grams > 0
  );
}

// Hybrid estimate: Gemini parses ingredients, USDA supplies real per-100g
// nutrients, we sum and divide by servings. Returns null when USDA coverage
// is too thin to trust (caller falls back to the pure-AI estimate).
async function usdaHybridEstimate(
  freshIngredients: string,
  servings: number
): Promise<NutritionValues | null> {
  const ingredients = await parseIngredients(freshIngredients);
  if (ingredients.length === 0) return null;

  console.log(
    `[nutrition] parsed: ${ingredients.map((i) => `${i.name}=${i.grams}g`).join(', ')}`
  );

  const lookups = await Promise.all(
    ingredients.map((ing) => lookupNutrients(ing.name))
  );

  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 };
  let totalGrams = 0;
  let matchedGrams = 0;

  ingredients.forEach((ing, i) => {
    totalGrams += ing.grams;
    const per100g = lookups[i];
    if (!per100g) return;

    const factor = ing.grams / 100;
    totals.calories += per100g.calories * factor;
    totals.protein += per100g.protein * factor;
    totals.carbs += per100g.carbs * factor;
    totals.fat += per100g.fat * factor;
    totals.fiber += per100g.fiber * factor;
    totals.sodium += per100g.sodium * factor;
    matchedGrams += ing.grams;
  });

  const coverage = totalGrams > 0 ? matchedGrams / totalGrams : 0;
  if (coverage < MIN_USDA_COVERAGE || totals.calories <= 0) {
    console.log(
      `[nutrition] USDA coverage too low (${Math.round(coverage * 100)}% of ${ingredients.length} ingredients) — falling back to AI estimate`
    );
    return null;
  }

  console.log(
    `[nutrition] USDA hybrid: ${Math.round(coverage * 100)}% coverage across ${ingredients.length} ingredients`
  );

  return {
    // calories/sodium are Int columns; protein/carbs/fat/fiber are Float
    calories: Math.round(totals.calories / servings),
    protein: Math.round((totals.protein / servings) * 10) / 10,
    carbs: Math.round((totals.carbs / servings) * 10) / 10,
    fat: Math.round((totals.fat / servings) * 10) / 10,
    fiber: Math.round((totals.fiber / servings) * 10) / 10,
    sodium: Math.round(totals.sodium / servings),
  };
}

// Fallback: the original pure-Gemini estimate.
async function geminiEstimate(
  title: string,
  freshIngredients: string,
  instructions: string,
  servings: number
): Promise<NutritionValues> {
  const prompt = `Analyze the nutritional content of this recipe and provide estimates per serving:

**Recipe: ${title}**
**Servings: ${servings}**

**Ingredients:**
${freshIngredients}

**Instructions:**
${instructions}

Provide nutritional estimates per serving in JSON format:
{
  "calories": <number in kcal>,
  "protein": <number in grams>,
  "carbs": <number in grams>,
  "fat": <number in grams>,
  "fiber": <number in grams>,
  "sodium": <number in mg>
}

Be as accurate as possible based on standard nutritional data for these ingredients.`;

  const content = await callGemini(
    'You are a nutritionist analyzing recipes. Return only valid JSON without any markdown formatting or code blocks.',
    prompt
  );

  let nutrition;
  try {
    nutrition = parseJsonReply(content);
  } catch (parseError) {
    console.error('Failed to parse nutrition response:', content);
    throw new Error('Failed to parse nutrition data from AI response');
  }

  return {
    calories: Math.round(Number(nutrition.calories) || 0),
    protein: Number(nutrition.protein) || 0,
    carbs: Number(nutrition.carbs) || 0,
    fat: Number(nutrition.fat) || 0,
    fiber: Number(nutrition.fiber) || 0,
    sodium: Math.round(Number(nutrition.sodium) || 0),
  };
}

// POST /api/recipes/[id]/nutrition - Get or generate nutrition information for a recipe
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the recipe
    const recipe = await prisma.recipe.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // If nutrition already exists, return it
    if (recipe.calories) {
      return NextResponse.json({
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: recipe.fat,
        fiber: recipe.fiber,
        sodium: recipe.sodium,
        perServing: true,
      });
    }

    const servings = Math.max(1, parseInt(recipe.servings || '1') || 1);

    // Hybrid first (real USDA data), pure-AI estimate as fallback
    let nutrition: NutritionValues | null = null;
    try {
      nutrition = await usdaHybridEstimate(recipe.freshIngredients, servings);
    } catch (hybridError) {
      console.error('USDA hybrid estimate failed:', hybridError);
    }

    if (!nutrition) {
      nutrition = await geminiEstimate(
        recipe.title,
        recipe.freshIngredients,
        recipe.instructions,
        servings
      );
    }

    // Update the recipe with nutrition data
    const updatedRecipe = await prisma.recipe.update({
      where: { id: params.id },
      data: {
        calories: nutrition.calories || null,
        protein: nutrition.protein || null,
        carbs: nutrition.carbs || null,
        fat: nutrition.fat || null,
        fiber: nutrition.fiber || null,
        sodium: nutrition.sodium || null,
      },
    });

    return NextResponse.json({
      calories: updatedRecipe.calories,
      protein: updatedRecipe.protein,
      carbs: updatedRecipe.carbs,
      fat: updatedRecipe.fat,
      fiber: updatedRecipe.fiber,
      sodium: updatedRecipe.sodium,
      perServing: true,
    });
  } catch (error) {
    console.error('Error analyzing nutrition:', error);
    return NextResponse.json(
      { error: 'Failed to analyze nutrition' },
      { status: 500 }
    );
  }
}
