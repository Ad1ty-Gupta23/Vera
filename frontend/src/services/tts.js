/**
 * TTS service using the browser's Web Speech API.
 * Speaks VERA's text responses aloud.
 */

let currentUtterance = null;

export function speak(text, { onStart, onEnd, rate = 1.0 } = {}) {
  if (!window.speechSynthesis || !text) { onEnd?.(); return; }

  // Cancel any ongoing speech
  stop();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Prefer a natural-sounding voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Neural'))
  ) || voices.find((v) => v.lang.startsWith('en'));
  if (preferred) utterance.voice = preferred;

  utterance.onstart = () => { if (currentUtterance === utterance) onStart?.(); };
  utterance.onend = () => {
    if (currentUtterance !== utterance) return;
    currentUtterance = null;
    onEnd?.();
  };
  utterance.onerror = () => {
    if (currentUtterance !== utterance) return;
    currentUtterance = null;
    onEnd?.();
  };

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

export function stop() {
  // Invalidate callbacks before cancel(), which may synchronously fire onend.
  currentUtterance = null;
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeaking() {
  return window.speechSynthesis?.speaking ?? false;
}
