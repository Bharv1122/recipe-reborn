import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { AI_CHAT_URL, AI_API_KEY, MODEL_FAST } from '@/lib/ai';

// POST /api/recipes/[id]/scale - Scale a recipe
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { scaleFactor } = await req.json();

    if (!scaleFactor || scaleFactor <= 0) {
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

    const response = await fetch(
      AI_CHAT_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AI_API_KEY}`,
        },
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
      }
    );

    if (!response.ok) {
      throw new Error('Failed to scale recipe');
    }

    const data = await response.json();
    const scaledIngredients =
      data.choices[0]?.message?.content?.trim() || recipe.freshIngredients;

    // Calculate scaled servings
    const originalServings = parseInt(recipe.servings || '1');
    const scaledServings = Math.round(originalServings * scaleFactor);

    // Scale nutrition if available
    const scaledNutrition: any = {};
    if (recipe.calories) scaledNutrition.calories = Math.round(recipe.calories * scaleFactor);
    if (recipe.protein) scaledNutrition.protein = Math.round(recipe.protein * scaleFactor * 10) / 10;
    if (recipe.carbs) scaledNutrition.carbs = Math.round(recipe.carbs * scaleFactor * 10) / 10;
    if (recipe.fat) scaledNutrition.fat = Math.round(recipe.fat * scaleFactor * 10) / 10;
    if (recipe.fiber) scaledNutrition.fiber = Math.round(recipe.fiber * scaleFactor * 10) / 10;
    if (recipe.sodium) scaledNutrition.sodium = Math.round(recipe.sodium * scaleFactor);

    return NextResponse.json({
      scaledIngredients,
      scaledServings: scaledServings.toString(),
      scaleFactor,
      nutrition: scaledNutrition,
    });
  } catch (error) {
    console.error('Error scaling recipe:', error);
    return NextResponse.json(
      { error: 'Failed to scale recipe' },
      { status: 500 }
    );
  }
}