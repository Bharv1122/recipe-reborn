'use client';

import { useEffect } from 'react';
import { trackFunnelEvent } from '@/lib/funnel-analytics';
import { recordVisit } from '@/lib/visit-tracking';

export function FunnelVisitTracker() {
  useEffect(() => {
    try {
      if (recordVisit(localStorage)) {
        void trackFunnelEvent('return_visit');
      }
    } catch {
      // Return tracking is best-effort when storage is unavailable.
    }
  }, []);

  return null;
}
