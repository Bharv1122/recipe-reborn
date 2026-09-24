import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { useSQLiteContext } from 'expo-sqlite';
import { apiRequest, publicRequest } from '@/services/api';
import { clearRegisteredPushToken, clearTokens, getSessionRevision, readRegisteredPushToken, readTokens, saveCachedUser, saveTokens } from '@/services/auth-storage';
import type { MobileUser, TokenPair } from '@/types';
import { clearShoppingCache } from '@/services/shopping-cache';
import { restoreStoredSession } from '@/services/session-recovery';

interface AuthContextValue {
  user: MobileUser | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, code?: string, adultConfirmed?: boolean): Promise<void>;
  signOut(): Promise<void>;
  refreshAccount(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [user, setUser] = useState<MobileUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAccount = useCallback(async () => {
    const revision = getSessionRevision();
    const data = await apiRequest<{ user: MobileUser }>('/api/mobile/auth/me');
    if (!await saveCachedUser(data.user, revision)) return;
    setUser(data.user);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setUser(await restoreStoredSession());
      } catch {
        // A local storage read failure must not erase an otherwise valid token.
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await publicRequest<{ tokens: TokenPair; user: MobileUser }>('/api/mobile/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        deviceName: Device.deviceName || Device.modelName || undefined,
        platform: Platform.OS,
      }),
    });
    await clearShoppingCache(db);
    await clearTokens();
    await saveTokens(data.tokens);
    await saveCachedUser(data.user);
    setUser(data.user);
  }, [db]);

  const signUp = useCallback(async (email: string, password: string, code?: string, adultConfirmed = false) => {
    await publicRequest('/api/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, confirmPassword: password, code: code || undefined, src: 'mobile', adultConfirmed }),
    });
    await signIn(email, password);
  }, [signIn]);

  const signOut = useCallback(async () => {
    const tokens = await readTokens();
    const pushToken = await readRegisteredPushToken();
    if (pushToken) {
      await apiRequest('/api/mobile/push-tokens', { method: 'DELETE', body: JSON.stringify({ token: pushToken }) }).catch(() => undefined);
      await clearRegisteredPushToken();
    }
    await clearTokens();
    await clearShoppingCache(db);
    setUser(null);
    if (tokens) {
      publicRequest('/api/mobile/auth/logout', {
        method: 'POST', body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      }).catch(() => undefined);
    }
  }, [db]);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut, refreshAccount }),
    [user, loading, signIn, signUp, signOut, refreshAccount],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
