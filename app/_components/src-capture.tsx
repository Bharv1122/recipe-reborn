'use client';

import { useEffect } from 'react';
import { findPartnerOffer, normalizeSource } from '@/lib/partner-offers';

// First-touch attribution: remember where a visitor came from (?src=card on
// the printed QR cards, ?src=fb on social posts, etc.) so the signup API can
// stamp it on the account. First value wins — later visits never overwrite it,
// so the channel that actually brought them in gets the credit.
export function SrcCapture() {
  useEffect(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get('src');
      const src = normalizeSource(raw);
      if (!src) return;

      const existing = localStorage.getItem('rr_src');

      // First touch wins for ordinary channels, but a partner invite always
      // wins: someone who browsed the site once weeks ago and then follows a
      // community link has genuinely been invited, and silently withholding
      // the offer after showing them the link would be worse than losing the
      // original attribution.
      const isInvite = Boolean(findPartnerOffer(src));

      if (!existing || (isInvite && existing !== src)) {
        localStorage.setItem('rr_src', src);
      }
    } catch {
      // localStorage unavailable (private mode) — attribution is best-effort
    }
  }, []);
  return null;
}
