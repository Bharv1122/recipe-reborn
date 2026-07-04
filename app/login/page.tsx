import { LoginForm } from './_components/login-form';
import Link from 'next/link';
import Image from 'next/image';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-block group">
            <Image
              src="/logo.png"
              alt="Recipe Reborn"
              width={300}
              height={300}
              priority
              className="mx-auto w-56 sm:w-64 h-auto group-hover:scale-[1.02] transition-transform [mask-image:radial-gradient(ellipse_74%_74%_at_50%_48%,black_66%,transparent_97%)]"
            />
          </Link>
          <h2 className="mt-2 text-3xl font-extrabold text-white">
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