/**
 * Single source of truth for how customers reach us.
 *
 * Stripe requires merchants to display working contact details, and privacy
 * law expects a named contact for data requests — so this string is rendered
 * in the footer, on the post-checkout page, and in all three legal pages.
 *
 * Override with NEXT_PUBLIC_SUPPORT_EMAIL if the address ever changes. It must
 * be NEXT_PUBLIC_ because client components render it too.
 */
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@recipereborn.com';

export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;
