export class RequestDeadlineError extends Error {
  constructor() { super('The recipe request took too long. Please try again.'); }
}

// Covers the entire operation, including response bodies and redirect chains.
export async function withRequestDeadline<T>(
  requestSignal: AbortSignal,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let rejectDeadline!: (reason: Error) => void;
  const deadline = new Promise<never>((_, reject) => { rejectDeadline = reject; });
  const cancel = () => {
    const error = new DOMException('Recipe request canceled', 'AbortError');
    rejectDeadline(error);
    controller.abort(error);
  };
  const timer = setTimeout(() => {
    const error = new RequestDeadlineError();
    rejectDeadline(error);
    controller.abort(error);
  }, timeoutMs);
  requestSignal.addEventListener('abort', cancel, { once: true });
  try {
    if (requestSignal.aborted) cancel();
    return await Promise.race([
      deadline,
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return operation(controller.signal);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    requestSignal.removeEventListener('abort', cancel);
  }
}
