import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { MODEL_FAST } from '@/lib/ai';
import { recipeChat } from '@/lib/ai-provider';
import { limitAiRequest } from '@/lib/ai-rate-limit';
import { parseStoredRecipeList } from '@/lib/recipe-list';

// POST /api/recipes/[id]/scale - Scale a recipe
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const aiLimited = await limitAiRequest(session.user.id);
    if (aiLimited) return aiLimited;

    const { scaleFactor } = await req.json();

    if (typeof scaleFactor !== 'number' || !Number.isFinite(scaleFactor) || scaleFactor <= 0) {
      return NextResponse.json(
        { error: 'Valid scale factor is required' },
        { status: 400 }
      );
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

    // Use AI to scale the ingredients
    const prompt = `Scale the following recipe ingredients by a factor of ${scaleFactor}x:

${recipe.freshIngredients}

Return ONLY the scaled ingredients list, one per line, maintaining the same format. Be precise with measurements.

For example, if scaling by 2x:
- "1 cup flour" becomes "2 cups flour"
- "1/2 tsp salt" becomes "1 tsp salt"
- "3 eggs" becomes "6 eggs"`;

    const response = await recipeChat(
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: req.signal,
        body: JSON.stringify({
          model: MODEL_FAST,
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful cooking assistant. Scale recipe ingredients accurately.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      },
      { totalMs: 45_000 }
    );

    if (!response.ok) {
      throw new Error('Failed to scale recipe');
    }

    const data = await response.json();
    const choice = data?.choices?.[0];
    // A refused, truncated or unfinished answer is a failure, never the
    // unscaled original presented as scaled.
    if (choice?.finish_reason !== 'stop' || choice?.message?.refusal || typeof choice?.message?.content !== 'string') {
      throw new Error('Scale provider did not complete its response');
    }
    const scaledIngredients = choice.message.content.trim();
    const originalCount = parseStoredRecipeList(recipe.freshIngredients).length;
    if (!scaledIngredients || parseStoredRecipeList(scaledIngredients).length !== originalCount) {
      throw new Error('Scaled ingredients did not match the recipe');
    }

    // Calculate scaled servings
    const originalServings = parseInt(recipe.servings || '1');
    const scaledServings = Math.round(originalServings * scaleFactor);

    // Nutrition is stored and displayed per serving. Scaling both the ingredient
    // amounts and serving count keeps those per-serving values unchanged.
    const scaledNutrition: Record<string, number> = {};
    if (recipe.calories !== null) scaledNutrition.calories = recipe.calories;
    if (recipe.protein !== null) scaledNutrition.protein = recipe.protein;
    if (recipe.carbs !== null) scaledNutrition.carbs = recipe.carbs;
    if (recipe.fat !== null) scaledNutrition.fat = recipe.fat;
    if (recipe.fiber !== null) scaledNutrition.fiber = recipe.fiber;
    if (recipe.sodium !== null) scaledNutrition.sodium = recipe.sodium;

    return NextResponse.json({
      scaledIngredients,
      scaledServings: scaledServings.toString(),
      scaleFactor,
      nutrition: scaledNutrition,
    });
  } catch (error) {
    if (req.signal.aborted) return new NextResponse(null, { status: 499 });
    console.error('Error scaling recipe:', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to scale recipe' },
      { status: 500 }
    );
  }
}
