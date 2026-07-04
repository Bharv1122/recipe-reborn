import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { AI_CHAT_URL, AI_API_KEY, MODEL_SMART } from '@/lib/ai';

// POST /api/meal-plans/generate - AI generate a weekly meal plan
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      weekStartDate,
      dietaryPreferences = [],
      calorieTarget,
      mealsPerDay = 3,
      servings = 2,
    } = await req.json();

    if (!weekStartDate) {
      return NextResponse.json(
        { error: 'Week start date is required' },
        { status: 400 }
      );
    }

    // Build AI prompt for meal plan generation
    const dietaryInfo = dietaryPreferences.length > 0
      ? `Dietary preferences: ${dietaryPreferences.join(', ')}`
      : 'No specific dietary restrictions';

    const calorieInfo = calorieTarget
      ? `Target daily calories: ${calorieTarget}`
      : 'No specific calorie target';

    const prompt = `You are a professional meal planning nutritionist. Create a balanced weekly meal plan with the following requirements:

- Week starting: ${new Date(weekStartDate).toLocaleDateString()}
- ${dietaryInfo}
- ${calorieInfo}
- ${mealsPerDay} meals per day (breakfast, lunch, dinner${mealsPerDay > 3 ? ', and snacks' : ''})
- ${servings} servings per recipe

For each day (Monday through Sunday), suggest ${mealsPerDay} recipes that:
1. Are balanced and nutritious
2. Use varied ingredients throughout the week
3. Are practical and achievable for home cooking
4. Match the dietary preferences

Return your response as a JSON array with this structure:
[
  {
    "day": "monday",
    "breakfast": {
      "title": "Recipe name",
      "ingredients": ["ingredient 1", "ingredient 2"],
      "instructions": "Step-by-step instructions",
      "prepTime": "15 min",
      "cookTime": "20 min",
      "servings": "${servings}",
      "dietaryTags": ["vegetarian"],
      "estimatedCalories": 400
    },
    "lunch": { ... },
    "dinner": { ... }
  },
  ...
]

Ensure the JSON is valid and properly formatted.`;

    // Call LLM API
    const response = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL_SMART,
        messages: [
          {
            role: 'system',
            content: 'You are a professional meal planning nutritionist. Return only valid JSON without any markdown formatting or code blocks.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate meal plan');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';

    // Parse the AI response
    let weekPlan;
    try {
      // Remove markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      weekPlan = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse meal plan from AI response');
    }

    // Create meal plan in database
    const mealPlan = await prisma.mealPlan.create({
      data: {
        userId: session.user.id,
        name: `Meal Plan - Week of ${new Date(weekStartDate).toLocaleDateString()}`,
        weekStartDate: new Date(weekStartDate),
        description: `AI-generated meal plan. ${dietaryInfo}. ${calorieInfo}.`,
      },
    });

    // Create recipes and add them to the meal plan
    const mealPlanRecipes = [];
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];

    for (const dayPlan of weekPlan) {
      const day = dayPlan.day.toLowerCase();

      for (const mealType of mealTypes) {
        const meal = dayPlan[mealType];
        if (!meal) continue;

        // Create the recipe
        const recipe = await prisma.recipe.create({
          data: {
            userId: session.user.id,
            title: meal.title,
            originalIngredients: meal.ingredients.join('\n'),
            freshIngredients: meal.ingredients.join('\n'),
            instructions: meal.instructions,
            prepTime: meal.prepTime || '',
            cookTime: meal.cookTime || '',
            servings: meal.servings || String(servings),
            dietaryTags: meal.dietaryTags || dietaryPreferences,
            calories: meal.estimatedCalories || null,
          },
        });

        // Add to meal plan
        const mealPlanRecipe = await prisma.mealPlanRecipe.create({
          data: {
            mealPlanId: mealPlan.id,
            recipeId: recipe.id,
            day,
            mealType,
            servings,
          },
          include: {
            recipe: true,
          },
        });

        mealPlanRecipes.push(mealPlanRecipe);
      }
    }

    // Fetch the complete meal plan with all recipes
    const completeMealPlan = await prisma.mealPlan.findUnique({
      where: { id: mealPlan.id },
      include: {
        mealPlanRecipes: {
          include: {
            recipe: true,
          },
          orderBy: [
            { day: 'asc' },
            { order: 'asc' },
          ],
        },
      },
    });

    return NextResponse.json(completeMealPlan, { status: 201 });
  } catch (error) {
    console.error('Error generating meal plan:', error);
    return NextResponse.json(
      { error: 'Failed to generate meal plan' },
      { status: 500 }
    );
  }
}