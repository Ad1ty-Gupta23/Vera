import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceNoiseGate } from '../../public/voiceNoiseGate';

function frame(level, length = 1200) {
  return Int16Array.from({ length }, (_, i) => Math.round(Math.sin(i * 0.13) * level * 32767));
}
const audible = (samples) => samples.some((sample) => sample !== 0);

describe('free microphone noise rejection', () => {
  it('sends silence for quiet room hum continuously, including before the first question', () => {
    const gate = new VoiceNoiseGate();
    const outputs = Array.from({ length: 100 }, () => gate.filter(frame(0.002)));
    expect(outputs).toHaveLength(100);
    expect(outputs.every((output) => output.length === 1200 && !audible(output))).toBe(true);
  });

  it('rejects isolated clicks while idle', () => {
    const gate = new VoiceNoiseGate();
    const outputs = [0.002, 0.1, 0.002, 0.002, 0.2, 0.002].map((level) => gate.filter(frame(level)));
    expect(outputs.every((output) => !audible(output))).toBe(true);
  });

  it('preserves the first frame and quieter syllables of sustained speech', () => {
    const gate = new VoiceNoiseGate();
    const onset = frame(0.04);
    const expectedOnset = onset.slice();
    expect(audible(gate.filter(onset))).toBe(false);
    expect(gate.filter(frame(0.04))).toEqual(expectedOnset);
    gate.filter(frame(0.001));
    const softTail = gate.filter(frame(0.04));
    expect(audible(softTail)).toBe(true);
  });

  it('closes after speech even when low noise and repeated short clicks continue', () => {
    const gate = new VoiceNoiseGate();
    for (let i = 0; i < 20; i += 1) gate.filter(frame(0.04));
    const outputs = Array.from({ length: 30 }, (_, i) => gate.filter(frame(i % 4 === 0 ? 0.09 : 0.002)));
    expect(outputs.slice(8).every((output) => !audible(output))).toBe(true);
    // A short spoken stop/follow-up can still open it again.
    const reopened = Array.from({ length: 4 }, () => gate.filter(frame(0.02)));
    expect(reopened.some(audible)).toBe(true);
  });

  it('does not calibrate away someone who speaks immediately after starting', () => {
    const gate = new VoiceNoiseGate();
    const outputs = Array.from({ length: 40 }, () => gate.filter(frame(0.015)));
    expect(outputs.slice(1).every(audible)).toBe(true);
  });
});

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('the real resampling worklet keeps sending correctly sized silent frames between questions', async () => {
  let Processor;
  const frames = [];
  vi.stubGlobal('sampleRate', 48000);
  vi.stubGlobal('AudioWorkletProcessor', class {
    port = { postMessage: (buffer) => frames.push(new Int16Array(buffer.slice(0))) };
  });
  vi.stubGlobal('registerProcessor', (_name, cls) => { Processor = cls; });
  await import('../../public/voiceAgentProcessor');
  const processor = new Processor({ processorOptions: { noiseGate: true, targetSampleRate: 24000 } });
  const feed = (level, blocks) => {
    for (let i = 0; i < blocks; i += 1) {
      processor.process([[Float32Array.from({ length: 128 }, (_, n) => Math.sin(n * 0.1) * level)]]);
    }
  };
  feed(0.002, 375);
  expect(frames).toHaveLength(20);
  expect(frames.every((output) => !audible(output) && output.length === 1200)).toBe(true);
  feed(0.04, 375);
  expect(frames.slice(22).every(audible)).toBe(true);
  feed(0.002, 375);
  expect(frames).toHaveLength(60);
  expect(frames.slice(48).every((output) => !audible(output))).toBe(true);
});

it('business activity detection rejects low noise and clicks, detects sustained speech, and preserves outgoing PCM', async () => {
  let Processor;
  const messages = [];
  vi.stubGlobal('sampleRate', 24000);
  vi.stubGlobal('AudioWorkletProcessor', class {
    port = { postMessage: (value) => messages.push(value) };
  });
  vi.stubGlobal('registerProcessor', (_name, cls) => { Processor = cls; });
  await import('../../public/voiceAgentProcessor');
  const processor = new Processor({ processorOptions: { detectSpeech: true, targetSampleRate: 24000 } });
  const feed = (level, count) => {
    for (let i = 0; i < count; i += 1) {
      for (let n = 0; n < 1200; n += 1) processor.pushSample(Math.sin(n * 0.13) * level);
    }
  };
  feed(0.002, 20);
  feed(0.1, 1);
  feed(0.002, 10);
  expect(messages.filter((value) => value.type === 'speech.activity')).toHaveLength(0);
  feed(0.04, 3);
  expect(messages.filter((value) => value.type === 'speech.activity')).toEqual([{ type: 'speech.activity', active: true }]);
  feed(0.04, 10);
  feed(0.002, 10);
  feed(0.04, 3);
  expect(messages.filter((value) => value.type === 'speech.activity').map((value) => value.active)).toEqual([true, false, true]);
  const pcm = messages.filter((value) => value instanceof ArrayBuffer);
  expect(pcm).toHaveLength(57);
  expect(pcm.every((buffer) => buffer.byteLength === 2400 && audible(new Int16Array(buffer)))).toBe(true);
});
