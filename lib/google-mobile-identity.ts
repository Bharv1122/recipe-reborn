import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export async function verifyGoogleMobileIdentity(idToken: string, nonce: string, clientId: string, keys: JWTVerifyGetKey = googleKeys) {
  if (!clientId || !/^[a-f0-9]{64}$/.test(nonce)) throw new Error('Invalid Google sign-in configuration');
  const { payload } = await jwtVerify(idToken, keys, {
    algorithms: ['RS256'], audience: clientId,
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    requiredClaims: ['sub', 'exp', 'iat', 'email', 'email_verified', 'nonce'],
    maxTokenAge: '10m', clockTolerance: 5,
  });
  if (payload.nonce !== nonce || payload.email_verified !== true ||
      typeof payload.email !== 'string' || payload.email.length > 320 || !payload.email.includes('@') ||
      typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255) {
    throw new Error('Invalid Google identity');
  }
  return { subject: payload.sub, email: payload.email.trim().toLowerCase(),
    name: typeof payload.name === 'string' ? payload.name.slice(0, 120) : null };
}
