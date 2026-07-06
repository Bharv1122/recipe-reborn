import { SignupForm } from './_components/signup-form';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';

export default function SignupPage({
  searchParams,
}: {
  searchParams?: { unlock?: string };
}) {
  const fromUnlock = Boolean(searchParams?.unlock);

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center space-x-2 group">
            <Image src="/logo-mark.png" alt="Recipe Reborn emblem" width={48} height={48} className="h-12 w-12 rounded-full shadow-md group-hover:scale-105 transition-transform" />
            <Image src="/logo-text-hero.png" alt="Recipe Reborn" width={220} height={52} className="h-12 w-auto" />
          </Link>
          <h2 className="mt-6 text-3xl font-extrabold text-white">
            {fromUnlock ? 'Unlock your fresh recipe' : 'Create your account'}
          </h2>
          <p className="mt-2 text-sm text-emerald-50/90">
            {fromUnlock
              ? 'Your recipe is waiting on the other side.'
              : 'Save your fresh recipes, track your savings, cook real food.'}
          </p>
        </div>

        {fromUnlock && (
          <div className="rounded-xl border border-emerald-300/60 bg-white/10 backdrop-blur px-4 py-3 text-center">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-white">
              <Sparkles className="h-4 w-4 text-orange-300" />
              You&apos;re one step from the full ingredient list, instructions &amp; your savings
            </p>
          </div>
        )}

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
        <p className="text-center text-xs text-emerald-50/70">
          Free to start · 3 recipes a month · no card required
        </p>
      </div>
    </div>
  );
}
