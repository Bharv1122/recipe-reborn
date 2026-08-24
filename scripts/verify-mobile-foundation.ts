import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { InvalidBarcodeError, lookupBarcode } from '../lib/barcode-lookup';
import { MobileAuthError, verifyMobileAccessToken } from '../lib/mobile-auth';

process.env.NEXTAUTH_SECRET = 'mobile-foundation-test-secret-at-least-32-characters';

const valid = jwt.sign(
  { type: 'access' },
  process.env.NEXTAUTH_SECRET,
  { subject: 'test-user', issuer: 'recipe-reborn', audience: 'recipe-reborn-mobile', expiresIn: 60 },
);
assert.equal(verifyMobileAccessToken(valid), 'test-user');

const wrongAudience = jwt.sign(
  { type: 'access' },
  process.env.NEXTAUTH_SECRET,
  { subject: 'test-user', issuer: 'recipe-reborn', audience: 'not-the-mobile-app', expiresIn: 60 },
);
assert.throws(() => verifyMobileAccessToken(wrongAudience), MobileAuthError);

async function main() {
  await assert.rejects(() => lookupBarcode('../not-a-barcode'), InvalidBarcodeError);
  console.log('Mobile foundation verification passed: access-token claims and barcode input guard.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
