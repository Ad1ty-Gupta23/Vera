import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFreeVoiceSession } from './freeVoice';
import { createAssemblyVoiceAgentSession } from './assemblyVoiceAgent';

let sockets, tracks, contexts, worklets, audioSources, events, session, getUserMedia;

class Socket {
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 0;
  bufferedAmount = 0;
  sent = [];
  constructor(url) { this.url = String(url); sockets.push(this); }
  send(value) { this.sent.push(typeof value === 'string' ? JSON.parse(value) : value); }
  open() { this.readyState = 1; this.onopen?.(); }
  close() { this.readyState = 3; this.onclose?.(); }
  event(value) { this.onmessage?.({ data: JSON.stringify(value) }); }
}

const connection = () => ({ connect: vi.fn(function () { return this; }), disconnect: vi.fn() });
const bootstrap = { token: 'one-use', websocket_url: 'wss://agents.assemblyai.com/v1/ws', session: { greeting: '', tools: [] } };
const audio = btoa(String.fromCharCode(0, 0, 0, 0));

beforeEach(() => {
  sockets = []; tracks = []; contexts = []; worklets = []; audioSources = []; events = [];
  getUserMedia = vi.fn(async () => {
    const track = { stop: vi.fn() };
    tracks.push(track);
    return { getTracks: () => [track] };
  });
  vi.stubGlobal('WebSocket', Socket);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  vi.stubGlobal('AudioContext', class {
    state = 'running'; currentTime = 0; destination = {};
    audioWorklet = { addModule: vi.fn(async () => {}) };
    resume = vi.fn(async () => {});
    close = vi.fn(async () => { this.state = 'closed'; });
    constructor() { contexts.push(this); }
    createMediaStreamSource() { return connection(); }
    createGain() { return { ...connection(), gain: { value: 1 } }; }
    createBuffer(_channels, count, rate) { return { duration: count / rate, getChannelData: () => new Float32Array(count) }; }
    createBufferSource() {
      const source = { ...connection(), start: vi.fn(), stop: vi.fn() };
      audioSources.push(source);
      return source;
    }
  });
  vi.stubGlobal('AudioWorkletNode', class {
    port = {};
    connect = vi.fn(function () { return this; }); disconnect = vi.fn();
    constructor(_context, name, options) { this.name = name; this.options = options; worklets.push(this); }
  });
  session = createFreeVoiceSession((event) => events.push(event));
});

afterEach(() => { session.stop(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function startManaged() {
  const starting = session.start();
  const app = sockets[0];
  app.open();
  app.event({ type: 'session.begin', session_id: 'vera-session' });
  await vi.waitFor(() => expect(app.sent.some((e) => e.type === 'managed.bootstrap')).toBe(true));
  const request = app.sent.find((e) => e.type === 'managed.bootstrap');
  app.event({ type: 'managed.result', request_id: request.request_id, result: bootstrap });
  await vi.waitFor(() => expect(sockets).toHaveLength(2));
  const provider = sockets[1];
  provider.open();
  provider.event({ type: 'session.ready', session_id: 'provider-session' });
  expect(await starting).toBe(true);
  return { app, provider };
}

function user(provider, text, id = 'user-1') {
  provider.event({ type: 'input.speech.started' });
  provider.event({ type: 'input.speech.stopped' });
  provider.event({ type: 'transcript.user', item_id: id, text });
}

describe('free managed voice transport', () => {
  it('streams directly to AssemblyAI and keeps one microphone for consecutive questions', async () => {
    const { app, provider } = await startManaged();
    expect(worklets[0].name).toBe('voice-agent-processor');
    expect(worklets[0].options.processorOptions.noiseGate).toBe(true);
    expect(getUserMedia.mock.calls[0][0].audio.autoGainControl).toBe(false);
    worklets[0].port.onmessage({ data: new ArrayBuffer(2400) });
    expect(provider.sent.at(-1).type).toBe('input.audio');
    expect(app.sent.some((e) => e.type === 'voice.start')).toBe(false);
    for (let i = 0; i < 2; i += 1) {
      user(provider, `question ${i}`, `user-${i}`);
      provider.event({ type: 'reply.started', reply_id: `reply-${i}` });
      provider.event({ type: 'reply.audio', reply_id: `reply-${i}`, data: audio });
      provider.event({ type: 'transcript.agent', reply_id: `reply-${i}`, text: `answer ${i}` });
      provider.event({ type: 'reply.done', status: 'completed' });
    }
    expect(events.filter((e) => e.type === 'agent.response').map((e) => e.text)).toEqual(['answer 0', 'answer 1']);
    expect(app.sent.filter((e) => e.type === 'managed.assistant')).toHaveLength(2);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].stop).not.toHaveBeenCalled();
    session.stopMicrophone();
    expect(provider.sent.at(-1).type).toBe('session.end');
    expect(tracks[0].stop).toHaveBeenCalledTimes(1);
    expect(app.readyState).toBe(Socket.OPEN);
    session.sendText('typed follow-up');
    expect(app.sent.at(-1)).toEqual({ type: 'text.message', text: 'typed follow-up' });
  });

  it('returns tool results only after reply.done and ignores late cancelled screen changes', async () => {
    const { app, provider } = await startManaged();
    user(provider, 'show a map');
    provider.event({ type: 'reply.started', reply_id: 'tool-reply' });
    provider.event({ type: 'tool.call', name: 'use_vera', call_id: 'call-1', arguments: { message: 'paraphrase' } });
    const request = app.sent.find((e) => e.type === 'managed.tool');
    expect(request.message).toBe('show a map');
    app.event({ type: 'map.show', request_id: request.request_id });
    app.event({ type: 'managed.result', request_id: request.request_id, result: { answer: 'Found places' } });
    await Promise.resolve(); await Promise.resolve();
    expect(provider.sent.some((e) => e.type === 'tool.result')).toBe(false);
    provider.event({ type: 'reply.done', status: 'completed' });
    await vi.waitFor(() => expect(provider.sent.some((e) => e.type === 'tool.result')).toBe(true));
    expect(JSON.parse(provider.sent.find((e) => e.type === 'tool.result').result).answer).toBe('Found places');
    user(provider, 'slow diagram', 'user-2');
    provider.event({ type: 'reply.started', reply_id: 'tool-reply-2' });
    provider.event({ type: 'tool.call', name: 'use_vera', call_id: 'call-2', arguments: { message: 'slow diagram' } });
    const lateRequest = app.sent.filter((e) => e.type === 'managed.tool').at(-1);
    session.interrupt();
    app.event({ type: 'visual.show', request_id: lateRequest.request_id, visual: { title: 'obsolete' } });
    app.event({ type: 'managed.result', request_id: lateRequest.request_id, result: { answer: 'obsolete' } });
    provider.event({ type: 'reply.done', status: 'completed' });
    await Promise.resolve();
    expect(events.some((e) => e.type === 'visual.show')).toBe(false);
    expect(provider.sent.filter((e) => e.type === 'tool.result')).toHaveLength(1);
    expect(session.microphoneActive).toBe(true);
  });

  it('stop silences queued and late audio but accepts the next spoken question', async () => {
    const { provider } = await startManaged();
    user(provider, 'explain something');
    provider.event({ type: 'reply.started', reply_id: 'old' });
    provider.event({ type: 'reply.audio', reply_id: 'old', data: audio });
    user(provider, 'Stop.', 'stop');
    expect(audioSources[0].stop).toHaveBeenCalled();
    provider.event({ type: 'reply.started', reply_id: 'unwanted-stop-answer' });
    provider.event({ type: 'reply.audio', data: audio });
    provider.event({ type: 'transcript.agent', reply_id: 'unwanted-stop-answer', text: 'Unwanted' });
    expect(audioSources).toHaveLength(1);
    expect(events.some((e) => e.text === 'Unwanted')).toBe(false);
    user(provider, 'Now explain Mars', 'next');
    provider.event({ type: 'reply.started', reply_id: 'next-reply' });
    provider.event({ type: 'reply.audio', reply_id: 'next-reply', data: audio });
    expect(audioSources).toHaveLength(2);
    expect(session.microphoneActive).toBe(true);
  });

  it('typed input during voice goes into managed history and waits for the current reply boundary', async () => {
    const { app, provider } = await startManaged();
    provider.event({ type: 'reply.started', reply_id: 'old' });
    session.sendText('What about Mars?');
    expect(provider.sent.at(-1)).toEqual({ type: 'conversation.message', role: 'user', content: 'What about Mars?' });
    expect(app.sent.at(-1).type).toBe('managed.user');
    provider.event({ type: 'reply.done', status: 'completed' });
    expect(provider.sent.at(-1).type).toBe('reply.create');
    expect(tracks[0].stop).not.toHaveBeenCalled();
  });

  it('falls back to Realtime STT if managed setup is unavailable', async () => {
    const starting = session.start();
    const app = sockets[0]; app.open();
    await vi.waitFor(() => expect(app.sent.some((e) => e.type === 'managed.bootstrap')).toBe(true));
    const request = app.sent.find((e) => e.type === 'managed.bootstrap');
    app.event({ type: 'managed.result', request_id: request.request_id, error: 'Unavailable' });
    expect(await starting).toBe(true);
    expect(sockets).toHaveLength(1);
    expect(worklets[0].name).toBe('microphone-processor');
    expect(app.sent.at(-1).type).toBe('voice.start');
    expect(events).toContainEqual({ type: 'voice.mode', mode: 'realtime-stt' });
  });

  it('stop cancels a typed reply queued behind current speech', async () => {
    const { provider } = await startManaged();
    provider.event({ type: 'reply.started', reply_id: 'old' });
    session.sendText('Next question');
    session.interrupt();
    provider.event({ type: 'reply.done', reply_id: 'old', status: 'completed' });
    expect(provider.sent.some((event) => event.type === 'reply.create')).toBe(false);
    expect(session.microphoneActive).toBe(true);
  });

  it('an old interrupted reply cannot stop playback of the next reply', async () => {
    const { provider } = await startManaged();
    provider.event({ type: 'reply.started', reply_id: 'old' });
    user(provider, 'Next question');
    provider.event({ type: 'reply.started', reply_id: 'new' });
    provider.event({ type: 'reply.audio', data: audio });
    provider.event({ type: 'reply.done', reply_id: 'old', status: 'interrupted' });
    expect(audioSources[0].stop).not.toHaveBeenCalled();
  });

  it('cancels pending bootstrap and ignores a late token without starting capture', async () => {
    const starting = session.start();
    const app = sockets[0]; app.open();
    await vi.waitFor(() => expect(app.sent.some((e) => e.type === 'managed.bootstrap')).toBe(true));
    const request = app.sent.find((e) => e.type === 'managed.bootstrap');
    session.stopMicrophone();
    app.event({ type: 'managed.result', request_id: request.request_id, result: bootstrap });
    expect(await starting).toBe(false);
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(sockets).toHaveLength(1);
  });

  it('delivers text entered during setup to the managed conversation after it becomes ready', async () => {
    const starting = session.start();
    const app = sockets[0]; app.open();
    const sending = session.sendText('Remember this question');
    await vi.waitFor(() => expect(app.sent.some((e) => e.type === 'managed.bootstrap')).toBe(true));
    expect(app.sent.some((e) => e.type === 'text.message')).toBe(false);
    const request = app.sent.find((e) => e.type === 'managed.bootstrap');
    app.event({ type: 'managed.result', request_id: request.request_id, result: bootstrap });
    await vi.waitFor(() => expect(sockets).toHaveLength(2));
    const provider = sockets[1]; provider.open();
    provider.event({ type: 'session.ready', session_id: 'ready' });
    await starting; await sending;
    expect(provider.sent.at(-1).instructions).toContain('Remember this question');
    expect(app.sent.at(-1).type).toBe('managed.user');
  });

  it('releases late microphone permission after the user cancels setup', async () => {
    let grant;
    const lateTrack = { stop: vi.fn() };
    getUserMedia.mockImplementationOnce(() => new Promise((resolve) => { grant = resolve; }));
    const starting = session.start();
    const app = sockets[0]; app.open();
    await vi.waitFor(() => expect(app.sent.some((e) => e.type === 'managed.bootstrap')).toBe(true));
    const request = app.sent.find((e) => e.type === 'managed.bootstrap');
    app.event({ type: 'managed.result', request_id: request.request_id, result: bootstrap });
    await vi.waitFor(() => expect(grant).toBeDefined());
    session.stopMicrophone();
    grant({ getTracks: () => [lateTrack] });
    expect(await starting).toBe(false);
    expect(lateTrack.stop).toHaveBeenCalledTimes(1);
    expect(sockets).toHaveLength(1);
  });
});

async function startBusiness(toolResponse = async () => ({ answer: 'Exact business answer', spoken_answer: 'Spoken answer', grounded: true })) {
  session.stop();
  vi.stubGlobal('fetch', vi.fn(async (url, options) => ({ ok: true, json: async () => String(url).endsWith('/session')
    ? bootstrap : toolResponse(options) })));
  session = createAssemblyVoiceAgentSession((event) => events.push(event), {
    sessionUrl: '/business/session', toolUrl: '/business/tool', sessionId: 'business-session',
  });
  const starting = session.start();
  await vi.waitFor(() => expect(sockets).toHaveLength(1));
  const provider = sockets[0]; provider.open(); provider.event({ type: 'session.ready', session_id: 'business' });
  await starting;
  return provider;
}

it('preserves authoritative business text and its HTTP tool flow', async () => {
  const provider = await startBusiness();
  user(provider, 'What is your policy?');
  provider.event({ type: 'reply.started', reply_id: 'tool' });
  provider.event({ type: 'tool.call', call_id: 'business-call', name: 'handle_customer_message', arguments: {} });
  provider.event({ type: 'reply.done', status: 'completed' });
  await vi.waitFor(() => expect(provider.sent.some((e) => e.type === 'tool.result')).toBe(true));
  expect(events.some((e) => e.type === 'agent.response')).toBe(false);
  provider.event({ type: 'reply.started', reply_id: 'answer' });
  provider.event({ type: 'reply.audio', data: audio });
  expect(events.find((e) => e.type === 'agent.response').text).toBe('Exact business answer');
  expect(events.filter((e) => e.type === 'voice.playback').at(-1).active).toBe(true);
  provider.event({ type: 'transcript.agent', reply_id: 'answer', text: 'Spoken answer' });
  provider.event({ type: 'reply.done', reply_id: 'answer', status: 'completed' });
  expect(events.filter((e) => e.type === 'agent.response')).toHaveLength(1);
  expect(events.filter((e) => e.type === 'voice.playback').at(-1).active).toBe(true);
  audioSources[0].onended();
  expect(events.filter((e) => e.type === 'voice.playback').at(-1).active).toBe(false);
  expect(worklets[0].options.processorOptions.noiseGate).toBe(false);
  expect(getUserMedia.mock.calls[0][0].audio.autoGainControl).toBe(true);
});

describe('business voice interruption', () => {
  it('survives a temporary encoded-audio backlog without dropping microphone packets', async () => {
    const provider = await startBusiness();
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    const capture = () => worklets[0].port.onmessage({ data: new ArrayBuffer(2400) });
    provider.bufferedAmount = 110000; // Above the old raw-PCM cutoff.
    capture();
    provider.bufferedAmount = 150000;
    capture();
    clock.mockReturnValue(2500);
    capture();
    provider.bufferedAmount = 0;
    capture();
    clock.mockReturnValue(10000);
    provider.bufferedAmount = 150000;
    capture(); // Recovery resets the grace period.
    expect(provider.sent.filter((event) => event.type === 'input.audio')).toHaveLength(5);
    expect(session.microphoneActive).toBe(true);
    expect(events.some((event) => event.type === 'error')).toBe(false);
  });

  it.each(['sustained', 'oversized'])('ends %s congestion once and releases the microphone', async (kind) => {
    const provider = await startBusiness();
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    const capture = () => worklets[0].port.onmessage({ data: new ArrayBuffer(2400) });
    provider.bufferedAmount = kind === 'oversized' ? 400000 : 150000;
    capture();
    clock.mockReturnValue(3100);
    capture();
    capture(); // Late queued worklet messages cannot emit another error.
    expect(events.filter((event) => event.type === 'error')).toHaveLength(1);
    expect(events.find((event) => event.type === 'error').status).toBe('unavailable');
    expect(provider.sent.filter((event) => event.type === 'session.end')).toHaveLength(1);
    expect(tracks[0].stop).toHaveBeenCalledOnce();
    expect(session.microphoneActive).toBe(false);
  });

  it.each(['provider', 'partial', 'final'])('stops queued audio on %s speech detection and keeps the microphone for a follow-up', async (signal) => {
    const provider = await startBusiness();
    provider.event({ type: 'reply.started', reply_id: 'old' });
    provider.event({ type: 'reply.audio', data: audio });
    provider.event({ type: 'reply.audio', data: audio });
    // Speech must also interrupt buffered playback after generation has ended.
    provider.event({ type: 'reply.done', reply_id: 'old', status: 'completed' });
    if (signal === 'provider') provider.event({ type: 'input.speech.started' });
    if (signal === 'partial') provider.event({ type: 'transcript.user.delta', text: 'Wait' });
    if (signal === 'final') provider.event({ type: 'transcript.user', item_id: 'interrupt', text: 'Wait, what are your hours?' });
    expect(audioSources.every((source) => source.stop.mock.calls.length === 1)).toBe(true);
    expect(events).toContainEqual({ type: 'speech.started' });
    provider.event({ type: 'reply.audio', data: audio });
    provider.event({ type: 'reply.started', reply_id: 'old' });
    provider.event({ type: 'reply.audio', reply_id: 'old', data: audio });
    expect(audioSources).toHaveLength(2);
    if (signal !== 'final') provider.event({ type: 'transcript.user', item_id: 'interrupt', text: 'Wait, what are your hours?' });
    provider.event({ type: 'reply.started', reply_id: 'next' });
    provider.event({ type: 'reply.audio', data: audio });
    provider.event({ type: 'reply.done', reply_id: 'old', status: 'interrupted' });
    expect(audioSources).toHaveLength(3);
    expect(audioSources[2].stop).not.toHaveBeenCalled();
    worklets[0].port.onmessage({ data: new ArrayBuffer(2400) });
    expect(provider.sent.at(-1).type).toBe('input.audio');
    expect(provider.sent.some((event) => event.type === 'session.end')).toBe(false);
    expect(tracks[0].stop).not.toHaveBeenCalled();
    expect(worklets[0].options.processorOptions.detectSpeech).toBe(false);
  });

  it('does not cut off speech on local volume activity without confirmed speech', async () => {
    const provider = await startBusiness();
    provider.event({ type: 'reply.started', reply_id: 'answer' });
    provider.event({ type: 'reply.audio', data: audio });
    worklets[0].port.onmessage({ data: { type: 'speech.activity', active: true } });
    provider.event({ type: 'reply.audio', data: audio });
    expect(audioSources).toHaveLength(2);
    expect(audioSources.every((source) => source.stop.mock.calls.length === 0)).toBe(true);
    expect(events.some((event) => event.type === 'speech.started')).toBe(false);
    provider.event({ type: 'input.speech.started' });
    expect(audioSources.every((source) => source.stop.mock.calls.length === 1)).toBe(true);
  });

  it('buffers jittery audio chunks contiguously and rebuilds headroom after an underrun', async () => {
    const provider = await startBusiness();
    const chunk = btoa('\0'.repeat(4800)); // 100 ms of PCM16 at 24 kHz
    const playback = contexts[1];
    provider.event({ type: 'reply.started', reply_id: 'answer' });
    provider.event({ type: 'reply.audio', data: chunk });
    const firstStart = audioSources[0].start.mock.calls[0][0];
    expect(firstStart).toBeCloseTo(0.18);
    // Second chunk is 40 ms late relative to realtime generation, but the
    // lead keeps playback gapless. No extra delay is added per chunk.
    playback.currentTime = 0.14;
    provider.event({ type: 'reply.audio', data: chunk });
    expect(audioSources[1].start.mock.calls[0][0]).toBeCloseTo(firstStart + 0.1);
    playback.currentTime = 0.5;
    audioSources[0].onended();
    audioSources[1].onended();
    provider.event({ type: 'reply.audio', data: chunk });
    expect(audioSources[2].start.mock.calls[0][0]).toBeCloseTo(0.68);
    session.interrupt();
    expect(audioSources[2].stop).toHaveBeenCalledOnce();
    user(provider, 'Next question', 'next');
    provider.event({ type: 'reply.started', reply_id: 'next' });
    provider.event({ type: 'reply.audio', data: chunk });
    expect(audioSources[3].start.mock.calls[0][0]).toBeCloseTo(0.68);
  });

  it('ignores a late business tool result after interruption and executes the next question', async () => {
    let resolveOld, oldSignal;
    const provider = await startBusiness((options) => {
      if (JSON.parse(options.body).message === 'Old question') {
        oldSignal = options.signal;
        return new Promise((resolve) => { resolveOld = resolve; });
      }
      return { answer: 'Fresh answer', grounded: true };
    });
    user(provider, 'Old question');
    provider.event({ type: 'reply.started', reply_id: 'old-tool' });
    provider.event({ type: 'tool.call', call_id: 'old-call', name: 'handle_customer_message' });
    provider.event({ type: 'reply.done', reply_id: 'old-tool', status: 'completed' });
    await vi.waitFor(() => expect(resolveOld).toBeDefined());
    provider.event({ type: 'transcript.user.delta', text: 'New question' });
    expect(oldSignal.aborted).toBe(true);
    resolveOld({ answer: 'Obsolete answer', incident: { id: 'obsolete' } });
    user(provider, 'New question', 'new-user');
    provider.event({ type: 'reply.started', reply_id: 'new-tool' });
    provider.event({ type: 'tool.call', call_id: 'new-call', name: 'handle_customer_message' });
    provider.event({ type: 'reply.done', reply_id: 'new-tool', status: 'completed' });
    await vi.waitFor(() => expect(provider.sent.filter((event) => event.type === 'tool.result')).toHaveLength(1));
    expect(provider.sent.find((event) => event.type === 'tool.result').call_id).toBe('new-call');
    provider.event({ type: 'reply.started', reply_id: 'new-answer' });
    provider.event({ type: 'transcript.agent', reply_id: 'old-tool', text: 'Obsolete answer' });
    expect(events.some((event) => event.type === 'agent.response')).toBe(false);
    provider.event({ type: 'reply.audio', data: audio });
    expect(events.find((event) => event.type === 'agent.response').text).toBe('Fresh answer');
    expect(events.some((event) => event.type === 'incident.update')).toBe(false);
  });

  it('treats a spoken stop as a control and allows the next customer question', async () => {
    const provider = await startBusiness();
    provider.event({ type: 'reply.started', reply_id: 'speaking' });
    provider.event({ type: 'reply.audio', data: audio });
    user(provider, 'Stop.', 'stop');
    provider.event({ type: 'reply.started', reply_id: 'stop-answer' });
    provider.event({ type: 'tool.call', call_id: 'unwanted', name: 'handle_customer_message' });
    provider.event({ type: 'reply.audio', data: audio });
    expect(fetch.mock.calls.filter(([url]) => url === '/business/tool')).toHaveLength(0);
    expect(audioSources).toHaveLength(1);
    user(provider, 'What are your hours?', 'follow-up');
    provider.event({ type: 'reply.started', reply_id: 'hours-tool' });
    provider.event({ type: 'tool.call', call_id: 'hours', name: 'handle_customer_message' });
    provider.event({ type: 'reply.done', status: 'completed' });
    await vi.waitFor(() => expect(provider.sent.some((event) => event.call_id === 'hours')).toBe(true));
    expect(session.microphoneActive).toBe(true);
  });
});
