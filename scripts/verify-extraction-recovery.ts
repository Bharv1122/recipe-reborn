import assert from 'node:assert/strict';

async function main() {
  // Dummy key plus mocked transport: no request can leave this process.
  process.env.GEMINI_API_KEY = 'unit-test-only';
  const { extractRecipe } = await import('../lib/recipe-extraction');
  const realFetch = globalThis.fetch;
  let calls = 0;
  const payload = { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ title: 'Soup', ingredients: ['1 cup water'], instructions: ['Boil.'] }) }] } }] };
  try {
    globalThis.fetch = async () => ++calls === 1 ? new Response('', { status: 503 }) : Response.json(payload);
    assert.equal((await extractRecipe({ text: 'Synthetic soup' }, new AbortController().signal, true)).title, 'Soup');
    assert.equal(calls, 2);
    calls = 0;
    globalThis.fetch = async () => { calls++; return new Response('', { status: 503 }); };
    await assert.rejects(extractRecipe({ text: 'Synthetic soup' }, new AbortController().signal, true), /extraction failed/);
    assert.equal(calls, 2, 'Transient failures must not loop.');
    calls = 0;
    const canceled = new AbortController(); canceled.abort();
    await assert.rejects(extractRecipe({ text: 'Synthetic soup' }, canceled.signal, true), { name: 'AbortError' });
    assert.equal(calls, 0, 'Canceled extraction must not start provider work.');
    globalThis.fetch = async () => Response.json({ candidates: [{ ...payload.candidates[0], finishReason: 'MAX_TOKENS' }] });
    await assert.rejects(extractRecipe({ text: 'Synthetic soup' }, new AbortController().signal, true), /incomplete/);
  } finally { globalThis.fetch = realFetch; }
  console.log('Extraction transient retry, cancellation and truncation checks passed with mocked transport.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
