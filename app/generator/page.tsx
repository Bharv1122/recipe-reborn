import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { RecipeGenerator } from './_components/recipe-generator';

export default async function GeneratorPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-orange-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Transform Processed to <span className="bg-gradient-to-r from-emerald-600 to-orange-500 bg-clip-text text-transparent">Fresh</span>
          </h1>
          <p className="text-lg text-gray-600">
            Enter your processed food ingredients and let AI create a healthy, fresh recipe for you.
          </p>
        </div>
        <RecipeGenerator />
      </div>
    </div>
  );
}