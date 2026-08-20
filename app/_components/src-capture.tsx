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
      // Community offers are deliberately code-only. Do not retain a known
      // offer name from the URL, even as attribution, because entitlement is
      // derived from signupSource on the server.
      if (!src || findPartnerOffer(src)) return;

      const existing = localStorage.getItem('rr_src');
      if (!existing) localStorage.setItem('rr_src', src);
    } catch {
      // localStorage unavailable (private mode) — attribution is best-effort
    }
  }, []);
  return null;
}
