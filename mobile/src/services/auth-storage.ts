import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { TokenPair } from '@/types';

const KEY = 'recipe-reborn.mobile-session.v1';
const PUSH_KEY = 'recipe-reborn.mobile-push-token.v1';
let webSession: TokenPair | null = null;

export async function readTokens(): Promise<TokenPair | null> {
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

export async function saveTokens(tokens: TokenPair): Promise<void> {
  if (Platform.OS === 'web') {
    webSession = tokens;
    return;
  }
  await SecureStore.setItemAsync(KEY, JSON.stringify(tokens), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearTokens(): Promise<void> {
  webSession = null;
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(KEY);
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
