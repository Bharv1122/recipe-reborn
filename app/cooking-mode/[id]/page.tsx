import { getVerifiedServerSession } from '@/lib/verified-session';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { CookingModeClient } from './_components/cooking-mode-client';

export const dynamic = 'force-dynamic';

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export default async function CookingModePage({
  params,
}: {
  params: { id: string };
}) {
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
        ingredients: parseJsonArray(recipe.freshIngredients),
        steps: parseJsonArray(recipe.instructions),
        prepTime: recipe.prepTime ?? undefined,
        cookTime: recipe.cookTime ?? undefined,
        servings: recipe.servings ?? undefined,
      }}
    />
  );
}
