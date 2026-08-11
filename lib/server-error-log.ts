type SafeErrorContext = Record<string, string | number | boolean | null | undefined>;

function errorFrames(error: unknown) {
  if (!(error instanceof Error) || !error.stack) return undefined;

  return error.stack
    .split('\n')
    .slice(1, 6)
    .map((line) => line.trim())
    .join(' | ');
}

/**
 * Structured server logging for Vercel's native runtime logs. Deliberately
 * excludes messages, request bodies, ingredient text, email addresses, and
 * other user content.
 */
export function logServerError(
  event: string,
  error?: unknown,
  context: SafeErrorContext = {}
) {
  const safeContext = Object.fromEntries(
    Object.entries(context).filter(([, value]) =>
      ['string', 'number', 'boolean'].includes(typeof value) || value === null
    )
  );

  console.error(
    JSON.stringify({
      level: 'error',
      event,
      timestamp: new Date().toISOString(),
      errorName: error instanceof Error ? error.name : undefined,
      frames: errorFrames(error),
      ...safeContext,
    })
  );
}
