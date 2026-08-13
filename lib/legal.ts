/**
 * The date our published policies last actually changed.
 *
 * This used to be `new Date().toLocaleDateString()`, which re-dated all three
 * legal pages on every render — so the one signal users have that the terms
 * moved was pure noise, and the "we'll update the Last updated date" promise
 * inside those same documents was never true.
 *
 * Bump this by hand, and only when the policy text really changes.
 */
export const LEGAL_LAST_UPDATED = 'August 12, 2026';
