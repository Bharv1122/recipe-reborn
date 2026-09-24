import Constants from 'expo-constants';
import { fetch as expoFetch } from 'expo/fetch';
import { clearTokens, getSessionRevision, readTokens, saveTokens } from '@/services/auth-storage';
import type { TokenPair } from '@/types';

const baseUrl = String(Constants.expoConfig?.extra?.apiBaseUrl || 'https://recipereborn.com').replace(/\/$/, '');
let refreshInFlight: { revision: number; promise: Promise<TokenPair | null> } | null = null;

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.message || body.error || 'Something went wrong.', response.status);
  return body as T;
}

function ensureSession(revision: number) {
  if (revision !== getSessionRevision()) throw new ApiError('Your sign-in changed. Please try again.', 409);
}

async function refreshSession(revision: number): Promise<TokenPair | null> {
  if (refreshInFlight?.revision === revision) return refreshInFlight.promise;
  const promise = (async () => {
    try {
      const existing = await readTokens();
      ensureSession(revision);
      if (!existing) return null;
      const response = await fetch(`${baseUrl}/api/mobile/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: existing.refreshToken }),
      });
      const data = await parseResponse<{ tokens: TokenPair }>(response);
      ensureSession(revision);
      if (!await saveTokens(data.tokens, revision)) ensureSession(revision);
      return data.tokens;
    } catch (error) {
      ensureSession(revision);
      // A connection failure or temporary server error does not revoke a
      // session. Keep its refresh token for a later online retry.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await clearTokens(revision);
        return null;
      }
      throw error;
    }
  })();
  refreshInFlight = { revision, promise };
  try { return await promise; }
  finally { if (refreshInFlight?.promise === promise) refreshInFlight = null; }
}

export async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  return parseResponse<T>(response);
}

export async function apiResponse(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const revision = getSessionRevision();
  const tokens = await readTokens();
  ensureSession(revision);
  if (!tokens) throw new ApiError('Please sign in again.', 401);
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  // Expo File objects need Expo's Blob-aware multipart transport.
  const response = await (isFormData ? expoFetch : fetch)(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${tokens.accessToken}`,
      ...init.headers,
    },
  });
  ensureSession(revision);
  if (response.status === 401 && retry) {
    const refreshed = await refreshSession(revision);
    if (refreshed) return apiResponse(path, init, false);
  }
  return response;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const revision = getSessionRevision();
  const response = await apiResponse(path, init, retry);
  const value = await parseResponse<T>(response);
  ensureSession(revision);
  return value;
}

export { baseUrl };
