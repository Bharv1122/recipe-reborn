import Constants from 'expo-constants';
import { clearTokens, readTokens, saveTokens } from '@/services/auth-storage';
import type { TokenPair } from '@/types';

const baseUrl = String(Constants.expoConfig?.extra?.apiBaseUrl || 'https://recipereborn.com').replace(/\/$/, '');
let refreshInFlight: Promise<TokenPair | null> | null = null;

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.error || 'Something went wrong.', response.status);
  return body as T;
}

async function refreshSession(): Promise<TokenPair | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const existing = await readTokens();
    if (!existing) return null;
    try {
      const response = await fetch(`${baseUrl}/api/mobile/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: existing.refreshToken }),
      });
      const data = await parseResponse<{ tokens: TokenPair }>(response);
      await saveTokens(data.tokens);
      return data.tokens;
    } catch {
      await clearTokens();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  return parseResponse<T>(response);
}

export async function apiResponse(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const tokens = await readTokens();
  if (!tokens) throw new ApiError('Please sign in again.', 401);
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${tokens.accessToken}`,
      ...init.headers,
    },
  });
  if (response.status === 401 && retry) {
    const refreshed = await refreshSession();
    if (refreshed) return apiResponse(path, init, false);
  }
  return response;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const response = await apiResponse(path, init, retry);
  return parseResponse<T>(response);
}

export { baseUrl };
