'use client';

import { useEffect } from 'react';
import { SessionProvider, signOut } from 'next-auth/react';
import type { Session } from 'next-auth';
import { ThemeProvider } from '@/components/theme-provider';

function InvalidSessionRecovery({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;

    // Clear the orphaned JWT before redirecting. A plain client-side redirect
    // would leave middleware treating the visitor as authenticated forever.
    void signOut({ callbackUrl: '/login?error=SessionExpired' });
  }, [active]);

  return null;
}

export function Providers({
  children,
  session,
  invalidSession = false,
}: {
  children: React.ReactNode;
  session: Session | null;
  invalidSession?: boolean;
}) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      <InvalidSessionRecovery active={invalidSession} />
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
