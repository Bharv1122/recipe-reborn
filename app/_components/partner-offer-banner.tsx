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
 * Only the signed-in account can supply an offer. URL parameters and browser
 * storage are intentionally ignored; create-checkout-session re-resolves the
 * same code-derived account value server-side.
 */
export function usePartnerOffer(): PartnerOffer | null {
  const [offer, setOffer] = useState<PartnerOffer | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/user/offer')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;

        // Only a signed-in answer is authoritative.
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
          {offer.lifetime
            ? `${offer.label} — Premium, free for good`
            : `Special, just for ${offer.label}: ${offer.trialDays} days free`}
        </p>
        <p className="text-sm text-emerald-800/80">
          {/* Payment is not mentioned because the trial involves no card and
              nothing charges at the end. */}
          {offer.lifetime ? (
            <>
              Full Premium — {offer.trialRecipeLimit} recipes a month, meal plans,
              shopping lists, the lot. It does not expire and there is nothing to
              renew.
            </>
          ) : (
            <>
              Full Premium — {offer.trialRecipeLimit} recipes a month, meal plans,
              shopping lists, the lot. When the {offer.trialDays} days are up your
              account simply returns to the free plan.
            </>
          )}
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
