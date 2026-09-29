/**
 * Captures the browser's native microphone rate and resamples it to the
 * Voice Agent API's required 24 kHz PCM16 mono stream. Kept separate from
 * microphoneProcessor.js so VERA's existing 16 kHz streaming path is intact.
 */
import { VoiceNoiseGate } from './voiceNoiseGate.js';

class VoiceAgentProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.targetRate = options.processorOptions?.targetSampleRate || 24000;
    this.step = sampleRate / this.targetRate;
    this.samples = [];
    this.position = 0;
    // 50 ms chunks reduce the time before AssemblyAI can detect barge-in.
    this.chunk = new Int16Array(Math.round(this.targetRate * 0.05));
    this.chunkOffset = 0;
    this.noiseGate = options.processorOptions?.noiseGate ? new VoiceNoiseGate(50) : null;
    // Detect sustained microphone activity locally so buffered business audio
    // can stop before the provider returns a transcript. Keep its PCM intact.
    this.speechDetector = options.processorOptions?.detectSpeech
      ? new VoiceNoiseGate(50, { openThreshold: 0.012, confirmationFrames: 3 }) : null;
  }

  pushSample(value) {
    const sample = Math.max(-1, Math.min(1, value));
    this.chunk[this.chunkOffset++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    if (this.chunkOffset === this.chunk.length) {
      if (this.speechDetector) {
        const wasOpen = this.speechDetector.open;
        this.speechDetector.filter(this.chunk.slice());
        if (wasOpen !== this.speechDetector.open) {
          this.port.postMessage({ type: 'speech.activity', active: this.speechDetector.open });
        }
      }
      const output = this.noiseGate ? this.noiseGate.filter(this.chunk) : this.chunk;
      this.port.postMessage(output.buffer, [output.buffer]);
      this.chunk = new Int16Array(Math.round(this.targetRate * 0.05));
      this.chunkOffset = 0;
    }
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input?.length) return true;

    for (let i = 0; i < input.length; i++) this.samples.push(input[i]);

    while (this.position + 1 < this.samples.length) {
      const left = Math.floor(this.position);
      const fraction = this.position - left;
      const value = this.samples[left] + (this.samples[left + 1] - this.samples[left]) * fraction;
      this.pushSample(value);
      this.position += this.step;
    }

    const consumed = Math.floor(this.position);
    if (consumed > 0) {
      this.samples.splice(0, consumed);
      this.position -= consumed;
    }
    return true;
  }
}

registerProcessor('voice-agent-processor', VoiceAgentProcessor);
