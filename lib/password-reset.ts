import crypto from 'crypto';

/**
 * Shared bits of the password reset flow, so the request and confirm routes
 * can't drift apart on token format or namespace.
 */

// Long enough to walk away and come back, short enough that a leaked inbox
// isn't a permanent account takeover.
export const TOKEN_TTL_MINUTES = 60;

// Matches the signup route's minimum so a reset can't create a password that
// signup itself would have rejected.
export const MIN_PASSWORD_LENGTH = 6;

// The VerificationToken table is shared with NextAuth's Prisma adapter, so
// namespace our rows to keep the two flows from colliding.
const IDENTIFIER_PREFIX = 'password-reset:';

export function resetIdentifier(email: string): string {
  return `${IDENTIFIER_PREFIX}${email}`;
}

export function isResetIdentifier(identifier: string): boolean {
  return identifier.startsWith(IDENTIFIER_PREFIX);
}

export function emailFromResetIdentifier(identifier: string): string {
  return identifier.slice(IDENTIFIER_PREFIX.length);
}

/**
 * Only the hash is stored. The raw token exists solely in the emailed link, so
 * a database read can't be turned into a working reset.
 */
export function hashResetToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
