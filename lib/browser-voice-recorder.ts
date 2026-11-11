// Browser-side voice capture for the generator's Voice tab.
//
// Records the microphone with MediaRecorder and uploads the clip to
// /api/transcribe-audio. This file has no React in it on purpose: every
// browser API it touches can be swapped out through `env`, so the whole
// lifecycle (permission prompt, stop, cancel, time limit, cleanup) is covered
// by scripts/verify-voice-recorder.ts without a real microphone.

// Matches the one-minute limit promised on the privacy page.
export const MAX_RECORDING_MS = 60_000;
// Vercel rejects request bodies over 4.5 MB before our route ever runs, so
// stay comfortably below that (the multipart wrapper adds a little overhead).
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
// Speech does not need more than this, and it keeps a full minute near 0.5 MB.
const AUDIO_BITS_PER_SECOND = 64_000;
// The server gives up after 45 s; allow a little extra for the upload itself.
const TRANSCRIBE_TIMEOUT_MS = 60_000;
// If a browser never fires the recorder's "stop" event, finish anyway.
const STOP_GRACE_MS = 3_000;

// Chrome, Edge, Firefox and newer Safari record WebM/Opus. Older Safari and
// iOS only record MP4/AAC. Ask the browser instead of guessing by name.
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
];

export type VoiceRecorderErrorCode =
  | 'unsupported'
  | 'insecure-context'
  | 'blocked-by-policy'
  | 'permission-denied'
  | 'no-microphone'
  | 'microphone-busy'
  | 'start-failed'
  | 'recorder-error'
  | 'empty'
  | 'too-large';

const ERROR_MESSAGES: Record<VoiceRecorderErrorCode, string> = {
  unsupported: 'This browser cannot record audio. Please type your ingredients instead.',
  'insecure-context': 'Voice input needs a secure (https) connection. Please type your ingredients instead.',
  'blocked-by-policy': 'The microphone is turned off for this page, so voice input cannot start. Please type your ingredients instead.',
  'permission-denied': 'Microphone access was denied. Allow the microphone for this site in your browser settings, then try again.',
  'no-microphone': 'No microphone was found. Connect one and try again, or type your ingredients.',
  'microphone-busy': 'The microphone could not be started. Close other apps that are using it and try again.',
  'start-failed': 'Voice recording could not start. Please try again or type your ingredients.',
  'recorder-error': 'The recording stopped unexpectedly. Please try again or type your ingredients.',
  empty: 'No audio was captured. Please try again and speak after the recording starts.',
  'too-large': 'That recording is too large to send. Please record a shorter message.',
};

export class VoiceRecorderError extends Error {
  readonly code: VoiceRecorderErrorCode;
  constructor(code: VoiceRecorderErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'VoiceRecorderError';
    this.code = code;
  }
}

export interface VoiceRecording {
  blob: Blob;
  /** Container type without codec details, e.g. "audio/webm" or "audio/mp4". */
  mimeType: string;
  fileName: string;
  durationMs: number;
  /** "max-duration" when the time limit ended the recording, not the user. */
  reason: 'stopped' | 'max-duration';
}

export interface VoiceRecorderCallbacks {
  /** The microphone is live and audio is being captured. */
  onStart?: () => void;
  /** Loudness from 0 to 1 for the animation. Never called if metering is unavailable. */
  onLevel?: (level: number) => void;
  onComplete: (recording: VoiceRecording) => void;
  onError: (error: VoiceRecorderError) => void;
}

/** The browser pieces the recorder uses. Tests pass fakes; the app uses the real ones. */
export interface VoiceRecorderEnv {
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  MediaRecorder?: typeof MediaRecorder;
  AudioContext?: typeof AudioContext;
  isSecureContext: boolean;
  /** false only when the site's Permissions-Policy header forbids the microphone. */
  microphoneAllowedByPolicy: boolean;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: any) => void;
  requestAnimationFrame?: (fn: () => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
  now: () => number;
}

export interface VoiceRecorderOptions {
  maxDurationMs?: number;
  maxBytes?: number;
  env?: Partial<VoiceRecorderEnv>;
}

export interface VoiceRecorderSession {
  /** Finish the recording and deliver it through onComplete. */
  stop: () => void;
  /** Throw the recording away. No callback fires after this returns. */
  cancel: () => void;
  readonly state: 'starting' | 'recording' | 'stopping' | 'finished';
}

function browserEnv(): VoiceRecorderEnv {
  const g = globalThis as any;
  const mediaDevices = g.navigator?.mediaDevices;
  let allowed = true;
  try {
    const policy = g.document?.permissionsPolicy ?? g.document?.featurePolicy;
    if (policy?.allowsFeature) allowed = policy.allowsFeature('microphone') !== false;
  } catch {
    // Only Chromium exposes this check; elsewhere getUserMedia reports the block.
  }
  return {
    getUserMedia: mediaDevices?.getUserMedia ? (c) => mediaDevices.getUserMedia(c) : undefined,
    MediaRecorder: g.MediaRecorder,
    AudioContext: g.AudioContext ?? g.webkitAudioContext,
    isSecureContext: g.isSecureContext !== false,
    microphoneAllowedByPolicy: allowed,
    setTimeout: (fn, ms) => g.setTimeout(fn, ms),
    clearTimeout: (handle) => g.clearTimeout(handle),
    requestAnimationFrame: g.requestAnimationFrame ? (fn) => g.requestAnimationFrame(fn) : undefined,
    cancelAnimationFrame: g.cancelAnimationFrame ? (handle) => g.cancelAnimationFrame(handle) : undefined,
    now: () => Date.now(),
  };
}

export function pickRecordingMimeType(recorderCtor: { isTypeSupported?: (type: string) => boolean } | undefined): string | undefined {
  if (!recorderCtor?.isTypeSupported) return undefined;
  for (const candidate of MIME_CANDIDATES) {
    try {
      if (recorderCtor.isTypeSupported(candidate)) return candidate;
    } catch {
      // Treat a throwing check as "not supported" and keep looking.
    }
  }
  return undefined;
}

/** Turns whatever the browser reported into a clean type and matching file name. */
export function describeRecordingType(rawMimeType: string): { mimeType: string; fileName: string } {
  const base = rawMimeType.split(';')[0].trim().toLowerCase();
  if (base.includes('mp4') || base.includes('m4a') || base.includes('aac')) {
    return { mimeType: 'audio/mp4', fileName: 'recording.m4a' };
  }
  if (base.includes('ogg')) return { mimeType: 'audio/ogg', fileName: 'recording.ogg' };
  if (base.includes('wav')) return { mimeType: 'audio/wav', fileName: 'recording.wav' };
  // The server also inspects the file's first bytes, so WebM is a safe default label.
  return { mimeType: 'audio/webm', fileName: 'recording.webm' };
}

function getUserMediaErrorCode(error: unknown, env: VoiceRecorderEnv): VoiceRecorderErrorCode {
  const name = (error as { name?: string } | null)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return env.microphoneAllowedByPolicy ? 'permission-denied' : 'blocked-by-policy';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'no-microphone';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'microphone-busy';
  return 'start-failed';
}

export function startVoiceRecording(callbacks: VoiceRecorderCallbacks, options: VoiceRecorderOptions = {}): VoiceRecorderSession {
  const env: VoiceRecorderEnv = { ...browserEnv(), ...options.env };
  const maxDurationMs = options.maxDurationMs ?? MAX_RECORDING_MS;
  const maxBytes = options.maxBytes ?? MAX_UPLOAD_BYTES;

  let state: VoiceRecorderSession['state'] = 'starting';
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let audioContext: AudioContext | null = null;
  let animationFrame: number | null = null;
  let maxTimer: unknown = null;
  let graceTimer: unknown = null;
  let startedAt = 0;
  let reason: VoiceRecording['reason'] = 'stopped';
  let chosenMimeType: string | undefined;
  const chunks: Blob[] = [];

  // Stops the microphone, timers and meter. Safe to call more than once.
  function release() {
    if (maxTimer !== null) { env.clearTimeout(maxTimer); maxTimer = null; }
    if (graceTimer !== null) { env.clearTimeout(graceTimer); graceTimer = null; }
    if (animationFrame !== null) { env.cancelAnimationFrame?.(animationFrame); animationFrame = null; }
    if (audioContext) {
      const context = audioContext;
      audioContext = null;
      try { void Promise.resolve(context.close()).catch(() => {}); } catch { /* already closed */ }
    }
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      try { if (recorder.state !== 'inactive') recorder.stop(); } catch { /* already stopped */ }
      recorder = null;
    }
    if (stream) {
      for (const track of stream.getTracks()) {
        try { track.stop(); } catch { /* already stopped */ }
      }
      stream = null;
    }
  }

  function fail(code: VoiceRecorderErrorCode) {
    if (state === 'finished') return;
    state = 'finished';
    release();
    callbacks.onError(new VoiceRecorderError(code));
  }

  function finish() {
    if (state === 'finished') return;
    const rawType = recorder?.mimeType || chosenMimeType || chunks[0]?.type || '';
    const durationMs = Math.max(0, env.now() - startedAt);
    state = 'finished';
    release();
    const { mimeType, fileName } = describeRecordingType(rawType);
    const blob = new Blob(chunks, { type: mimeType });
    if (blob.size === 0) { callbacks.onError(new VoiceRecorderError('empty')); return; }
    if (blob.size > maxBytes) { callbacks.onError(new VoiceRecorderError('too-large')); return; }
    callbacks.onComplete({ blob, mimeType, fileName, durationMs, reason });
  }

  // The level meter is decoration. Any failure here must not affect recording.
  function startMeter(activeStream: MediaStream) {
    if (!callbacks.onLevel || !env.AudioContext || !env.requestAnimationFrame) return;
    try {
      const context = new env.AudioContext();
      audioContext = context;
      void Promise.resolve(context.resume?.()).catch(() => {});
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(activeStream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let lastLevel = -1;
      const tick = () => {
        if (state !== 'recording' || audioContext !== context) return;
        try {
          analyser.getByteFrequencyData(data);
          let total = 0;
          for (let i = 0; i < data.length; i++) total += data[i];
          const level = data.length ? total / data.length / 255 : 0;
          // Skip tiny changes so the page does not re-render 60 times a second.
          if (Math.abs(level - lastLevel) >= 0.02) { lastLevel = level; callbacks.onLevel?.(level); }
        } catch {
          return;
        }
        animationFrame = env.requestAnimationFrame!(tick);
      };
      animationFrame = env.requestAnimationFrame(tick);
    } catch {
      if (audioContext) {
        const context = audioContext;
        audioContext = null;
        try { void Promise.resolve(context.close()).catch(() => {}); } catch { /* ignore */ }
      }
    }
  }

  function begin(activeStream: MediaStream) {
    // The user cancelled (or left the page) while the permission prompt was
    // open: switch the microphone straight back off and stay silent.
    if (state !== 'starting') {
      for (const track of activeStream.getTracks()) {
        try { track.stop(); } catch { /* already stopped */ }
      }
      return;
    }
    stream = activeStream;
    try {
      const Recorder = env.MediaRecorder!;
      chosenMimeType = pickRecordingMimeType(Recorder);
      try {
        recorder = new Recorder(activeStream, {
          ...(chosenMimeType ? { mimeType: chosenMimeType } : {}),
          audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
        });
      } catch {
        // Some browsers reject options they advertise; their defaults still work.
        chosenMimeType = undefined;
        recorder = new Recorder(activeStream);
      }
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };
      // Also fires if the microphone is unplugged, so that audio is kept too.
      recorder.onstop = () => finish();
      recorder.onerror = () => fail('recorder-error');
      recorder.start();
    } catch {
      fail('start-failed');
      return;
    }
    state = 'recording';
    startedAt = env.now();
    maxTimer = env.setTimeout(() => {
      maxTimer = null;
      reason = 'max-duration';
      session.stop();
    }, maxDurationMs);
    startMeter(activeStream);
    callbacks.onStart?.();
  }

  const session: VoiceRecorderSession = {
    get state() { return state; },
    stop() {
      // Nothing has been recorded yet, so stopping early is the same as cancelling.
      if (state === 'starting') { session.cancel(); return; }
      if (state !== 'recording') return;
      state = 'stopping';
      if (maxTimer !== null) { env.clearTimeout(maxTimer); maxTimer = null; }
      if (animationFrame !== null) { env.cancelAnimationFrame?.(animationFrame); animationFrame = null; }
      try {
        if (recorder && recorder.state !== 'inactive') {
          recorder.stop();
          graceTimer = env.setTimeout(() => { graceTimer = null; finish(); }, STOP_GRACE_MS);
        } else {
          finish();
        }
      } catch {
        finish();
      }
    },
    cancel() {
      if (state === 'finished') return;
      state = 'finished';
      release();
    },
  };

  if (!env.getUserMedia || !env.MediaRecorder) {
    const code: VoiceRecorderErrorCode = env.isSecureContext ? 'unsupported' : 'insecure-context';
    // Report on the next tick so callers always receive the session first.
    void Promise.resolve().then(() => fail(code));
    return session;
  }
  if (!env.microphoneAllowedByPolicy) {
    void Promise.resolve().then(() => fail('blocked-by-policy'));
    return session;
  }

  let pending: Promise<MediaStream>;
  try {
    pending = env.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  } catch (error) {
    pending = Promise.reject(error);
  }
  pending.then(begin, (error) => fail(getUserMediaErrorCode(error, env)));
  return session;
}

export interface TranscribeOptions {
  /** Abort to cancel the upload (for example when the user leaves the page). */
  signal?: AbortSignal;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

function fallbackTranscriptionMessage(status: number): string {
  if (status === 401) return 'Please sign in again to use voice input.';
  if (status === 413) return 'That recording is too large to send. Please record a shorter message.';
  if (status === 429) return 'Please wait a minute before trying voice again.';
  return 'Failed to transcribe audio. Please try again or type your ingredients.';
}

/**
 * Uploads a finished recording and returns the transcript ("" for silence).
 * Throws an Error whose message is safe to show the user. If `signal` is
 * aborted it throws an AbortError instead, which callers should ignore.
 */
export async function transcribeRecording(recording: VoiceRecording, options: TranscribeOptions = {}): Promise<string> {
  const doFetch = options.fetch ?? fetch;
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeoutMs ?? TRANSCRIBE_TIMEOUT_MS);

  try {
    const formData = new FormData();
    formData.append('audio', recording.blob, recording.fileName);
    const response = await doFetch('/api/transcribe-audio', { method: 'POST', body: formData, signal: controller.signal });
    // Errors raised by the hosting platform (not our route) may not be JSON.
    const data: any = await response.json().catch(() => null);
    if (!response.ok) {
      // "Unauthorized" and "Internal server error" are accurate but not helpful.
      const serverMessage = typeof data?.error === 'string' && data.error.trim() && response.status !== 401 && data.error !== 'Internal server error'
        ? data.error.trim()
        : '';
      throw new Error(serverMessage || fallbackTranscriptionMessage(response.status));
    }
    return typeof data?.text === 'string' ? data.text.trim() : '';
  } catch (error) {
    if (options.signal?.aborted) {
      const abortError = new Error('Transcription canceled.');
      abortError.name = 'AbortError';
      throw abortError;
    }
    if (timedOut) throw new Error('Transcription took too long. Please try again or type your ingredients.');
    if (error instanceof TypeError) throw new Error('Could not reach Recipe Reborn. Check your connection and try again.');
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}
