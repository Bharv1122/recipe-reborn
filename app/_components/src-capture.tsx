'use client';

import { useEffect } from 'react';

// First-touch attribution: remember where a visitor came from (?src=card on
// the printed QR cards, ?src=fb on social posts, etc.) so the signup API can
// stamp it on the account. First value wins — later visits never overwrite it,
// so the channel that actually brought them in gets the credit.
export function SrcCapture() {
  useEffect(() => {
    try {
      const src = new URLSearchParams(window.location.search).get('src');
      if (src && src.trim() && !localStorage.getItem('rr_src')) {
        localStorage.setItem('rr_src', src.trim().slice(0, 40));
      }
    } catch {
      // localStorage unavailable (private mode) — attribution is best-effort
    }
  }, []);
  return null;
}
