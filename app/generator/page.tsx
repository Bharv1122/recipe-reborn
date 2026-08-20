import { getVerifiedServerSession } from '@/lib/verified-session';
import { redirect } from 'next/navigation';
import { RecipeGenerator } from './_components/recipe-generator';
import { PartnerWelcome } from '@/app/_components/partner-welcome';
import { prisma } from '@/lib/db';

export default async function GeneratorPage() {
  const { session, invalidSession } = await getVerifiedServerSession();

  if (!session) {
    redirect(invalidSession ? '/login?error=SessionExpired' : '/login');
  }

  const [savedRecipeCount, recentRecipes] = await Promise.all([
    prisma.recipe.count({ where: { userId: session.user.id } }),
    prisma.recipe.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { originalIngredients: true, createdAt: true },
    }),
  ]);
  const recentIngredients = Array.from(new Set(
    recentRecipes.map((recipe) => recipe.originalIngredients.trim()).filter(Boolean)
  ));
  const daysSinceLastRecipe = recentRecipes[0]
    ? Math.floor((Date.now() - recentRecipes[0].createdAt.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Transform Processed to <span className="text-orange-300">Fresh</span>
          </h1>
          <p className="text-lg text-emerald-50/90">
            Enter your processed food ingredients and let AI create a healthy, fresh recipe for you.
          </p>
        </div>
        {/* Greets a partner-offer member once, on the page they land on
            straight after signup. */}
        <PartnerWelcome />
        <RecipeGenerator
          savedRecipeCount={savedRecipeCount}
          recentIngredients={recentIngredients}
          daysSinceLastRecipe={daysSinceLastRecipe}
        />
      </div>
    </div>
  );
}
