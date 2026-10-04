import { AI_API_KEY, AI_CHAT_URL, AI_GENERATE_URL } from './ai';

type Json = Record<string, any>;
type Provider = 'gemini' | 'openai';
export class BackupInputError extends Error {}
export class BackupTransportError extends Error {}
class ProviderConnectionError extends Error {}
export interface RecipeAIOptions { totalMs?: number }
export function canRetryRecipeAI(response: Response): boolean {
  return response.headers.get('x-ai-provider') !== 'openai';
}
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
// This non-reasoning, vision-capable model supports the existing temperature,
// JSON and streaming contracts. Keep model changes explicit and tested.
export const OPENAI_BACKUP_MODEL = 'gpt-4.1-mini-2025-04-14';

export function aiProviderMode(): 'auto' | Provider {
  const mode = process.env.AI_PROVIDER;
  return mode === 'auto' || mode === 'openai' ? mode : 'gemini';
}
export function hasRecipeAIKey(): boolean {
  const mode = aiProviderMode();
  return mode === 'openai' ? Boolean(process.env.OPENAI_API_KEY)
    : Boolean(AI_API_KEY || (mode === 'auto' && process.env.OPENAI_API_KEY));
}

function nativeToChat(body: Json): Json {
  return {
    model: OPENAI_BACKUP_MODEL,
    messages: body.contents.map((entry: Json) => ({
      role: entry.role === 'model' ? 'assistant' : entry.role,
      content: entry.parts.map((part: Json) => {
        if (typeof part.text === 'string') return { type: 'text', text: part.text };
        const { mimeType, data } = part.inlineData ?? {};
        if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)) {
          return { type: 'image_url', image_url: { url: `data:${mimeType};base64,${data}` } };
        }
        if (mimeType === 'application/pdf') {
          return { type: 'file', file: { filename: 'recipe.pdf', file_data: `data:application/pdf;base64,${data}` } };
        }
        throw new BackupInputError('This file format is not supported by the backup provider.');
      }),
    })),
    temperature: body.generationConfig?.temperature,
    max_tokens: body.generationConfig?.maxOutputTokens ?? 8000,
    ...(body.generationConfig?.responseMimeType === 'application/json'
      ? { response_format: { type: 'json_object' } } : {}),
  };
}

function openaiRequest(original: Json, native: boolean) {
  const body = native ? nativeToChat(original) : structuredClone(original);
  body.model = OPENAI_BACKUP_MODEL;
  body.store = false;
  delete body.reasoning_effort;
  // HEIC/HEIF are accepted by Gemini, not by this OpenAI vision model.
  for (const message of body.messages ?? []) {
    if (!Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part.type === 'image_url' && /^data:image\/(heic|heif);/i.test(part.image_url?.url ?? '')) {
        throw new BackupInputError('Use a JPEG, PNG or WebP photo with the backup provider.');
      }
    }
  }
  const format = body.response_format?.json_schema;
  const wrapped = format?.schema?.type === 'array';
  if (wrapped) {
    if (body.stream) throw new Error('Streaming array schemas are not supported.');
    format.schema = {
      type: 'object', properties: { days: format.schema }, required: ['days'], additionalProperties: false,
    };
    body.messages = [...body.messages, { role: 'system', content: 'Return the requested JSON array inside the object {"days": [...]} required by the response schema.' }];
  }
  return { body, wrapped };
}

// Consume non-streaming bodies under the deadline too. A successful HTTP header
// does not mean a model has finished. Streaming never switches provider after
// handing a response to the caller (which could duplicate partial output).
async function request(
  provider: Provider, init: RequestInit, body: Json, native: boolean,
  signal: AbortSignal, attemptMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException('Provider timed out', 'TimeoutError')), attemptMs);
  const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); controller.signal.removeEventListener('abort', cleanup); };
  controller.signal.addEventListener('abort', cleanup, { once: true });
  try {
    signal.throwIfAborted();
    const translated = provider === 'openai' ? openaiRequest(body, native) : { body, wrapped: false };
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (provider === 'openai') headers.set('Authorization', `Bearer ${process.env.OPENAI_API_KEY}`);
    else if (native) headers.set('x-goog-api-key', AI_API_KEY);
    else headers.set('Authorization', `Bearer ${AI_API_KEY}`);
    const url = provider === 'openai' ? OPENAI_URL : native ? AI_GENERATE_URL : AI_CHAT_URL;
    new URL(url); // Configuration errors must never silently trigger paid fallback.
    const payload = JSON.stringify(translated.body);
    let response: Response;
    try {
      response = await fetch(url, { ...init, headers, signal: controller.signal, body: payload });
    } catch (error) {
      const code = (error as { cause?: { code?: string } })?.cause?.code;
      if (!controller.signal.aborted && error instanceof TypeError && typeof code === 'string'
        && /^(ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET)$/.test(code)) {
        throw new ProviderConnectionError('Provider connection failed');
      }
      throw error;
    }
    const resultHeaders = new Headers(response.headers);
    resultHeaders.set('x-ai-provider', provider);
    if (body.stream && response.ok && response.body) {
      clearTimeout(timer); // opening deadline; the overall signal governs reading
      const reader = response.body.getReader();
      return new Response(new ReadableStream({
        async pull(destination) {
          try {
            const chunk = await reader.read();
            if (chunk.done) { cleanup(); destination.close(); }
            else destination.enqueue(chunk.value);
          } catch (error) { cleanup(); destination.error(error); }
        },
        async cancel(reason) { controller.abort(); cleanup(); await reader.cancel(reason); },
      }), { status: response.status, headers: resultHeaders });
    }
    const bytes = await response.arrayBuffer();
    cleanup();
    if (provider === 'openai' && !response.ok) {
      try {
        if (JSON.parse(new TextDecoder().decode(bytes))?.error?.code === 'insufficient_quota') {
          resultHeaders.set('x-ai-error-code', 'insufficient_quota');
          console.warn('[recipe-ai] OpenAI credit unavailable');
        }
      } catch { /* Never log provider bodies. */ }
    }
    if (provider !== 'openai' || !response.ok || (!native && !translated.wrapped)) {
      return new Response(bytes, { status: response.status, headers: resultHeaders });
    }
    const result = JSON.parse(new TextDecoder().decode(bytes));
    const choice = result.choices?.[0];
    if (translated.wrapped && choice?.finish_reason === 'stop' && !choice.message?.refusal) {
      try {
        const parsed = JSON.parse(choice.message.content);
        if (Array.isArray(parsed?.days)) choice.message.content = JSON.stringify(parsed.days);
      } catch { /* Existing caller parsers reject malformed content. */ }
    }
    if (native) {
      return Response.json({ candidates: [{
        finishReason: choice?.finish_reason === 'stop' && !choice.message?.refusal ? 'STOP'
          : choice?.finish_reason === 'length' ? 'MAX_TOKENS' : 'SAFETY',
        content: { parts: [{ text: choice?.message?.content ?? '' }] },
      }] }, { headers: { 'x-ai-provider': provider } });
    }
    return Response.json(result, { headers: { 'x-ai-provider': provider } });
  } catch (error) {
    cleanup();
    // Body reads may report AbortError even when our timer caused the abort.
    if (provider === 'openai' && signal.aborted && signal.reason?.name === 'TimeoutError') throw new BackupTransportError('Backup provider timed out');
    if (signal.aborted) throw signal.reason;
    if (provider === 'openai' && !(error instanceof BackupInputError)) throw new BackupTransportError('Backup provider request failed');
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  }
}

async function recipeAI(init: RequestInit, native: boolean, options: RecipeAIOptions): Promise<Response> {
  const body = JSON.parse(String(init.body));
  const mode = aiProviderMode();
  const totalMs = Math.max(1, Math.min(options.totalMs ?? 45_000, 250_000));
  const backup = mode === 'auto' && Boolean(process.env.OPENAI_API_KEY);
  const provider: Provider = mode === 'openai' || (backup && !AI_API_KEY) ? 'openai' : 'gemini';
  if (!hasRecipeAIKey()) throw new Error('Recipe AI is not configured.');
  const controller = new AbortController();
  const caller = init.signal;
  const abort = () => controller.abort(caller?.reason);
  caller?.addEventListener('abort', abort, { once: true });
  if (caller?.aborted) abort();
  // Caller deadlines can be shorter, but no route can leave this transport unbounded.
  const totalTimer = setTimeout(() => controller.abort(new DOMException('AI deadline reached', 'TimeoutError')), totalMs);
  const cleanup = () => { clearTimeout(totalTimer); caller?.removeEventListener('abort', abort); controller.signal.removeEventListener('abort', cleanup); };
  controller.signal.addEventListener('abort', cleanup, { once: true });
  try {
    let response: Response;
    try {
      response = await request(provider, init, body, native, controller.signal, totalMs);
    } catch (error) {
      if (error instanceof BackupTransportError) throw error;
      controller.signal.throwIfAborted();
      // Do not interpret schema/conversion/parser errors as an outage.
      if (!backup || provider !== 'gemini' || !(error instanceof ProviderConnectionError)) throw error;
      response = await request('openai', init, body, native, controller.signal, totalMs);
      return finish(response);
    }
    if (backup && provider === 'gemini' && (response.status === 403 || response.status === 429 || response.status >= 500)) {
      await response.body?.cancel();
      controller.signal.throwIfAborted();
      response = await request('openai', init, body, native, controller.signal, totalMs);
    }
    return finish(response);
  } catch (error) { cleanup(); throw error; }

  function finish(response: Response) {
    if (!body.stream || !response.ok || !response.body) { cleanup(); return response; }
    const reader = response.body.getReader();
    return new Response(new ReadableStream({
      async pull(destination) {
        try {
          const chunk = await reader.read();
          if (chunk.done) { cleanup(); destination.close(); }
          else destination.enqueue(chunk.value);
        } catch (error) { cleanup(); destination.error(error); }
      },
      async cancel(reason) { controller.abort(); cleanup(); await reader.cancel(reason); },
    }), { status: response.status, headers: response.headers });
  }
}

export const recipeChat = (init: RequestInit, options: RecipeAIOptions = {}) => recipeAI(init, false, options);
export const recipeGenerate = (init: RequestInit, options: RecipeAIOptions = {}) => recipeAI(init, true, options);
