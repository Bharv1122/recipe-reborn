'use client';

import { useEffect, useRef } from 'react';
import { reportClientError } from '@/lib/report-client-error';

export default function GlobalError({
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
    reportClientError('global', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
          <h1 className="text-3xl font-bold text-gray-950">Recipe Reborn needs a fresh start</h1>
          <p className="mt-3 text-gray-700">
            Nothing was saved or changed. Reload the app to continue.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 min-h-11 rounded-md bg-emerald-700 px-5 py-2 font-semibold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
          >
            Reload Recipe Reborn
          </button>
        </main>
      </body>
    </html>
  );
}
