import assert from 'node:assert/strict';

async function main() {
  process.env.GEMINI_API_KEY = 'synthetic-gemini';
  process.env.OPENAI_API_KEY = 'synthetic-openai';
  process.env.AI_PROVIDER = 'auto';
  const { transcribeAudio } = await import('../lib/audio-transcription');
  const original = globalThis.fetch;
  const audio = new Blob(['synthetic-audio'], { type: 'audio/mp4' });
  let calls: string[] = [];
  try {
    for (const status of [403, 429, 500]) {
      calls = [];
      globalThis.fetch = async (url, init) => {
        calls.push(String(url));
        if (calls.length === 1) return new Response('PRIVATE_PROVIDER_BODY', { status });
        assert.equal(String(url), 'https://api.openai.com/v1/audio/transcriptions');
        assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer synthetic-openai');
        assert.ok(init?.body instanceof FormData);
        assert.equal(init.body.get('model'), 'gpt-4o-mini-transcribe');
        assert.equal((init.body.get('file') as File).name, 'recording.m4a');
        return Response.json({ text: 'two eggs and one cup of rice' });
      };
      const result = await transcribeAudio(audio, 'mp4', { contents: [] }, new AbortController().signal);
      assert.equal((await result.json()).candidates[0].content.parts[0].text, 'two eggs and one cup of rice');
      assert.equal(calls.length, 2);
    }
    for (const status of [200, 400, 401]) {
      calls = [];
      globalThis.fetch = async url => { calls.push(String(url)); return new Response('{}', { status }); };
      assert.equal((await transcribeAudio(audio, 'mp4', {}, new AbortController().signal)).status, status);
      assert.equal(calls.length, 1, 'No fallback on input/auth errors or successful semantic responses');
    }
    process.env.AI_PROVIDER = 'openai';
    calls = [];
    globalThis.fetch = async url => { calls.push(String(url)); return Response.json({ text: '' }); };
    const empty = await transcribeAudio(audio, 'wav', {}, new AbortController().signal);
    assert.equal((await empty.json()).candidates[0].content.parts[0].text, '');
    await assert.rejects(transcribeAudio(audio, 'ogg', {}, new AbortController().signal), /record again/);
    const aborted = new AbortController(); aborted.abort();
    await assert.rejects(transcribeAudio(audio, 'mp4', {}, aborted.signal), { name: 'AbortError' });
    assert.equal(calls.length, 1, 'Unsupported audio and cancellation must not send audio');
    globalThis.fetch = async () => Response.json({ error: { message: 'PRIVATE' } }, { status: 429 });
    const quota = await transcribeAudio(audio, 'mp4', {}, new AbortController().signal);
    assert.equal(quota.status, 429); assert.equal(await quota.text(), '');
    console.log('PASS audio fallback: service statuses, exact transcript, multipart credentials, input errors, silence, unsupported formats, abort, private provider bodies');
  } finally { globalThis.fetch = original; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
