export type FunnelEventName =
  | 'preview_started'
  | 'signup_viewed'
  | 'signup_completed'
  | 'profile_completed'
  | 'recipe_generated'
  | 'return_visit';

export async function trackFunnelEvent(event: FunnelEventName): Promise<void> {
  if (typeof window === 'undefined') return;
  let source: string | null = null;
  try {
    source = localStorage.getItem('rr_src');
  } catch {
    // Attribution is optional when storage is unavailable.
  }
  try {
    await fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, path: window.location.pathname.slice(0, 120), source: source?.slice(0, 60) ?? null }),
      keepalive: true,
    });
  } catch {
    // Analytics must never interrupt the product flow.
  }
}
