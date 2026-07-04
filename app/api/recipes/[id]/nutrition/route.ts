import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { AI_CHAT_URL, AI_API_KEY, MODEL_FAST } from '@/lib/ai';

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

    // Use AI to estimate nutrition
    const servings = parseInt(recipe.servings || '1');
    const prompt = `Analyze the nutritional content of this recipe and provide estimates per serving:

**Recipe: ${recipe.title}**
**Servings: ${servings}**

**Ingredients:**
${recipe.freshIngredients}

**Instructions:**
${recipe.instructions}

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
                'You are a nutritionist analyzing recipes. Return only valid JSON without any markdown formatting or code blocks.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to analyze nutrition');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';

    // Parse the AI response
    let nutrition;
    try {
      // Remove markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      nutrition = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Failed to parse nutrition response:', content);
      throw new Error('Failed to parse nutrition data from AI response');
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