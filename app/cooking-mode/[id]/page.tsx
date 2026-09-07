import { getVerifiedServerSession } from '@/lib/verified-session';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { CookingModeClient } from './_components/cooking-mode-client';
import { parseStoredRecipeList } from '@/lib/recipe-list';

export const dynamic = 'force-dynamic';

export default async function CookingModePage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const { session, invalidSession } = await getVerifiedServerSession();

  if (!session?.user?.id) {
    redirect(invalidSession ? '/login?error=SessionExpired' : '/login');
  }

  const recipe = await prisma.recipe.findFirst({
    where: {
      id: params.id,
      userId: session.user.id,
    },
  });

  if (!recipe) {
    redirect('/recipes');
  }

  return (
    <CookingModeClient
      recipe={{
        id: recipe.id,
        title: recipe.title,
        ingredients: parseStoredRecipeList(recipe.freshIngredients),
        steps: parseStoredRecipeList(recipe.instructions),
        prepTime: recipe.prepTime ?? undefined,
        cookTime: recipe.cookTime ?? undefined,
        servings: recipe.servings ?? undefined,
      }}
    />
  );
}
