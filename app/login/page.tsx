import { LoginForm } from './_components/login-form';
import Link from 'next/link';
import { ChefHat } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center space-x-2 group">
            <ChefHat className="h-12 w-12 text-white group-hover:text-orange-300 transition-colors" />
            <Image src="/logo-text-hero.png" alt="Recipe Reborn" width={220} height={52} className="h-12 w-auto" />
          </Link>
          <h2 className="mt-6 text-3xl font-extrabold text-white">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-emerald-50/90">
            Sign in to your account to continue
          </p>
        </div>
        <LoginForm />
        <div className="text-center text-sm">
          <span className="text-emerald-50/90">Don't have an account? </span>
          <Link
            href="/signup"
            className="font-medium text-orange-300 hover:text-orange-200"
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}