import assert from 'node:assert/strict';

async function main() {
  process.env.GEMINI_API_KEY = 'mock-gemini';
  process.env.OPENAI_API_KEY = 'mock-openai';
  process.env.AI_PROVIDER = 'auto';
  const { recipeChat, recipeGenerate, OPENAI_BACKUP_MODEL, canRetryRecipeAI, BackupTransportError } = await import('../lib/ai-provider');
  const { extractRecipe } = await import('../lib/recipe-extraction');
  const { generateValidatedPlan, MealPlanSafetyError } = await import('../lib/meal-plan-generation');
  const realFetch = globalThis.fetch;
  const realSetTimeout = globalThis.setTimeout;
  type Call = { url: string; body: any; headers: Headers };
  let calls: Call[] = [];
  const completion = (content = '{}', finish_reason = 'stop') => Response.json({ choices: [{ finish_reason, message: { content } }] });
  const init = (body: unknown = { model: 'gemini-2.5-flash', messages: [{ role: 'user', content: 'Return JSON' }], max_tokens: 100, reasoning_effort: 'low' }): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });
  function mock(reply: (call: Call, signal?: AbortSignal | null) => Promise<Response> | Response) {
    calls = [];
    globalThis.fetch = async (url, options) => {
      const call = { url: String(url), body: JSON.parse(String(options?.body)), headers: new Headers(options?.headers) };
      calls.push(call);
      return reply(call, options?.signal);
    };
  }
  try {
    for (const status of [403, 429, 500, 502, 503, 504]) {
      mock(call => call.url.includes('googleapis') ? new Response('', { status }) : completion());
      assert.equal((await recipeChat(init())).status, 200);
      assert.equal(calls.length, 2);
      assert.equal(calls[0].headers.get('Authorization'), 'Bearer mock-gemini');
      assert.equal(calls[1].headers.get('Authorization'), 'Bearer mock-openai');
      assert.equal(calls[1].body.model, OPENAI_BACKUP_MODEL);
      assert.equal(calls[1].body.reasoning_effort, undefined);
      assert.equal(calls[1].body.store, false);
    }
    mock(call => { if (call.url.includes('googleapis')) throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }); return completion(); });
    await recipeChat(init()); assert.equal(calls.length, 2);
    for (const error of [new Error('not a connection failure'), new TypeError('bad configuration'), Object.assign(new TypeError('fetch failed'), { cause: { code: 'ERR_INVALID_URL' } })]) {
      mock(() => { throw error; });
      await assert.rejects(recipeChat(init())); assert.equal(calls.length, 1);
    }
    for (const status of [400, 401, 422]) {
      mock(() => new Response('', { status }));
      assert.equal((await recipeChat(init())).status, status);
      assert.equal(calls.length, 1);
    }
    mock(() => completion('', 'content_filter'));
    assert.equal((await (await recipeChat(init())).json()).choices[0].finish_reason, 'content_filter');
    assert.equal(calls.length, 1, 'Safety rejection must not trigger another provider.');
    mock(() => new Response('', { status: 503 }));
    assert.equal((await recipeChat(init())).status, 503);
    assert.equal(calls.length, 2, 'Only one backup attempt.');
    process.env.AI_PROVIDER = 'gemini';
    assert.equal((await recipeChat(init())).status, 503);
    assert.equal(calls.length, 3);
    process.env.AI_PROVIDER = 'auto';
    delete process.env.OPENAI_API_KEY;
    assert.equal((await recipeChat(init())).status, 503);
    assert.equal(calls.length, 4, 'No fallback without a configured key.');
    process.env.OPENAI_API_KEY = 'mock-openai';
    const canceled = new AbortController(); canceled.abort();
    await assert.rejects(recipeChat({ ...init(), signal: canceled.signal }), { name: 'AbortError' });
    assert.equal(calls.length, 4);

    // Timeout is not evidence of an outage: never pay for a second provider
    // solely because a healthy generation is slow.
    globalThis.setTimeout = ((fn: any, ms: number, ...args: any[]) => realSetTimeout(fn, ms === 45_000 ? 10 : ms, ...args)) as typeof setTimeout;
    mock((_, signal) => new Promise((_, reject) => signal?.addEventListener('abort', () => reject(signal.reason))));
    await assert.rejects(recipeChat(init({ stream: true, messages: [] })));
    assert.equal(calls.length, 1, 'Opening timeout never starts a second billable provider.');
    globalThis.setTimeout = realSetTimeout;
    mock(() => new Promise(resolve => realSetTimeout(() => resolve(completion()), 25)));
    await recipeChat(init()); assert.equal(calls.length, 1);
    const cancelDuring = new AbortController();
    mock((_, signal) => new Promise((_, reject) => { realSetTimeout(() => cancelDuring.abort(), 1); signal?.addEventListener('abort', () => reject(signal.reason)); }));
    await assert.rejects(recipeChat({ ...init(), signal: cancelDuring.signal }));
    assert.equal(calls.length, 1);
    globalThis.setTimeout = realSetTimeout;

    mock(call => call.url.includes('googleapis') ? new Response('', { status: 503 }) : Response.json({ error: { code: 'insufficient_quota' } }, { status: 429 }));
    const creditFailure = await recipeChat(init());
    assert.equal(canRetryRecipeAI(creditFailure), false);
    assert.equal(creditFailure.headers.get('x-ai-error-code'), 'insufficient_quota');
    await assert.rejects(extractRecipe({ text: 'Synthetic recipe' }, new AbortController().signal, true));
    assert.equal(calls.length, 4, 'Import must stop after its first Gemini/OpenAI pair.');

    let streamCanceled = false;
    mock(() => new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n')); }, cancel() { streamCanceled = true; } })));
    const doneResponse = await recipeChat(init({ stream: true, messages: [] }));
    const doneReader = doneResponse.body!.getReader();
    await doneReader.read(); await doneReader.cancel();
    assert.equal(streamCanceled, true, 'Cancel after DONE must propagate to the provider stream.');

    process.env.AI_PROVIDER = 'openai';
    const days = [{ day: 'monday' }];
    mock(() => completion(JSON.stringify({ days })));
    const schemaRequest = init({ messages: [{ role: 'user', content: 'JSON array' }], response_format: { type: 'json_schema', json_schema: { name: 'days', strict: true, schema: { type: 'array', items: { type: 'object' } } } } });
    const arrayResponse = await recipeChat(schemaRequest);
    assert.deepEqual(JSON.parse((await arrayResponse.json()).choices[0].message.content), days);
    assert.equal(calls[0].body.response_format.json_schema.schema.type, 'object');
    assert.equal(calls[0].body.response_format.json_schema.schema.properties.days.type, 'array');
    assert.equal(calls.length, 1);
    for (const mimeType of ['image/png', 'application/pdf']) {
      mock(() => completion('{"title":"Soup"}'));
      const response = await recipeGenerate(init({ contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: 'synthetic' } }, { text: 'Return JSON' }] }], generationConfig: { responseMimeType: 'application/json' } }));
      assert.equal((await response.json()).candidates[0].finishReason, 'STOP');
      const part = calls[0].body.messages[0].content[0];
      assert.equal(part.type, mimeType === 'application/pdf' ? 'file' : 'image_url');
      if (part.file) assert.equal(part.file.file_data, 'data:application/pdf;base64,synthetic');
    }
    mock(() => completion('', 'content_filter'));
    assert.equal((await (await recipeGenerate(init({ contents: [{ role: 'user', parts: [{ text: 'JSON' }] }] }))).json()).candidates[0].finishReason, 'SAFETY');
    mock(() => completion());
    await assert.rejects(recipeGenerate(init({ contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'audio/m4a', data: 'synthetic' } }] }] })), /not supported/);
    assert.equal(calls.length, 0);

    process.env.AI_PROVIDER = 'auto';
    mock(() => new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: partial\n\n')); }, pull(controller) { controller.error(new Error('stream failed')); } })));
    const stream = await recipeChat(init({ stream: true, messages: [] }));
    await assert.rejects(stream.text(), /stream failed/);
    assert.equal(calls.length, 1, 'Never replay a stream on a second provider.');

    process.env.AI_PROVIDER = 'openai';
    globalThis.setTimeout = ((fn: any, ms: number, ...args: any[]) => realSetTimeout(fn, ms === 120_000 ? 10 : ms, ...args)) as typeof setTimeout;
    mock((_, signal) => new Promise((_, reject) => signal?.addEventListener('abort', () => reject(signal.reason))));
    await assert.rejects(recipeChat(init(), { totalMs: 120_000 }), BackupTransportError);
    calls = [];
    await assert.rejects(generateValidatedPlan({ weekStartDate: '2026-10-05', dietaryPreferences: [], mealTypes: ['dinner'], servings: 2, allergies: [], dislikedIngredients: [] }), (error: unknown) => error instanceof Error && 'retryable' in error && error.retryable === false);
    assert.equal(calls.length, 1, 'OpenAI deadline failure must not start a second plan attempt.');
    globalThis.setTimeout = realSetTimeout;
    const unsafe = { title: 'Salmon dinner', ingredients: ['1 cup salmon'], instructions: 'Cook salmon and serve.', prepTime: '5 min', cookTime: '20 min', servings: 2, dietaryTags: [], estimatedCalories: 400 };
    mock(call => completion(JSON.stringify(call.body.response_format?.json_schema?.schema?.properties?.days
      ? { days: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(day => ({ day, dinner: unsafe })) } : unsafe)));
    await assert.rejects(generateValidatedPlan({ weekStartDate: '2026-10-05', dietaryPreferences: [], mealTypes: ['dinner'], servings: 2, allergies: ['fish'], dislikedIngredients: [] }), MealPlanSafetyError);
    assert.ok(calls.every(call => call.url === 'https://api.openai.com/v1/chat/completions'));
    console.log('PASS: provider routing, credential isolation, bounded retries, cancellation, deadlines and slow non-stream responses, schemas, image/PDF conversion, safety refusals, stream failure, and actual meal-plan allergy validation. Mocked transport only.');
  } finally {
    globalThis.fetch = realFetch;
    globalThis.setTimeout = realSetTimeout;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
