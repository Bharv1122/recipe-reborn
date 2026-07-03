import { SignupForm } from './_components/signup-form';
import Link from 'next/link';
import { ChefHat } from 'lucide-react';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-orange-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center space-x-2 group">
            <ChefHat className="h-12 w-12 text-emerald-600 group-hover:text-orange-500 transition-colors" />
            <span className="font-bold text-3xl bg-gradient-to-r from-emerald-600 to-orange-500 bg-clip-text text-transparent">
              RecipeReborn
            </span>
          </Link>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Start transforming processed foods into fresh recipes
          </p>
        </div>
        <SignupForm />
        <div className="text-center text-sm">
          <span className="text-gray-600">Already have an account? </span>
          <Link
            href="/login"
            className="font-medium text-emerald-600 hover:text-emerald-500"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}