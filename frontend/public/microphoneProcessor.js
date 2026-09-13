/**
 * microphoneProcessor.js — AudioWorklet processor
 * Converts Float32 microphone samples → Int16 PCM and posts to main thread.
 * Loaded via AudioContext.audioWorklet.addModule('/microphoneProcessor.js')
 *
 * AssemblyAI's realtime API requires each audio message to represent
 * between 50ms and 1000ms of audio. AudioWorkletProcessor.process() only
 * ever gets a fixed 128-sample render quantum per call — 8ms at 16kHz —
 * so posting straight from process() sent an 8ms message every time and
 * every single one was rejected ("Input Duration Violation: 8.0 ms").
 * We buffer several render quanta together and only post once we have a
 * safely-sized chunk.
 */
class MicrophoneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // ~100ms per chunk — comfortably inside AssemblyAI's 50-1000ms window.
    this._chunkSamples = Math.round(sampleRate * 0.1);
    this._buffer = new Int16Array(this._chunkSamples);
    this._offset = 0;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input?.length) return true;

    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      this._buffer[this._offset++] = s < 0 ? s * 0x8000 : s * 0x7fff;

      if (this._offset >= this._chunkSamples) {
        this.port.postMessage(this._buffer.buffer, [this._buffer.buffer]);
        this._buffer = new Int16Array(this._chunkSamples);
        this._offset = 0;
      }
    }

    return true;
  }
}

registerProcessor('microphone-processor', MicrophoneProcessor);