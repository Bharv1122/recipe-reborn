export class GenerationServiceUnavailable extends Error {
  constructor() {
    super('The recipe service is temporarily busy. Your ingredients are still here. Please try again shortly.');
    this.name = 'GenerationServiceUnavailable';
  }
}

// Retry once after a short pause instead of immediately hitting an overloaded
// provider again. Long Retry-After values are returned to the user, not ignored.
export function generationRetryDelay(response: Response, deadline: number, now = Date.now()): number | null {
  if (response.status !== 429 && response.status < 500) return null;
  const header = response.headers.get('retry-after');
  const seconds = header === null || !header.trim() ? NaN : Number(header);
  const requested = Number.isFinite(seconds) ? Math.max(0, seconds * 1000)
    : header ? Date.parse(header) - now : NaN;
  const delay = Math.max(1500, Number.isFinite(requested) ? requested : 0);
  // Preserve time for a complete recipe, validation and cleanup.
  return delay <= 5000 && deadline - now >= delay + 4000 ? delay : null;
}

export function waitForGenerationRetry(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Recipe request canceled', 'AbortError')); return; }
    const cancel = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      reject(new DOMException('Recipe request canceled', 'AbortError'));
    };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, delay);
    signal.addEventListener('abort', cancel, { once: true });
  });
}
