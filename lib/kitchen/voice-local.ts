import type { Model } from 'vosk-browser';
import { KITCHEN_GRAMMAR } from '@/lib/kitchen/engine';

/**
 * On-device speech recognition for browsers without the Web Speech API
 * (Meta Quest Browser). Ported from the Hardware Anatomy Lab XR voice code.
 * Vosk (Kaldi compiled to WASM) runs in its own Web Worker; the model is
 * served from this origin, downloaded once when voice is first turned on,
 * and cached in IndexedDB by the worker. Audio never leaves the device.
 */
export const MODEL_FILE = '/voice/vosk-model-small-en-us-0.15-commands.tar.gz';
export const MODEL_MB = 29;
const SAMPLE_RATE = 16000;
const LOAD_TIMEOUT_MS = 180000;

let modelPromise: Promise<Model> | null = null;

function loadModel(): Promise<Model> {
  return (modelPromise ??= (async () => {
    const { Model } = await import('vosk-browser');
    // The worker runs from a blob: URL, so it needs an absolute model URL. Keep it stable: it is the cache key.
    const model = new Model(new URL(MODEL_FILE, location.href).href, -1);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), LOAD_TIMEOUT_MS);
      model.on('load', (m) => {
        clearTimeout(timer);
        if (m.event === 'load' && m.result) resolve();
        else reject(new Error('load failed'));
      });
      model.on('error', (m) => {
        clearTimeout(timer);
        reject(new Error(m.event === 'error' ? m.error : 'load failed'));
      });
    });
    return model;
  })().catch((e) => {
    modelPromise?.then((m) => m.terminate(), () => {});
    modelPromise = null;
    throw e;
  }));
}

export const onDeviceSupported = () =>
  typeof WebAssembly === 'object' &&
  typeof Worker !== 'undefined' &&
  typeof AudioContext !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia;

export type LocalHandlers = {
  onText: (text: string) => void;
  onLoading: (detail: string) => void;
  onListening: () => void;
  onError: (detail: string) => void;
};

export function micErrorMessage(e: unknown) {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Microphone permission was denied. Allow the microphone for this site, then turn voice on again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone was found.';
  if (name === 'NotReadableError') return 'The microphone is busy in another app.';
  if (name === 'NotSupportedError') return 'This browser won’t give the page microphone access.';
  return 'The microphone couldn’t start.';
}

/** Starts listening; returns a stop function. Every failure is reported through onError, never thrown. */
export function startLocalVoice(h: LocalHandlers): () => void {
  let stopped = false;
  let cleanup = () => {};
  (async () => {
    // Ask for the microphone before downloading anything, so a denied prompt costs nothing.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      if (!stopped) h.onError(micErrorMessage(e));
      return;
    }
    cleanup = () => stream.getTracks().forEach((t) => t.stop());
    if (stopped) return cleanup();

    const started = Date.now();
    const cached = modelPromise !== null;
    const tick = () =>
      h.onLoading(
        cached
          ? 'Starting the voice model…'
          : `Loading the on-device voice model (${MODEL_MB} MB, first time only)… ${Math.round((Date.now() - started) / 1000)} s`
      );
    tick();
    const ticker = setInterval(tick, 1000);
    let model: Model;
    try {
      model = await loadModel();
    } catch {
      clearInterval(ticker);
      if (!stopped) {
        cleanup();
        h.onError('The voice model couldn’t load. Check the connection and try again.');
      }
      return;
    }
    clearInterval(ticker);
    if (stopped) return cleanup();

    let ctx: AudioContext;
    try {
      ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    } catch {
      ctx = new AudioContext();
    }
    const recognizer = new model.KaldiRecognizer(ctx.sampleRate, JSON.stringify(KITCHEN_GRAMMAR));
    recognizer.on('result', (m) => {
      if (m.event !== 'result') return;
      const text = m.result.text.replace(/\[unk\]/g, '').trim();
      if (text) h.onText(text);
    });
    recognizer.on('error', (m) => {
      if (m.event === 'error' && !stopped) h.onError(`Voice stopped (${m.error}).`);
    });
    const source = ctx.createMediaStreamSource(stream);
    let node: AudioNode;
    try {
      await ctx.audioWorklet.addModule('/voice/mic-worklet.js');
      const w = new AudioWorkletNode(ctx, 'rr-kitchen-mic', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        processorOptions: { recognizerId: recognizer.id },
      });
      model.registerPort(w.port);
      node = w;
      const prev = cleanup;
      cleanup = () => {
        w.port.postMessage('stop');
        prev();
      };
    } catch {
      // Older engines without AudioWorklet: a ScriptProcessor on the main thread, still cheap at 16 kHz.
      const sp = ctx.createScriptProcessor(4096, 1, 1);
      sp.onaudioprocess = (e) => {
        if (!stopped) recognizer.acceptWaveform(e.inputBuffer);
      };
      sp.connect(ctx.destination);
      node = sp;
    }
    source.connect(node);
    const prev = cleanup;
    cleanup = () => {
      prev();
      try {
        source.disconnect();
        node.disconnect();
      } catch {
        /* already disconnected */
      }
      ctx.close().catch(() => {});
      recognizer.remove();
    };
    if (stopped) return cleanup();
    await ctx.resume().catch(() => {});
    h.onListening();
  })().catch(() => {
    if (!stopped) {
      cleanup();
      h.onError('Voice couldn’t start here.');
    }
  });
  return () => {
    stopped = true;
    cleanup();
  };
}
