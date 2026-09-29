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
import { VoiceNoiseGate } from './voiceNoiseGate.js';

class MicrophoneProcessor extends AudioWorkletProcessor {
  constructor(options = {}) {
    super();
    // 100ms keeps live audio responsive without flooding the network with
    // minimum-size frames. The backend coalesces queued packets when needed.
    this._chunkSamples = Math.ceil(sampleRate * 0.1);
    this._buffer = new Int16Array(this._chunkSamples);
    this._offset = 0;
    this._noiseGate = options.processorOptions?.noiseGate ? new VoiceNoiseGate(100) : null;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input?.length) return true;

    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      this._buffer[this._offset++] = s < 0 ? s * 0x8000 : s * 0x7fff;

      if (this._offset >= this._chunkSamples) {
        const output = this._noiseGate ? this._noiseGate.filter(this._buffer) : this._buffer;
        this.port.postMessage(output.buffer, [output.buffer]);
        this._buffer = new Int16Array(this._chunkSamples);
        this._offset = 0;
      }
    }

    return true;
  }
}

registerProcessor('microphone-processor', MicrophoneProcessor);
