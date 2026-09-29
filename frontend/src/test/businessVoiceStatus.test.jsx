import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { TestChat } from '../pages/business/CustomizeAssistant';

const mocks = vi.hoisted(() => ({ sessions: [], speak: vi.fn(), stop: vi.fn() }));
vi.mock('../services/tts', () => ({ speak: mocks.speak, stop: mocks.stop }));
vi.mock('../services/assemblyVoiceAgent', () => ({
  VoiceAgentUnavailableError: class extends Error {},
  createAssemblyVoiceAgentSession: (emit) => {
    const session = { emit, start: vi.fn(async () => {}), stop: vi.fn() };
    mocks.sessions.push(session);
    return session;
  },
}));

let root, container;
const emit = async (event) => { await act(async () => mocks.sessions.at(-1).emit(event)); };

beforeEach(async () => {
  mocks.sessions.length = 0;
  mocks.speak.mockReset(); mocks.stop.mockReset();
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<TestChat businessId={1} greeting="Welcome" themeColor="#2563eb" />));
  await act(async () => container.querySelector('button[title="Speak to test the assistant"]').click());
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it('shows the answer while speaking and waits for actual playback completion to clear Speaking', async () => {
  await emit({ type: 'agent.status', status: 'processing' });
  expect(container.textContent).toContain('Thinking…');
  const answer = { type: 'agent.response', text: 'Our return window is 30 days.', grounded: true,
    sources: ['policy.md'], audioManaged: true, eventId: 'reply-1' };
  await emit(answer);
  await emit({ type: 'voice.playback', active: true });
  expect(container.textContent).toContain('Our return window is 30 days.');
  expect(container.textContent).toContain('Source: policy.md');
  expect(container.textContent).toContain('Speaking…');
  expect(container.textContent).not.toContain('Thinking…');
  expect(mocks.speak).not.toHaveBeenCalled();
  await emit({ type: 'agent.status', status: 'listening' });
  await emit(answer);
  expect(container.textContent).toContain('Speaking…');
  expect(container.textContent.split(answer.text)).toHaveLength(2);
  await emit({ type: 'voice.playback', active: false });
  expect(container.textContent).not.toContain('Speaking…');
  expect(container.textContent).not.toContain('Thinking…');
});

it('clears pending status and rejects late events when the conversation is reset', async () => {
  await emit({ type: 'agent.status', status: 'processing' });
  await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Reset').click());
  await emit({ type: 'voice.playback', active: true });
  await emit({ type: 'agent.response', text: 'obsolete', audioManaged: true });
  expect(container.textContent).not.toContain('Thinking…');
  expect(container.textContent).not.toContain('Speaking…');
  expect(container.textContent).not.toContain('obsolete');
});

it('resets the microphone after congestion, ignores late errors and restarts on one click', async () => {
  const failed = mocks.sessions.at(-1);
  await emit({ type: 'voice.playback', active: true });
  const message = 'Voice stopped because the audio upload stayed congested.';
  await emit({ type: 'error', status: 'unavailable', message });
  await act(async () => failed.emit({ type: 'error', message: 'late duplicate' }));
  expect(container.textContent.split(message)).toHaveLength(2);
  expect(container.textContent).not.toContain('late duplicate');
  expect(container.querySelector('button[title="Stop voice"]')).toBeNull();
  await act(async () => container.querySelector('button[title="Speak to test the assistant"]').click());
  expect(mocks.sessions).toHaveLength(2);
  expect(container.querySelector('button[title="Stop voice"]')).not.toBeNull();
  expect(container.textContent).not.toContain(message);
});

it('tracks browser speech playback for the standard voice fallback too', async () => {
  await emit({ type: 'agent.status', status: 'processing' });
  await emit({ type: 'agent.response', text: 'Standard reply', grounded: true });
  await act(async () => mocks.speak.mock.calls[0][1].onStart());
  expect(container.textContent).toContain('Speaking…');
  expect(container.textContent).not.toContain('Thinking…');
  await act(async () => mocks.speak.mock.calls[0][1].onEnd());
  expect(container.textContent).not.toContain('Speaking…');
});

it.each(['speech.started', 'transcript.partial'])('clears speaking and stops browser audio on %s without ending the session', async (type) => {
  await emit({ type: 'voice.playback', active: true });
  expect(container.textContent).toContain('Speaking…');
  await emit({ type, text: 'Wait, I have another question' });
  expect(container.textContent).not.toContain('Speaking…');
  expect(container.textContent).not.toContain('Thinking…');
  expect(mocks.stop).toHaveBeenCalled();
  expect(mocks.sessions.at(-1).stop).not.toHaveBeenCalled();
  await emit({ type: 'agent.status', status: 'processing' });
  expect(container.textContent).toContain('Thinking…');
});
