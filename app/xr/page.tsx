import type { Metadata } from 'next';
import { XrKitchenClient } from './_components/xr-kitchen-client';

export const metadata: Metadata = {
  title: 'Mixed Reality Kitchen',
  description:
    'Cook the fresh version of a packaged food with floating, hands-only step cards, checklists and timers on Meta Quest.',
};

/**
 * /xr: the hands-first WebXR cooking mode. Public on purpose (no login, no
 * paywall) so anyone in a headset can open it and cook.
 */
export default function XrKitchenPage() {
  return <XrKitchenClient />;
}
