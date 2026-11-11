import { prisma } from '@/lib/db';
import { getVerifiedServerSession } from '@/lib/verified-session';
import { parseStoredRecipeList } from '@/lib/recipe-list';
import { getPublicRecipe } from '@/lib/public-recipes';
import { catalogToKitchenRecipe } from '@/lib/kitchen/recipes';
import type { KitchenRecipe } from '@/lib/kitchen/engine';

export type KitchenLoadResult =
  | { kind: 'ok'; recipe: KitchenRecipe }
  | { kind: 'login'; invalidSession: boolean }
  | { kind: 'missing' };

/**
 * Resolves a /kitchen/[recipeId] id. House catalog ids (and "demo") are public
 * and never touch the database or session. Anything else is a saved recipe
 * and, exactly like /cooking-mode/[id], must belong to the signed-in user.
 */
export async function loadKitchenRecipe(id: string): Promise<KitchenLoadResult> {
  const sample = getPublicRecipe(id);
  if (sample) return { kind: 'ok', recipe: catalogToKitchenRecipe(sample) };

  if (!/^[a-z0-9]{10,40}$/i.test(id)) return { kind: 'missing' };

  const { session, invalidSession } = await getVerifiedServerSession();
  if (!session?.user?.id) return { kind: 'login', invalidSession };

  const recipe = await prisma.recipe.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      title: true,
      freshIngredients: true,
      instructions: true,
      prepTime: true,
      cookTime: true,
      servings: true,
    },
  });
  if (!recipe) return { kind: 'missing' };

  return {
    kind: 'ok',
    recipe: {
      id: recipe.id,
      title: recipe.title,
      ingredients: parseStoredRecipeList(recipe.freshIngredients),
      steps: parseStoredRecipeList(recipe.instructions),
      prepTime: recipe.prepTime ?? undefined,
      cookTime: recipe.cookTime ?? undefined,
      servings: recipe.servings ?? undefined,
      isSample: false,
    },
  };
}
