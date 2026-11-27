import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from 'jose';
import { verifyGoogleMobileIdentity } from '../lib/google-mobile-identity';

async function main() {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const keys = createLocalJWKSet({ keys: [{ ...await exportJWK(publicKey), kid: 'test', alg: 'RS256' }] });
  const nonce = 'a'.repeat(64);
  const make = (overrides: Record<string, unknown> = {}) => new SignJWT({ email: 'Cook@Example.com', email_verified: true, nonce, ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' }).setSubject('google-user-123').setIssuer('https://accounts.google.com')
    .setAudience('test-client').setIssuedAt().setExpirationTime('5m').sign(privateKey);
  assert.equal((await verifyGoogleMobileIdentity(await make(), nonce, 'test-client', keys)).email, 'cook@example.com');
  const validToken = await make();
  await assert.rejects(() => verifyGoogleMobileIdentity(validToken, nonce, 'other-client', keys));
  async function reject(overrides: Record<string, unknown>) { await assert.rejects(() => make(overrides).then(token => verifyGoogleMobileIdentity(token, nonce, 'test-client', keys))); }
  await reject({ nonce: 'b'.repeat(64) });
  await reject({ email_verified: false });
  await reject({ email_verified: 'true' });
  await reject({ email: null });
  const badIssuer = await new SignJWT({ email: 'cook@example.com', email_verified: true, nonce }).setProtectedHeader({alg:'RS256',kid:'test'}).setSubject('x').setIssuer('https://attacker.example').setAudience('test-client').setIssuedAt().setExpirationTime('5m').sign(privateKey);
  await assert.rejects(() => verifyGoogleMobileIdentity(badIssuer, nonce, 'test-client', keys));
  console.log('Google identity verification: valid identity accepted; wrong audience, nonce, issuer and unverified/malformed emails rejected.');
}
void main();
