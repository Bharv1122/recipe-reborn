// Lifecycle regression test for the generator's browser voice recorder.
// Run: npx tsx scripts/verify-voice-recorder.ts
//
// Drives the real lib/browser-voice-recorder.ts code against fake browser
// pieces (microphone stream, MediaRecorder, AudioContext, timers, fetch).
// No real microphone, network or AI service is used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  MAX_RECORDING_MS,
  MAX_UPLOAD_BYTES,
  startVoiceRecording,
  transcribeRecording,
  VoiceRecorderError,
  type VoiceRecorderEnv,
  type VoiceRecording,
} from '../lib/browser-voice-recorder';

const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

class FakeTrack {
  stopped = 0;
  stop() { this.stopped++; }
}
class FakeStream {
  tracks = [new FakeTrack()];
  getTracks() { return this.tracks; }
}

interface RecorderBehavior {
  supported: string[];          // what isTypeSupported accepts
  defaultMimeType: string;      // what the browser reports when given no type
  rejectOptions?: boolean;      // constructor throws when options are passed
  chunkBytes?: number;          // size of the clip delivered on stop
  neverFiresStop?: boolean;     // stop() delivers data but no "stop" event
  startThrows?: boolean;
}

function makeRecorderClass(behavior: RecorderBehavior) {
  return class FakeMediaRecorder {
    static instances: FakeMediaRecorder[] = [];
    static isTypeSupported(type: string) { return behavior.supported.includes(type); }
    state: 'inactive' | 'recording' = 'inactive';
    mimeType: string;
    stopCalls = 0;
    ondataavailable: ((event: any) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    constructor(public stream: FakeStream, public options?: { mimeType?: string; audioBitsPerSecond?: number }) {
      if (options && behavior.rejectOptions) throw new Error('NotSupportedError');
      this.mimeType = options?.mimeType ?? behavior.defaultMimeType;
      FakeMediaRecorder.instances.push(this);
    }
    start() {
      if (behavior.startThrows) throw new Error('InvalidStateError');
      this.state = 'recording';
    }
    stop() {
      if (this.state === 'inactive') throw new Error('InvalidStateError');
      this.stopCalls++;
      this.state = 'inactive';
      // Real browsers deliver the data and the stop event asynchronously.
      queueMicrotask(() => {
        const bytes = behavior.chunkBytes ?? 2048;
        this.ondataavailable?.({ data: new Blob([new Uint8Array(bytes)], { type: this.mimeType }) });
        if (!behavior.neverFiresStop) this.onstop?.();
      });
    }
  };
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  closed = 0;
  constructor() { FakeAudioContext.instances.push(this); }
  resume() { return Promise.resolve(); }
  close() { this.closed++; return Promise.resolve(); }
  createAnalyser() {
    return {
      fftSize: 0,
      frequencyBinCount: 4,
      getByteFrequencyData(data: Uint8Array) { data.fill(128); },
    };
  }
  createMediaStreamSource() { return { connect() {} }; }
}

function makeHarness(behavior: Partial<RecorderBehavior> = {}, envOverrides: Partial<VoiceRecorderEnv> = {}) {
  const Recorder = makeRecorderClass({
    supported: ['audio/webm;codecs=opus', 'audio/webm'],
    defaultMimeType: 'audio/webm;codecs=opus',
    ...behavior,
  });
  FakeAudioContext.instances = [];
  const stream = new FakeStream();
  let now = 1_000;
  let nextId = 1;
  const timers = new Map<number, { fn: () => void; at: number }>();
  const frames = new Map<number, () => void>();
  let getUserMediaCalls = 0;
  let resolveMic!: (stream: any) => void;
  let rejectMic!: (error: any) => void;
  const micPromise = new Promise<any>((resolve, reject) => { resolveMic = resolve; rejectMic = reject; });

  const events: string[] = [];
  let completed: VoiceRecording | undefined;
  let failed: VoiceRecorderError | undefined;
  const levels: number[] = [];

  const env: Partial<VoiceRecorderEnv> = {
    getUserMedia: () => { getUserMediaCalls++; return micPromise; },
    MediaRecorder: Recorder as any,
    AudioContext: FakeAudioContext as any,
    isSecureContext: true,
    microphoneAllowedByPolicy: true,
    setTimeout: (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    requestAnimationFrame: (fn) => { const id = nextId++; frames.set(id, fn); return id; },
    cancelAnimationFrame: (id) => { frames.delete(id); },
    now: () => now,
    ...envOverrides,
  };

  const session = startVoiceRecording({
    onStart: () => events.push('start'),
    onLevel: (level) => levels.push(level),
    onComplete: (recording) => { events.push('complete'); completed = recording; },
    onError: (error) => { events.push(`error:${error.code}`); failed = error; },
  }, { env });

  return {
    session, stream, Recorder, events, levels, timers, frames,
    get completed() { return completed; },
    get failed() { return failed; },
    get getUserMediaCalls() { return getUserMediaCalls; },
    get recorder() { return Recorder.instances[Recorder.instances.length - 1]; },
    async grantMic() { resolveMic(stream); await flush(); },
    async denyMic(name: string) { rejectMic(Object.assign(new Error(name), { name })); await flush(); },
    async advance(ms: number) {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now && timers.delete(id)) timer.fn();
      }
      await flush();
    },
    runFrame() { for (const [id, fn] of [...frames]) { frames.delete(id); fn(); } },
    assertReleased(label: string) {
      assert.ok(stream.tracks.every((track) => track.stopped >= 1), `${label}: microphone track must be stopped`);
      assert.equal(timers.size, 0, `${label}: no timers may be left running`);
      assert.equal(frames.size, 0, `${label}: no animation frame may be left scheduled`);
      for (const context of FakeAudioContext.instances) assert.equal(context.closed, 1, `${label}: audio context must be closed once`);
      assert.equal(session.state, 'finished', `${label}: session must be finished`);
    },
  };
}

async function recorderLifecycle() {
  // Chrome/Edge/Firefox: WebM, normal start and stop.
  {
    const h = makeHarness();
    assert.equal(h.session.state, 'starting');
    assert.deepEqual(h.events, [], 'Nothing is reported while the permission prompt is open');
    await h.grantMic();
    assert.deepEqual(h.events, ['start']);
    assert.equal(h.session.state, 'recording');
    assert.equal(h.recorder.options?.mimeType, 'audio/webm;codecs=opus');
    assert.equal([...h.timers.values()][0].at - 1_000, MAX_RECORDING_MS, 'Time limit is armed when recording starts');
    h.runFrame();
    assert.ok(h.levels.length === 1 && h.levels[0] > 0.4 && h.levels[0] < 0.6, 'Level meter reports loudness');
    await h.advance(5_000);
    h.session.stop();
    h.session.stop(); // a double tap on Stop
    await flush();
    assert.deepEqual(h.events, ['start', 'complete'], 'Exactly one completion');
    assert.equal(h.recorder.stopCalls, 1, 'Stop really stops the active recorder, once');
    assert.equal(h.completed!.mimeType, 'audio/webm');
    assert.equal(h.completed!.blob.type, 'audio/webm');
    assert.equal(h.completed!.fileName, 'recording.webm');
    assert.equal(h.completed!.blob.size, 2048);
    assert.equal(h.completed!.durationMs, 5_000);
    assert.equal(h.completed!.reason, 'stopped');
    h.assertReleased('webm stop');
    h.session.cancel(); h.session.stop();
    await h.advance(MAX_RECORDING_MS * 2);
    assert.deepEqual(h.events, ['start', 'complete'], 'Nothing fires after completion');
  }

  // Safari/iOS that only records MP4: labelled as M4A, never as WebM.
  {
    const h = makeHarness({ supported: ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4'], defaultMimeType: 'audio/mp4' });
    await h.grantMic();
    assert.equal(h.recorder.options?.mimeType, 'audio/mp4;codecs=mp4a.40.2');
    h.session.stop(); await flush();
    assert.equal(h.completed!.mimeType, 'audio/mp4');
    assert.equal(h.completed!.blob.type, 'audio/mp4');
    assert.equal(h.completed!.fileName, 'recording.m4a');
  }

  // Browser answers "no" to every type check: use what the recorder itself reports.
  {
    const h = makeHarness({ supported: [], defaultMimeType: 'audio/mp4;codecs=mp4a.40.2' });
    await h.grantMic();
    assert.equal(h.recorder.options?.mimeType, undefined, 'No unsupported type is forced on the recorder');
    h.session.stop(); await flush();
    assert.equal(h.completed!.fileName, 'recording.m4a');
  }

  // Browser rejects recorder options: retry with defaults instead of failing.
  {
    const h = makeHarness({ rejectOptions: true, defaultMimeType: 'audio/mp4' });
    await h.grantMic();
    assert.deepEqual(h.events, ['start']);
    assert.equal(h.recorder.options, undefined);
    h.session.stop(); await flush();
    assert.equal(h.completed!.fileName, 'recording.m4a', 'Type comes from the recorder, not the rejected request');
  }

  // Cancel (unmount) while the permission prompt is open, then permission arrives late.
  for (const action of ['cancel', 'stop'] as const) {
    const h = makeHarness();
    h.session[action]();
    assert.equal(h.session.state, 'finished');
    await h.grantMic();
    assert.equal(h.stream.tracks[0].stopped, 1, `${action}: late microphone stream is switched off immediately`);
    assert.equal(h.Recorder.instances.length, 0, `${action}: no recorder is created after cancelling`);
    assert.equal(FakeAudioContext.instances.length, 0);
    assert.deepEqual(h.events, [], `${action}: no late callbacks`);
    assert.equal(h.timers.size, 0);
  }

  // Cancel (unmount) while the permission prompt is open, then permission is refused late.
  {
    const h = makeHarness();
    h.session.cancel();
    await h.denyMic('NotAllowedError');
    assert.deepEqual(h.events, [], 'A late refusal after cancelling is not reported');
  }

  // Cancel (unmount) mid-recording: recorder stops, nothing is delivered for upload.
  {
    const h = makeHarness();
    await h.grantMic();
    h.runFrame();
    const recorder = h.recorder;
    h.session.cancel();
    await flush();
    assert.equal(recorder.state, 'inactive', 'Recorder is stopped on cancel');
    assert.deepEqual(h.events, ['start'], 'Cancelled audio is never delivered');
    assert.equal(h.completed, undefined);
    h.assertReleased('cancel while recording');
    const levelCount = h.levels.length;
    h.runFrame(); await h.advance(MAX_RECORDING_MS * 2);
    assert.equal(h.levels.length, levelCount, 'No level updates after cancel');
    assert.deepEqual(h.events, ['start']);
  }

  // Cancel between Stop and the recorder's stop event.
  {
    const h = makeHarness();
    await h.grantMic();
    h.session.stop();
    h.session.cancel();
    await flush();
    assert.deepEqual(h.events, ['start'], 'Cancel wins over an in-flight stop');
    h.assertReleased('cancel while stopping');
  }

  // One-minute limit ends the recording by itself and keeps the audio.
  {
    const h = makeHarness();
    await h.grantMic();
    await h.advance(MAX_RECORDING_MS - 1);
    assert.deepEqual(h.events, ['start']);
    await h.advance(1);
    assert.deepEqual(h.events, ['start', 'complete']);
    assert.equal(h.completed!.reason, 'max-duration');
    assert.equal(h.recorder.stopCalls, 1);
    h.assertReleased('time limit');
  }

  // Oversized and empty clips are reported, never handed over for upload.
  {
    assert.ok(MAX_UPLOAD_BYTES < 4.5 * 1024 * 1024, 'Upload cap stays below the Vercel body limit');
    const big = makeHarness({ chunkBytes: MAX_UPLOAD_BYTES + 1 });
    await big.grantMic(); big.session.stop(); await flush();
    assert.deepEqual(big.events, ['start', 'error:too-large']);
    big.assertReleased('too large');
    const limit = makeHarness({ chunkBytes: MAX_UPLOAD_BYTES });
    await limit.grantMic(); limit.session.stop(); await flush();
    assert.deepEqual(limit.events, ['start', 'complete'], 'A clip exactly at the cap is allowed');
    const empty = makeHarness({ chunkBytes: 0 });
    await empty.grantMic(); empty.session.stop(); await flush();
    assert.deepEqual(empty.events, ['start', 'error:empty']);
    empty.assertReleased('empty');
  }

  // Microphone errors map to distinct, clear messages.
  for (const [name, code] of [
    ['NotAllowedError', 'permission-denied'], ['SecurityError', 'permission-denied'],
    ['NotFoundError', 'no-microphone'], ['OverconstrainedError', 'no-microphone'],
    ['NotReadableError', 'microphone-busy'], ['SomethingElse', 'start-failed'],
  ] as const) {
    const h = makeHarness();
    await h.denyMic(name);
    assert.deepEqual(h.events, [`error:${code}`], name);
    assert.ok(h.failed instanceof VoiceRecorderError && h.failed.message.length > 20);
    assert.equal(h.Recorder.instances.length, 0);
    assert.equal(h.session.state, 'finished');
  }
  {
    const denied = makeHarness(); await denied.denyMic('NotAllowedError');
    assert.match(denied.failed!.message, /denied/i);
    assert.match(denied.failed!.message, /browser settings/i);
  }

  // Site policy forbids the microphone: say so, and do not prompt.
  {
    const h = makeHarness({}, { microphoneAllowedByPolicy: false });
    assert.deepEqual(h.events, [], 'Errors are reported after the session is returned');
    await flush();
    assert.deepEqual(h.events, ['error:blocked-by-policy']);
    assert.equal(h.getUserMediaCalls, 0);
    assert.doesNotMatch(h.failed!.message, /denied/i, 'A policy block is not blamed on the user');
  }

  // Missing browser support, with and without a secure connection.
  {
    const noRecorder = makeHarness({}, { MediaRecorder: undefined }); await flush();
    assert.deepEqual(noRecorder.events, ['error:unsupported']);
    assert.equal(noRecorder.getUserMediaCalls, 0, 'No permission prompt when recording is impossible');
    const noMedia = makeHarness({}, { getUserMedia: undefined }); await flush();
    assert.deepEqual(noMedia.events, ['error:unsupported']);
    const insecure = makeHarness({}, { getUserMedia: undefined, isSecureContext: false }); await flush();
    assert.deepEqual(insecure.events, ['error:insecure-context']);
    const cancelled = makeHarness({}, { MediaRecorder: undefined }); cancelled.session.cancel(); await flush();
    assert.deepEqual(cancelled.events, [], 'Cancelling first suppresses the unsupported report');
  }

  // The level meter is optional: failures and absence never block recording.
  {
    class BrokenAudioContext { constructor() { throw new Error('not allowed to start'); } }
    for (const AudioContextImpl of [BrokenAudioContext, undefined]) {
      const h = makeHarness({}, { AudioContext: AudioContextImpl as any });
      await h.grantMic();
      assert.deepEqual(h.events, ['start']);
      h.session.stop(); await flush();
      assert.deepEqual(h.events, ['start', 'complete']);
      assert.equal(h.levels.length, 0);
      h.assertReleased('no meter');
    }
    const noFrames = makeHarness({}, { requestAnimationFrame: undefined, cancelAnimationFrame: undefined });
    await noFrames.grantMic(); noFrames.session.stop(); await flush();
    assert.deepEqual(noFrames.events, ['start', 'complete']);
    assert.equal(FakeAudioContext.instances.length, 0, 'No audio context is opened when it cannot be animated');
  }

  // Recorder cannot start: microphone is released and one error is reported.
  {
    const h = makeHarness({ startThrows: true });
    await h.grantMic();
    assert.deepEqual(h.events, ['error:start-failed']);
    h.assertReleased('start failure');
  }

  // Recorder reports an error mid-recording.
  {
    const h = makeHarness();
    await h.grantMic();
    const recorder = h.recorder;
    recorder.onerror?.({});
    assert.equal(recorder.onstop, null, 'Handlers are detached so the failed clip cannot complete later');
    await flush();
    assert.deepEqual(h.events, ['start', 'error:recorder-error']);
    h.assertReleased('recorder error');
  }

  // Microphone unplugged: the browser stops the recorder itself; keep the audio.
  {
    const h = makeHarness();
    await h.grantMic();
    h.recorder.stop();
    await flush();
    assert.deepEqual(h.events, ['start', 'complete']);
    h.assertReleased('unplugged');
  }

  // Browser never fires the stop event: finish after a short grace period.
  {
    const h = makeHarness({ neverFiresStop: true });
    await h.grantMic();
    h.session.stop(); await flush();
    assert.deepEqual(h.events, ['start']);
    assert.equal(h.session.state, 'stopping');
    await h.advance(3_000);
    assert.deepEqual(h.events, ['start', 'complete']);
    assert.equal(h.completed!.blob.size, 2048);
    h.assertReleased('missing stop event');
  }
}

async function transcriptionUpload() {
  const recording: VoiceRecording = {
    blob: new Blob([new Uint8Array(64)], { type: 'audio/mp4' }),
    mimeType: 'audio/mp4', fileName: 'recording.m4a', durationMs: 1000, reason: 'stopped',
  };
  const respond = (body: unknown, status = 200) => (async () => Response.json(body, { status })) as unknown as typeof fetch;

  // Success: one multipart POST with the right field, name and type.
  {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch = (async (url: any, init: any) => { calls.push({ url: String(url), init }); return Response.json({ text: '  two eggs and rice ' }); }) as typeof fetch;
    assert.equal(await transcribeRecording(recording, { fetch: fakeFetch }), 'two eggs and rice');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/transcribe-audio');
    assert.equal(calls[0].init.method, 'POST');
    const file = (calls[0].init.body as FormData).get('audio') as File;
    assert.equal(file.name, 'recording.m4a');
    assert.equal(file.type, 'audio/mp4');
    assert.equal(file.size, 64);
    assert.ok(calls[0].init.signal instanceof AbortSignal);
    assert.equal(new Headers(calls[0].init.headers).get('content-type'), null, 'Browser must set the multipart boundary itself');
  }

  // Silence comes back as an empty transcript, not an error.
  assert.equal(await transcribeRecording(recording, { fetch: respond({ text: '' }) }), '');
  assert.equal(await transcribeRecording(recording, { fetch: respond({}) }), '');

  // The server's own explanation is shown to the user.
  for (const [status, error] of [
    [429, 'Please wait a minute before trying voice again.'],
    [504, 'Transcription took too long. Please try again or type your ingredients.'],
    [415, 'Please record again as M4A, MP3, WAV, or WebM, or type your words.'],
    [502, 'The recording was too long to transcribe fully. Please record a shorter message or type your ingredients.'],
  ] as const) {
    await assert.rejects(transcribeRecording(recording, { fetch: respond({ error }, status) }), { message: error });
  }

  // Unhelpful or missing server text is replaced with something actionable.
  await assert.rejects(transcribeRecording(recording, { fetch: respond({ error: 'Unauthorized' }, 401) }), /sign in again/i);
  await assert.rejects(transcribeRecording(recording, { fetch: respond({ error: 'Internal server error' }, 500) }), /Failed to transcribe audio/);
  const platform413 = (async () => new Response('Request Entity Too Large', { status: 413 })) as unknown as typeof fetch;
  await assert.rejects(transcribeRecording(recording, { fetch: platform413 }), /too large/i);
  const html500 = (async () => new Response('<html>oops</html>', { status: 500 })) as unknown as typeof fetch;
  await assert.rejects(transcribeRecording(recording, { fetch: html500 }), /Failed to transcribe audio/);
  const offline = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
  await assert.rejects(transcribeRecording(recording, { fetch: offline }), /Check your connection/);

  // A fetch that only settles when its signal aborts, like a real hung request.
  const hanging = ((_: any, init: any) => new Promise((_resolve, reject) => {
    const abort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    if (init.signal.aborted) abort(); else init.signal.addEventListener('abort', abort);
  })) as unknown as typeof fetch;

  // Leaving the page cancels the upload and is reported as an abort, not a failure.
  {
    const controller = new AbortController();
    const pending = transcribeRecording(recording, { fetch: hanging, signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    const already = new AbortController(); already.abort();
    await assert.rejects(transcribeRecording(recording, { fetch: hanging, signal: already.signal }), { name: 'AbortError' });
  }

  // A hung request times out with a clear message.
  await assert.rejects(transcribeRecording(recording, { fetch: hanging, timeoutMs: 10 }), /took too long/);
}

function componentWiring() {
  // Light source checks only; the behavior above is exercised for real.
  const source = fs.readFileSync(path.resolve(__dirname, '../app/generator/_components/voice-chat.tsx'), 'utf8');
  assert.ok(!/SpeechRecognition/.test(source.replace(/\/\/.*$/gm, '')), 'Voice tab must not depend on browser speech recognition');
  assert.ok(!source.includes('501'), 'The stale "501 stub" handling is gone');
  assert.ok(source.includes('startVoiceRecording(') && source.includes('transcribeRecording('), 'Voice tab uses the tested recorder helper');
  assert.ok(source.includes("'quick'") && source.includes("'conversational'"), 'Both voice modes remain');
}

async function main() {
  await recorderLifecycle();
  await transcriptionUpload();
  componentWiring();
  console.log('PASS voice recorder: WebM/MP4 selection, start/stop/double-stop, cancel during permission prompt and mid-recording (no late callbacks, no upload), one-minute limit, size/empty guards, permission/policy/support errors, optional level meter, recorder failures, full cleanup; upload success, server error text, abort and timeout. Mocked browser only - no real microphone.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
