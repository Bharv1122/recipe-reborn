import { SignupForm } from './_components/signup-form';
import Link from 'next/link';
import { ChefHat } from 'lucide-react';
import Image from 'next/image';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center space-x-2 group">
            <ChefHat className="h-12 w-12 text-white group-hover:text-orange-300 transition-colors" />
            <Image src="/logo-text-hero.png" alt="Recipe Reborn" width={220} height={52} className="h-12 w-auto" />
          </Link>
          <h2 className="mt-6 text-3xl font-extrabold text-white">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-emerald-50/90">
            Start transforming processed foods into fresh recipes
          </p>
        </div>
        <SignupForm />
        <div className="text-center text-sm">
          <span className="text-emerald-50/90">Already have an account? </span>
          <Link
            href="/login"
            className="font-medium text-orange-300 hover:text-orange-200"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}