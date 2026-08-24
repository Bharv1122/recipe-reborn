import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';

/**
 * Allows an existing web API to accept the original NextAuth cookie or a
 * native bearer token without changing the authorization decision itself.
 * If a bearer header is present but invalid, never fall back to a cookie.
 */
export async function getRequestUserId(request: Request): Promise<string | null> {
  if (request.headers.get('authorization')) {
    try {
      return requireMobileUserId(request);
    } catch (error) {
      if (error instanceof MobileAuthError) return null;
      throw error;
    }
  }

  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}
