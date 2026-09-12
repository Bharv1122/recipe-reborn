const LAST_VISIT_KEY = 'recipe-reborn:last-visit-at';
const DAY_MS = 24 * 60 * 60 * 1000;

// This measures a browser returning after a 24-hour gap, not unique users.
export function recordVisit(storage: Pick<Storage, 'getItem' | 'setItem'>, now = Date.now()): boolean {
  try {
    const raw = storage.getItem(LAST_VISIT_KEY);
    const previous = raw?.trim() ? Number(raw) : NaN;
    storage.setItem(LAST_VISIT_KEY, String(now));
    // Number(null) is zero, which used to count every first visit as a return.
    return Number.isFinite(previous) && previous > 0 && now - previous >= DAY_MS;
  } catch {
    return false;
  }
}
