'use client';

import { useEffect, useState } from 'react';
import { PartyPopper, X } from 'lucide-react';
import { usePartnerOffer } from './partner-offer-banner';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/support';

/**
 * One-time hello for a partner-offer member once they are signed in.
 *
 * Shown on the generator — the page they land on straight after signup — and
 * dismissible, with the dismissal remembered per offer so it greets them once
 * rather than nagging every visit. Keyed off the same resolver as everything
 * else, so it only appears for accounts that actually hold the offer.
 */
export function PartnerWelcome() {
  const offer = usePartnerOffer();
  const [dismissed, setDismissed] = useState(true);

  const storageKey = offer ? `rr_welcome_dismissed_${offer.slug}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      setDismissed(localStorage.getItem(storageKey) === '1');
    } catch {
      // localStorage unavailable — show it, it is only a greeting
      setDismissed(false);
    }
  }, [storageKey]);

  if (!offer || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      if (storageKey) localStorage.setItem(storageKey, '1');
    } catch {
      // best effort
    }
  };

  return (
    <div className="relative mb-8 rounded-2xl border border-orange-300/60 bg-white/95 p-5 shadow-lg sm:p-6">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss welcome message"
        className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <PartyPopper className="mt-0.5 h-6 w-6 flex-shrink-0 text-orange-500" />
        <div className="space-y-2">
          <p className="text-lg font-bold text-gray-900">
            Thank you, {singular(offer.label)}, for signing up!
          </p>
          <p className="text-gray-700">
            Enjoy your {offer.trialDays} day free trial — special, just for{' '}
            {offer.label}. That&apos;s {offer.trialRecipeLimit} recipes with no card to
            start. If you want to stay on Premium afterwards you&apos;ll add a card
            then; otherwise your account just returns to the free plan.
          </p>
          <p className="text-gray-700">
            I&apos;d love any feedback at{' '}
            <a href={SUPPORT_MAILTO} className="font-medium text-emerald-700 hover:underline">
              {SUPPORT_EMAIL}
            </a>
            . Keep up the good work, and happy cooking!
          </p>
        </div>
      </div>
    </div>
  );
}

/** "Finnsters" -> "Finnster", so the greeting addresses one person. */
function singular(label: string): string {
  return label.endsWith('s') ? label.slice(0, -1) : label;
}
