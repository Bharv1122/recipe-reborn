import { AI_API_KEY, AI_AUDIO_URL } from './ai';
import { aiProviderMode, BackupInputError } from './ai-provider';

// File transcription is a different API from chat/vision. Never pass audio
// through the image fallback or re-send a successful/blocked transcript.
export async function transcribeAudio(audio: Blob, format: string, nativeBody: unknown, signal: AbortSignal): Promise<Response> {
  const mode = aiProviderMode();
  const canBackup = mode === 'auto' && Boolean(process.env.OPENAI_API_KEY);
  async function openai() {
    if (!['mp3', 'mp4', 'wav', 'webm'].includes(format)) {
      throw new BackupInputError('Please record again as M4A, MP3, WAV, or WebM, or type your words.');
    }
    signal.throwIfAborted();
    const form = new FormData();
    form.set('file', audio, `recording.${format === 'mp4' ? 'm4a' : format}`);
    form.set('model', 'gpt-4o-mini-transcribe');
    form.set('response_format', 'json');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form, signal,
    });
    if (!response.ok) { await response.body?.cancel(); return new Response(null, { status: response.status }); }
    const payload = await response.json();
    if (typeof payload.text !== 'string' || payload.text.length > 16000) return new Response(null, { status: 502 });
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: payload.text }] } }] });
  }
  if (mode === 'openai' || (canBackup && !AI_API_KEY)) return openai();
  let response: Response;
  try {
    response = await fetch(AI_AUDIO_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': AI_API_KEY },
      body: JSON.stringify(nativeBody), signal,
    });
  } catch (error) {
    signal.throwIfAborted();
    const code = (error as { cause?: { code?: string } })?.cause?.code;
    if (canBackup && error instanceof TypeError && typeof code === 'string'
      && /^(ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET)$/.test(code)) return openai();
    throw error;
  }
  if (canBackup && (response.status === 403 || response.status === 429 || response.status >= 500)) {
    await response.body?.cancel();
    return openai();
  }
  return response;
}
