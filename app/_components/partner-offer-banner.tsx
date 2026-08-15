'use client';

import { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import {
  DEFAULT_TRIAL_DAYS,
  findPartnerOffer,
  isOfferLive,
  type PartnerOffer,
} from '@/lib/partner-offers';

/**
 * Resolves the visitor's partner offer for display.
 *
 * Two sources, because the offer matters at two different moments:
 *  - localStorage rr_src covers someone who just arrived on the community link
 *    and has not signed up yet — the moment that actually decides conversion.
 *  - /api/user/offer covers a logged-in member whose browser storage was since
 *    cleared, and is the value checkout will really use.
 *
 * The API answer wins when present. Neither is trusted for entitlement:
 * create-checkout-session re-resolves everything server-side.
 */
export function usePartnerOffer(): PartnerOffer | null {
  const [offer, setOffer] = useState<PartnerOffer | null>(null);

  useEffect(() => {
    let cancelled = false;

    try {
      const stored = localStorage.getItem('rr_src');
      const local = findPartnerOffer(stored);
      if (local && isOfferLive(local)) setOffer(local);
    } catch {
      // localStorage unavailable (private mode) — fall through to the API
    }

    fetch('/api/user/offer')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const fromApi = findPartnerOffer(data?.offer?.slug);
        if (fromApi && isOfferLive(fromApi)) setOffer(fromApi);
      })
      .catch(() => {
        // Display-only; the pricing page must render regardless.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return offer;
}

export function PartnerOfferBanner({ className = '' }: { className?: string }) {
  const offer = usePartnerOffer();

  if (!offer) return null;

  return (
    <div
      className={`mx-auto mb-8 flex max-w-2xl items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 ${className}`}
    >
      <Gift className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
      <div className="text-left">
        <p className="font-semibold text-emerald-900">
          {offer.label}: {offer.trialDays} days free — no credit card
        </p>
        <p className="text-sm text-emerald-800/80">
          Applied automatically, no code needed. Includes {offer.trialRecipeLimit}{' '}
          recipes. When the month is up it simply ends and you drop back to the free
          plan — we never ask for a card, so you can&apos;t be charged by surprise.
        </p>
      </div>
    </div>
  );
}

/** "7-day free trial" / "30-day free trial", matching what checkout will do. */
export function useTrialLabel(): string {
  const offer = usePartnerOffer();
  return `${offer?.trialDays ?? DEFAULT_TRIAL_DAYS}-day free trial`;
}
