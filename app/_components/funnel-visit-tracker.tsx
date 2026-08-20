'use client';

import { useEffect } from 'react';
import { trackFunnelEvent } from '@/lib/funnel-analytics';

export function FunnelVisitTracker() {
  useEffect(() => {
    const key = 'recipe-reborn:last-visit-at';
    const now = Date.now();
    try {
      const previous = Number(localStorage.getItem(key));
      localStorage.setItem(key, String(now));
      if (Number.isFinite(previous) && now - previous >= 24 * 60 * 60 * 1000) {
        void trackFunnelEvent('return_visit');
      }
    } catch {
      // Return tracking is best-effort when storage is unavailable.
    }
  }, []);

  return null;
}
