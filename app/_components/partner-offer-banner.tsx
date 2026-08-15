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
        if (cancelled || !data) return;

        // Only a signed-in answer is authoritative. When it is, trust it in
        // both directions: an account past the cap or after the end date must
        // stop being shown an offer it would not actually receive.
        if (!data.authenticated) return;

        const fromApi = findPartnerOffer(data?.offer?.slug);
        setOffer(fromApi && isOfferLive(fromApi) ? fromApi : null);
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

export function PartnerOfferBanner({
  className = '',
  showCta = false,
}: {
  className?: string;
  /** Landing pages need a way onward; signup/pricing already have the form. */
  showCta?: boolean;
}) {
  const offer = usePartnerOffer();

  if (!offer) return null;

  return (
    <div
      className={`mx-auto mb-8 flex max-w-2xl items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 ${className}`}
    >
      <Gift className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
      <div className="text-left">
        <p className="font-semibold text-emerald-900">
          Special, just for {offer.label}: {offer.trialDays} days free
        </p>
        <p className="text-sm text-emerald-800/80">
          {/* Deliberately does not say "applied automatically" — that is only
              true of the invite link; someone who typed the code sees this
              same banner. Payment is not mentioned at all: the trial involves
              no card and nothing charges at the end, so there is nothing to
              warn about. */}
          Includes {offer.trialRecipeLimit} recipes. When the {offer.trialDays}{' '}
          days are up your account simply returns to the free plan.
        </p>
        {showCta && (
          <a
            href="/signup"
            className="mt-3 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Claim your {offer.trialDays} days
          </a>
        )}
      </div>
    </div>
  );
}

/** "7-day free trial" / "30-day free trial", matching what checkout will do. */
export function useTrialLabel(): string {
  const offer = usePartnerOffer();
  return `${offer?.trialDays ?? DEFAULT_TRIAL_DAYS}-day free trial`;
}
