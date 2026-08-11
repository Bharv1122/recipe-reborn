export function reportClientError(
  boundary: 'route' | 'global',
  error: Error & { digest?: string }
) {
  const body = JSON.stringify({
    boundary,
    digest: error.digest,
    errorName: error.name,
    pathname: window.location.pathname,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/client-errors', new Blob([body], { type: 'application/json' }));
    return;
  }

  void fetch('/api/client-errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
}
