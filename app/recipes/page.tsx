import { getVerifiedServerSession } from '@/lib/verified-session';
import { redirect } from 'next/navigation';
import { RecipesList } from './_components/recipes-list';

export default async function RecipesPage() {
  const { session, invalidSession } = await getVerifiedServerSession();

  if (!session) {
    redirect(invalidSession ? '/login?error=SessionExpired' : '/login');
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            My Saved <span className="text-orange-300">Recipes</span>
          </h1>
          <p className="text-lg text-emerald-50/90">
            Browse and manage your collection of fresh recipes.
          </p>
        </div>
        <RecipesList />
      </div>
    </div>
  );
}
