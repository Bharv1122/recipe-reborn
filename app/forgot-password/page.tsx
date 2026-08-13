import Link from 'next/link';
import Image from 'next/image';
import { ForgotPasswordForm } from './_components/forgot-password-form';

export default function ForgotPasswordPage() {
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
            Forgot your password?
          </h2>
          <p className="mt-2 text-sm text-emerald-50/90">
            Enter your email and we'll send you a link to choose a new one.
          </p>
        </div>
        <ForgotPasswordForm />
        <div className="text-center text-sm">
          <span className="text-emerald-50/90">Remembered it? </span>
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
