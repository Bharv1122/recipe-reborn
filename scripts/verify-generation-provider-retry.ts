import assert from 'node:assert/strict';
import { GenerationServiceUnavailable, generationRetryDelay, waitForGenerationRetry } from '../lib/generation-provider-retry';

async function main() {
  const now = 100_000;
  const response = (status: number, retryAfter?: string) => new Response(null, { status, headers: retryAfter ? { 'Retry-After': retryAfter } : {} });
  assert.equal(generationRetryDelay(response(503), now + 52_000, now), 1500);
  assert.equal(generationRetryDelay(response(429, '3'), now + 52_000, now), 3000);
  assert.equal(generationRetryDelay(response(503, new Date(now + 4000).toUTCString()), now + 52_000, now), 4000);
  assert.equal(generationRetryDelay(response(503, '60'), now + 52_000, now), null, 'Do not retry before a long provider retry window.');
  assert.equal(generationRetryDelay(response(503), now + 4000, now), null, 'Keep the original deadline.');
  assert.equal(generationRetryDelay(response(400), now + 52_000, now), null);
  assert.equal(generationRetryDelay(response(401), now + 52_000, now), null);
  assert.equal(generationRetryDelay(response(503, 'invalid'), now + 52_000, now), 1500);
  const canceled = new AbortController(); canceled.abort();
  await assert.rejects(waitForGenerationRetry(1500, canceled.signal), { name: 'AbortError' });
  const pending = new AbortController();
  const waiting = waitForGenerationRetry(1500, pending.signal);
  pending.abort();
  await assert.rejects(waiting, { name: 'AbortError' });
  await waitForGenerationRetry(1, new AbortController().signal);
  assert.match(new GenerationServiceUnavailable().message, /temporarily busy.*ingredients are still here/i);
  console.log('Generation provider retry timing, deadline and cancellation checks passed.');
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
