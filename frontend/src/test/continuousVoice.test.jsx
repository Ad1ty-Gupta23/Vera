import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VERAProvider } from '../context/VERAContext';
import { useVoice } from '../hooks/useVoice';
import { useVERA } from '../hooks/useVERA';
import Dashboard from '../pages/Dashboard';

const mocks = vi.hoisted(() => ({ sessions: [], speak: vi.fn(), stop: vi.fn() }));
vi.mock('../services/tts', () => ({ speak: mocks.speak, stop: mocks.stop }));
vi.mock('../services/freeVoice', () => ({
  createFreeVoiceSession: vi.fn((onEvent) => {
    const session = {
      emit: onEvent,
      microphoneActive: false,
      _ws: { readyState: 1, send: vi.fn() },
      start: vi.fn(async () => {
        session.microphoneActive = true;
        onEvent({ type: 'session.begin' });
        onEvent({ type: 'voice.status', status: 'listening' });
        return true;
      }),
      startTextOnly: vi.fn(async () => { onEvent({ type: 'session.begin' }); }),
      stopMicrophone: vi.fn(() => { session.microphoneActive = false; }),
      interrupt: vi.fn(),
      sendText: vi.fn((text) => session._ws.send(JSON.stringify({ type: 'text.message', text }))),
      stop: vi.fn(() => { session.microphoneActive = false; }),
    };
    mocks.sessions.push(session);
    return session;
  }),
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Demo', plan: 'free' }, logout: vi.fn() }) }));
vi.mock('../components/map/MapPanel', () => ({ default: () => null }));
vi.mock('../components/visual/VisualPanel', () => ({ default: () => null }));
vi.mock('../components/common/PageBackground', () => ({ default: () => null }));

let root;
let container;
let voice;
let state;

function Probe() {
  const controls = useVoice();
  const current = useVERA();
  useEffect(() => { voice = controls; state = current; });
  return null;
}

async function emit(event) {
  await act(async () => { mocks.sessions.at(-1).emit(event); });
}

async function reply(text) {
  await emit({ type: 'agent.status', status: 'processing' });
  await emit({ type: 'agent.response', text });
  await emit({ type: 'agent.status', status: 'responding' });
}

beforeEach(async () => {
  mocks.sessions.length = 0;
  mocks.speak.mockReset();
  mocks.stop.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  await act(async () => { root.render(<VERAProvider><Probe /></VERAProvider>); });
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
});

describe('continuous free voice conversation', () => {
  it('plays managed audio without duplicate browser speech and keeps listening', async () => {
    await act(async () => { await voice.startVoice(); });
    await emit({ type: 'voice.mode', mode: 'assemblyai-managed' });
    await emit({ type: 'transcript.final', text: 'Hello' });
    await emit({ type: 'agent.status', status: 'processing' });
    await emit({ type: 'voice.playback', active: true });
    await emit({ type: 'agent.response', text: 'Hello there.', audioManaged: true });
    expect(mocks.speak).not.toHaveBeenCalled();
    expect(state.isSpeaking).toBe(true);
    expect(state.messages.map((message) => message.text)).toEqual(['Hello', 'Hello there.']);
    await emit({ type: 'agent.status', status: 'listening' });
    await emit({ type: 'voice.playback', active: false });
    expect(voice.isVoiceActive).toBe(true);
    expect(state.isSpeaking).toBe(false);
    expect(voice.voiceMode).toBe('assemblyai-managed');
  });

  it('speaks an early explanation and updates the same bubble when the visual finishes', async () => {
    await act(async () => { await voice.startVoice(); });
    await emit({ type: 'agent.status', status: 'processing' });
    await emit({ type: 'agent.response', phase: 'preview', message_id: 'turn-1', text: 'Early explanation.' });
    expect(mocks.speak).toHaveBeenCalledTimes(1);
    expect(state.isSpeaking).toBe(true);
    await emit({ type: 'agent.response', phase: 'final', message_id: 'turn-1', text: 'Full visual explanation.', speak: false });
    expect(state.messages.map((m) => m.text)).toEqual(['Full visual explanation.']);
    expect(mocks.speak).toHaveBeenCalledTimes(1);
    expect(state.isSpeaking).toBe(true);
    await act(async () => { mocks.speak.mock.calls[0][1].onEnd(); });
    expect(state.agentStatus).toBe('listening');
  });

  it('keeps visual work interruptible after the early speech finishes', async () => {
    await act(async () => { await voice.startVoice(); });
    await emit({ type: 'agent.status', status: 'processing' });
    await emit({ type: 'agent.response', phase: 'preview', message_id: 'turn-1', text: 'Early explanation.' });
    await act(async () => { mocks.speak.mock.calls[0][1].onEnd(); });
    expect(state.agentStatus).toBe('processing');
    await act(async () => { voice.stopSpeaking(); });
    await emit({ type: 'agent.response', phase: 'final', message_id: 'turn-1', text: 'Cancelled explanation.', speak: false });
    expect(state.messages.map((m) => m.text)).toEqual(['Early explanation.']);
    expect(state.agentStatus).toBe('listening');
    expect(voice.isVoiceActive).toBe(true);
  });

  it('keeps the mic active through replies and follow-up questions', async () => {
    await act(async () => { await voice.startVoice(); });
    const session = mocks.sessions[0];
    await emit({ type: 'transcript.final', text: 'Tell me about Saturn.' });
    await reply('Saturn has rings.');
    expect(voice.isVoiceActive).toBe(true);
    expect(state.isSpeaking).toBe(true);
    await act(async () => { mocks.speak.mock.calls.at(-1)[1].onEnd(); });
    expect(state.agentStatus).toBe('listening');
    await emit({ type: 'transcript.final', text: 'How large is it?' });
    await reply('It is a gas giant.');
    expect(state.messages.map((message) => message.text)).toEqual([
      'Tell me about Saturn.', 'Saturn has rings.', 'How large is it?', 'It is a gas giant.',
    ]);
    expect(session.start).toHaveBeenCalledTimes(1);
    expect(session.stopMicrophone).not.toHaveBeenCalled();
  });

  it('silences speech on partial input, accepts stop, then answers the next question', async () => {
    await act(async () => { await voice.startVoice(); });
    await reply('A long answer.');
    mocks.stop.mockClear();
    await emit({ type: 'transcript.partial', text: 'Stop' });
    expect(mocks.stop).toHaveBeenCalled();
    expect(state.isSpeaking).toBe(false);
    await emit({ type: 'transcript.final', text: 'Stop.' });
    await emit({ type: 'agent.interrupted' });
    await emit({ type: 'agent.response', text: 'Late response that must stay silent.' });
    expect(voice.isVoiceActive).toBe(true);
    expect(state.messages.map((message) => message.text)).toEqual(['A long answer.', 'Stop.']);
    await emit({ type: 'transcript.final', text: 'Now explain Mars.' });
    await reply('Mars is the red planet.');
    expect(mocks.speak).toHaveBeenLastCalledWith('Mars is the red planet.', expect.any(Object));
  });

  it('cancels a pending response without ending voice', async () => {
    await act(async () => { await voice.startVoice(); });
    await emit({ type: 'agent.status', status: 'processing' });
    await act(async () => { voice.stopSpeaking(); });
    expect(mocks.sessions[0].interrupt).toHaveBeenCalled();
    await emit({ type: 'agent.response', text: 'Obsolete answer' });
    expect(state.messages).toHaveLength(0);
    expect(voice.isVoiceActive).toBe(true);
    await reply('New answer');
    expect(state.messages.at(-1).text).toBe('New answer');
  });

  it('upgrades a typed conversation to voice and preserves it when voice ends', async () => {
    await act(async () => { await voice.sendText('Hello'); });
    expect(voice.isVoiceActive).toBe(false);
    await act(async () => { await voice.startVoice(); });
    const session = mocks.sessions[0];
    expect(mocks.sessions).toHaveLength(1);
    expect(voice.isVoiceActive).toBe(true);
    await act(async () => { voice.stopVoice(); });
    expect(voice.isVoiceActive).toBe(false);
    expect(session.stop).not.toHaveBeenCalled();
    await act(async () => { await voice.sendText('Continue here'); await voice.startVoice(); });
    expect(mocks.sessions).toHaveLength(1);
    expect(session.start).toHaveBeenCalledTimes(2);
    expect(state.messages.map((message) => message.text)).toEqual(['Hello', 'Continue here']);
  });

  it('leaves the microphone active after a recoverable answer error', async () => {
    await act(async () => { await voice.startVoice(); });
    await emit({ type: 'error', message: 'Could not answer. Please try again.' });
    expect(voice.isVoiceActive).toBe(true);
    expect(state.connectionStatus).toBe('connected');
    await reply('The next question works.');
    expect(state.messages.at(-1).text).toBe('The next question works.');
  });

  it('allows retry after permission denial without replacing the conversation', async () => {
    await act(async () => { await voice.sendText('Hello'); });
    mocks.sessions[0].start.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));
    await act(async () => { await voice.startVoice(); });
    expect(voice.isVoiceActive).toBe(false);
    expect(voice.isVoiceStarting).toBe(false);
    expect(state.error).toBe('Microphone permission denied.');
    await act(async () => { await voice.startVoice(); });
    expect(mocks.sessions).toHaveLength(1);
    expect(voice.isVoiceActive).toBe(true);
  });

  it('releases a closed socket and ignores its late events when reconnecting', async () => {
    await act(async () => { await voice.startVoice(); });
    const old = mocks.sessions[0];
    await emit({ type: 'connection.closed', message: 'Connection lost.' });
    expect(voice.isVoiceActive).toBe(false);
    await act(async () => { await voice.startVoice(); });
    expect(mocks.sessions).toHaveLength(2);
    await act(async () => { old.emit({ type: 'connection.closed' }); });
    expect(voice.isVoiceActive).toBe(true);
  });

  it('allows a fresh connection after a startup timeout', async () => {
    await act(async () => { await voice.sendText('Hello'); });
    mocks.sessions[0].start.mockImplementationOnce(async () => {
      mocks.sessions[0]._ws = null;
      throw new Error('Connection timed out');
    });
    await act(async () => { await voice.startVoice(); });
    expect(voice.isVoiceStarting).toBe(false);
    await act(async () => { await voice.startVoice(); });
    expect(mocks.sessions).toHaveLength(2);
    expect(voice.isVoiceActive).toBe(true);
  });

  it('ignores a late microphone failure from an attempt the user already cancelled', async () => {
    await act(async () => { await voice.sendText('Hello'); });
    let rejectOld;
    mocks.sessions[0].start.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOld = reject; }));
    let oldStart;
    await act(async () => { oldStart = voice.startVoice(); });
    await act(async () => { voice.stopVoice(); await voice.startVoice(); });
    await act(async () => { rejectOld(new Error('Old capture cancelled')); await oldStart; });
    expect(voice.isVoiceActive).toBe(true);
    expect(state.error).toBe(null);
  });

  it('keeps the dashboard mic enabled during a reply and starts voice after typing', async () => {
    await act(async () => { root.render(<MemoryRouter><VERAProvider><Dashboard /></VERAProvider></MemoryRouter>); });
    const prompt = [...container.querySelectorAll('button')].find((button) => button.textContent === 'What can you do?');
    await act(async () => { prompt.click(); });
    const mic = container.querySelector('#dashboard-mic-btn');
    expect(mic.getAttribute('aria-label')).toBe('Start voice conversation');
    await act(async () => { mic.click(); });
    expect(mocks.sessions).toHaveLength(1);
    await reply('I can help.');
    expect(mic.getAttribute('aria-label')).toBe('End voice conversation');
    expect(mic.getAttribute('aria-pressed')).toBe('true');
    expect(container.textContent).toContain('Voice is on');
    expect(container.textContent).toContain('Stop response');
  });
});
