import Link from 'next/link';
import Image from 'next/image';
import { ResetPasswordForm } from './_components/reset-password-form';

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
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
            Choose a new password
          </h2>
          <p className="mt-2 text-sm text-emerald-50/90">
            You'll be signed in with it right away.
          </p>
        </div>
        <ResetPasswordForm token={searchParams?.token} />
        <div className="text-center text-sm">
          <Link
            href="/login"
            className="font-medium text-orange-300 hover:text-orange-200"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
