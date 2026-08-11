'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { reportClientError } from '@/lib/report-client-error';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    reportClientError('route', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-gray-950">That page hit a snag</h1>
      <p className="mt-3 text-gray-700">
        Your recipes and account data were not changed. Try loading this page again, or return home.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset} className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800">
          Try again
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/">Return home</Link>
        </Button>
      </div>
    </main>
  );
}
