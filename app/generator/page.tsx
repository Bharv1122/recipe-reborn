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
        <RecipeGenerator />
      </div>
    </div>
  );
}