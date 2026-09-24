import { ApiError, apiRequest } from '@/services/api';
import { clearTokens, getSessionRevision, readCachedUser, readTokens, saveCachedUser } from '@/services/auth-storage';
import type { MobileUser } from '@/types';

export async function restoreStoredSession(): Promise<MobileUser | null> {
  const revision = getSessionRevision();
  if (!await readTokens()) return null;
  try {
    if (revision !== getSessionRevision()) return null;
    const data = await apiRequest<{ user: MobileUser }>('/api/mobile/auth/me');
    if (!await saveCachedUser(data.user, revision)) return null;
    return data.user;
  } catch (error) {
    if (revision !== getSessionRevision()) return null;
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      await clearTokens(revision);
      return null;
    }
    // Offline cached identity only opens the client. Every connected operation
    // still uses the server's token, entitlement and owner checks.
    const cached = await readCachedUser();
    return revision === getSessionRevision() ? cached : null;
  }
}
