import { cache } from 'react';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

type VerifiedSessionResult = {
  session: Session | null;
  invalidSession: boolean;
};

/**
 * A signed JWT can outlive its database row after an account deletion or
 * database restore. Verify the row once per server render so protected pages
 * never mount with an orphaned session and start a cascade of misleading 404s.
 */
export const getVerifiedServerSession = cache(
  async (): Promise<VerifiedSessionResult> => {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return { session: null, invalidSession: Boolean(session) };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });

    if (!user) {
      return { session: null, invalidSession: true };
    }

    return { session, invalidSession: false };
  }
);
