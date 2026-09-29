import { beforeEach, describe, expect, it, vi } from 'vitest';
import { speak, stop } from './tts';

beforeEach(() => {
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(text) { this.text = text; } });
  vi.stubGlobal('speechSynthesis', { cancel: vi.fn(), speak: vi.fn(), getVoices: () => [] });
});

describe('speech interruptions', () => {
  it('ignores completion from interrupted speech after the next answer has started', () => {
    const oldEnd = vi.fn();
    const newEnd = vi.fn();
    speak('Old answer', { onEnd: oldEnd });
    const old = speechSynthesis.speak.mock.calls[0][0];
    stop();
    speak('New answer', { onEnd: newEnd });
    const current = speechSynthesis.speak.mock.calls[1][0];
    old.onend();
    old.onerror();
    expect(oldEnd).not.toHaveBeenCalled();
    expect(newEnd).not.toHaveBeenCalled();
    current.onend();
    expect(newEnd).toHaveBeenCalledTimes(1);
  });

  it('finishes the speaking state once if synthesis fails', () => {
    const end = vi.fn();
    speak('Answer', { onEnd: end });
    const utterance = speechSynthesis.speak.mock.calls[0][0];
    utterance.onerror();
    utterance.onend();
    expect(end).toHaveBeenCalledTimes(1);
  });
});
