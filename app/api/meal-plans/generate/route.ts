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
      allergies: allergiesOverride,
      dislikedIngredients: dislikesOverride,
    } = await req.json();

    if (!weekStartDate) {
      return NextResponse.json(
        { error: 'Week start date is required' },
        { status: 400 }
      );
    }

    // Per-plan override wins; otherwise fall back to the profile's saved preferences
    const profile = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        allergies: true,
        dislikedIngredients: true,
        subscriptionTier: true,
        subscriptionStatus: true,
      },
    });

    // Meal planning is a Premium feature ('pro' = grandfathered legacy tier)
    const tier = profile?.subscriptionTier ?? 'free';
    if (tier !== 'premium' && tier !== 'pro') {
      return NextResponse.json(
        {
          error: 'Premium feature',
          message:
            'AI weekly meal plans are a Premium feature. Upgrade for $9.99/mo — your first 7 days are free.',
        },
        { status: 403 }
      );
    }

    // Trial cap: each plan is 21 recipes, so limit trials to 2 plans
    const TRIAL_MEAL_PLAN_LIMIT = 2;
    if (profile?.subscriptionStatus === 'trialing') {
      const planCount = await prisma.mealPlan.count({
        where: { userId: session.user.id },
      });
      if (planCount >= TRIAL_MEAL_PLAN_LIMIT) {
        return NextResponse.json(
          {
            error: 'Trial limit reached',
            message: `Your free trial includes ${TRIAL_MEAL_PLAN_LIMIT} meal plans. Unlimited plans unlock when your trial converts to Premium.`,
          },
          { status: 403 }
        );
      }
    }
    const allergies: string[] = Array.isArray(allergiesOverride)
      ? allergiesOverride.filter((a: unknown) => typeof a === 'string' && a.trim())
      : profile?.allergies ?? [];
    const dislikedIngredients: string[] = Array.isArray(dislikesOverride)
      ? dislikesOverride.filter((d: unknown) => typeof d === 'string' && d.trim())
      : profile?.dislikedIngredients ?? [];

    // Build AI prompt for meal plan generation
    const dietaryInfo = dietaryPreferences.length > 0
      ? `Dietary preferences: ${dietaryPreferences.join(', ')}`
      : 'No specific dietary restrictions';

    const calorieInfo = calorieTarget
      ? `Target daily calories: ${calorieTarget}`
      : 'No specific calorie target';

    const allergyInfo = allergies.length > 0
      ? `CRITICAL — FOOD ALLERGIES: allergic to ${allergies.join(', ')}. NEVER include these ingredients or anything derived from them, in any form, in any meal.`
      : '';
    const dislikeInfo = dislikedIngredients.length > 0
      ? `DISLIKED INGREDIENTS: dislikes ${dislikedIngredients.join(', ')}. Avoid them unless truly essential; prefer substitutes.`
      : '';

    const prompt = `You are a professional meal planning nutritionist. Create a balanced weekly meal plan with the following requirements:

- Week starting: ${new Date(weekStartDate).toLocaleDateString()}
- ${dietaryInfo}
- ${calorieInfo}
- ${mealsPerDay} meals per day (breakfast, lunch, dinner${mealsPerDay > 3 ? ', and snacks' : ''})
- ${servings} servings per recipe${allergyInfo ? `\n- ${allergyInfo}` : ''}${dislikeInfo ? `\n- ${dislikeInfo}` : ''}

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
        // 21 full recipes ≈ 8-10k output tokens, and gemini-2.5-flash thinking
        // tokens also count against this budget — 8000 truncated mid-JSON.
        max_tokens: 24000,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate meal plan');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    if (data.choices[0]?.finish_reason === 'length') {
      console.error('Meal plan response truncated at max_tokens; content length:', content.length);
    }

    // Parse the AI response
    let weekPlan;
    try {
      // Strip markdown code fences — including an unterminated opening fence
      // (a truncated response never closes it, which broke the old regex)
      let jsonStr = content.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      jsonStr = fenceMatch ? fenceMatch[1] : jsonStr.replace(/^```(?:json)?\s*/, '');
      // Extract the JSON array to guard against surrounding prose
      const start = jsonStr.indexOf('[');
      const end = jsonStr.lastIndexOf(']');
      if (start !== -1 && end > start) {
        jsonStr = jsonStr.slice(start, end + 1);
      }
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