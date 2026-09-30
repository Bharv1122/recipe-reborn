// Batches microphone audio into ~100 ms chunks, scaled to the 16-bit range Kaldi expects, and posts them
// straight to the Vosk worker's port. The main thread only relays the transferred buffer.
class KitchenMic extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.id = options.processorOptions.recognizerId;
    this.size = Math.round(sampleRate / 10);
    this.buf = new Float32Array(this.size);
    this.n = 0;
    this.port.onmessage = e => { if (e.data === 'stop') this.stopped = true; };
  }
  process(inputs) {
    if (this.stopped) return false;
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = ch[i] * 32767;
      if (this.n === this.size) {
        this.port.postMessage({action: 'audioChunk', recognizerId: this.id, data: this.buf, sampleRate}, [this.buf.buffer]);
        this.buf = new Float32Array(this.size);
        this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor('rr-kitchen-mic', KitchenMic);
