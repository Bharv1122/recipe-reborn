import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';
import { optionalRecipeMetadataSchema } from '@/lib/recipe-metadata-validation';
import { recipeComparisonSchema } from '@/lib/recipe-comparison-validation';
import { LIBRARY_SOURCES } from '@/lib/recipe-library';
import { importedRecipeSnapshotSchema } from '@/lib/import-recipe-adaptation';

export const dynamic = 'force-dynamic';

// JSON clients represent unavailable optional fields as null as well as omission.
const optionalMetadata = z.preprocess(value => value === null ? undefined : value, optionalRecipeMetadataSchema);
const optionalCost = z.number().nonnegative().finite().nullish().transform(value => value ?? undefined);

const saveSchema = z.object({
  title: z.string().trim().min(1).max(200),
  originalIngredients: z.string().trim().min(1).max(50000),
  freshIngredients: z.array(z.string().trim().min(1).max(500)).min(1).max(150),
  instructions: z.array(z.string().trim().min(1).max(3000)).min(1).max(100),
  dietaryTags: z.array(z.string().trim().min(1).max(80)).max(30).nullish().transform(value => value ?? []),
  prepTime: optionalMetadata,
  cookTime: optionalMetadata,
  servings: optionalMetadata,
  estimatedCostPerServing: optionalCost,
  storeBoughtCost: optionalCost,
  comparisonSnapshot: recipeComparisonSchema.optional(),
  librarySource: z.enum(LIBRARY_SOURCES).exclude(['meal_plan']).default('generated'),
  importSourceSnapshot: importedRecipeSnapshotSchema.optional(),
});

export async function GET(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    const recipes = await prisma.recipe.findMany({
      where: { userId, savedAt: { not: null } },
      select: {
        id: true, title: true, dietaryTags: true, prepTime: true, cookTime: true,
        servings: true, rating: true, calories: true, savedAt: true, createdAt: true, updatedAt: true,
        _count: { select: { mealPlanRecipes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ recipes: recipes.map(({ _count, ...recipe }) => ({ ...recipe, usedInMealPlans: _count.mealPlanRecipes > 0 })) });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Mobile recipes error:', error);
    return NextResponse.json({ error: 'Unable to load recipes.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    const parsed = saveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map(issue => String(issue.path[0] ?? 'recipe')))];
      // Log field names only, never a user's recipe or request body.
      console.warn('Mobile recipe validation failed:', fields);
      const labels: Record<string, string> = { title: 'title', originalIngredients: 'original ingredients', freshIngredients: 'ingredients', instructions: 'cooking steps', dietaryTags: 'dietary tags', prepTime: 'prep time', cookTime: 'cook time', servings: 'servings', estimatedCostPerServing: 'cost estimate', storeBoughtCost: 'store price', comparisonSnapshot: 'nutrition comparison', librarySource: 'recipe source', importSourceSnapshot: 'imported source' };
      return NextResponse.json({ error: `Could not save this recipe. Please check: ${fields.map(field => labels[field] ?? 'recipe details').join(', ')}.`, fields }, { status: 400 });
    }
    const recipe = await prisma.recipe.create({
      data: {
        userId,
        ...parsed.data,
        savedAt: new Date(),
        freshIngredients: JSON.stringify(parsed.data.freshIngredients),
        instructions: JSON.stringify(parsed.data.instructions),
        prepTime: parsed.data.prepTime || null,
        cookTime: parsed.data.cookTime || null,
        servings: parsed.data.servings || null,
      },
    });
    return NextResponse.json({ recipe }, { status: 201 });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Mobile save recipe error:', error);
    return NextResponse.json({ error: 'Unable to save recipe.' }, { status: 500 });
  }
}
