import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { RecipesList } from './_components/recipes-list';

export default async function RecipesPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-orange-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            My Saved <span className="bg-gradient-to-r from-emerald-600 to-orange-500 bg-clip-text text-transparent">Recipes</span>
          </h1>
          <p className="text-lg text-gray-600">
            Browse and manage your collection of fresh recipes.
          </p>
        </div>
        <RecipesList />
      </div>
    </div>
  );
}