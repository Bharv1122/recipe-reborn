import { Platform } from 'react-native';
import { publicRequest } from '@/services/api';

// Lazy import keeps unsupported platforms and old development clients usable.
export async function requestGoogleIdentity() {
  if (Platform.OS !== 'android') throw new Error('Please use email sign-in on this device.');
  const { GoogleOneTapSignIn, isSuccessResponse, isCancelledResponse } = await import('react-native-nitro-google-signin');
  const challenge = await publicRequest<{ nonce: string; webClientId: string }>('/api/mobile/auth/google/challenge', { method: 'POST' });
  GoogleOneTapSignIn.configure({ webClientId: challenge.webClientId, nonce: challenge.nonce, offlineAccess: false, autoSelectOnSignIn: false });
  await GoogleOneTapSignIn.checkPlayServices();
  const result = await GoogleOneTapSignIn.presentExplicitSignIn();
  if (isCancelledResponse(result)) return null;
  if (!isSuccessResponse(result) || !result.data.idToken) throw new Error('Google sign-in did not complete. Please try again.');
  return { idToken: result.data.idToken, nonce: challenge.nonce };
}

export async function clearGoogleSession() {
  if (Platform.OS !== 'android') return;
  try {
    const { GoogleOneTapSignIn } = await import('react-native-nitro-google-signin');
    await GoogleOneTapSignIn.signOut();
  } catch { /* Email sign-out remains available if native Google services are unavailable. */ }
}
