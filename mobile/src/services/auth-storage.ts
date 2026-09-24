import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { MobileUser, TokenPair } from '@/types';

const KEY = 'recipe-reborn.mobile-session.v1';
const PUSH_KEY = 'recipe-reborn.mobile-push-token.v1';
const USER_KEY = 'recipe-reborn.mobile-user.v1';
let webSession: TokenPair | null = null;
let webUser: MobileUser | null = null;
let sessionRevision = 0;
let sessionWrites: Promise<unknown> = Promise.resolve();

export function getSessionRevision(): number { return sessionRevision; }

function writeSession<T>(operation: () => Promise<T>): Promise<T> {
  const next = sessionWrites.catch(() => undefined).then(operation);
  sessionWrites = next.catch(() => undefined);
  return next;
}

export async function readTokens(): Promise<TokenPair | null> {
  await sessionWrites;
  if (Platform.OS === 'web') return webSession;
  const raw = await SecureStore.getItemAsync(KEY, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TokenPair;
  } catch {
    await clearTokens();
    return null;
  }
}

export async function saveTokens(tokens: TokenPair, expectedRevision?: number): Promise<boolean> {
  const revision = expectedRevision ?? ++sessionRevision;
  return writeSession(async () => {
    if (revision !== sessionRevision) return false;
    if (Platform.OS === 'web') webSession = tokens;
    else await SecureStore.setItemAsync(KEY, JSON.stringify(tokens), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return revision === sessionRevision;
  });
}

export async function clearTokens(expectedRevision?: number): Promise<void> {
  if (expectedRevision !== undefined && expectedRevision !== sessionRevision) return;
  sessionRevision += 1;
  await writeSession(async () => {
    webSession = null;
    webUser = null;
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync(KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    }
  });
}

/** Identity only, for opening cached shopping lists when the network is down.
 * This never caches or grants a subscription, trial, or server permission. */
export async function saveCachedUser(user: MobileUser, expectedRevision = sessionRevision): Promise<boolean> {
  const identity: MobileUser = {
    id: user.id, email: user.email, name: user.name,
    allergies: user.allergies, dislikedIngredients: user.dislikedIngredients,
  };
  return writeSession(async () => {
    if (expectedRevision !== sessionRevision) return false;
    if (Platform.OS === 'web') webUser = identity;
    else await SecureStore.setItemAsync(USER_KEY, JSON.stringify(identity), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return expectedRevision === sessionRevision;
  });
}

export async function readCachedUser(): Promise<MobileUser | null> {
  await sessionWrites;
  if (Platform.OS === 'web') return webUser;
  const raw = await SecureStore.getItemAsync(USER_KEY, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  if (!raw) return null;
  try {
    const user: unknown = JSON.parse(raw);
    if (!user || typeof user !== 'object') return null;
    const value = user as Record<string, unknown>;
    const nullableString = (field: unknown) => field === null || typeof field === 'string';
    const optionalList = (field: unknown) => field === undefined || (Array.isArray(field) && field.every(item => typeof item === 'string'));
    if (typeof value.id !== 'string' || !value.id || !nullableString(value.email) || !nullableString(value.name)
      || !optionalList(value.allergies) || !optionalList(value.dislikedIngredients)) return null;
    return value as unknown as MobileUser;
  } catch { return null; }
}

export async function readRegisteredPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  return SecureStore.getItemAsync(PUSH_KEY, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export async function saveRegisteredPushToken(token: string): Promise<void> {
  if (Platform.OS !== 'web') await SecureStore.setItemAsync(PUSH_KEY, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export async function clearRegisteredPushToken(): Promise<void> {
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(PUSH_KEY);
}
