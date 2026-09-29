import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVoiceSession } from './voice';

let sockets;
let tracks;
let contexts;
let worklets;
let getUserMedia;
let session;

class FakeSocket {
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 0;
  send = vi.fn();
  constructor(url) { this.url = url; sockets.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
  close() { this.readyState = 3; this.onclose?.(); }
  event(event) { this.onmessage?.({ data: JSON.stringify(event) }); }
}

beforeEach(() => {
  sockets = []; tracks = []; contexts = []; worklets = [];
  getUserMedia = vi.fn(async () => {
    const track = { stop: vi.fn() };
    tracks.push(track);
    return { getTracks: () => [track] };
  });
  vi.stubGlobal('WebSocket', FakeSocket);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  vi.stubGlobal('AudioContext', class {
    state = 'running';
    destination = {};
    audioWorklet = { addModule: vi.fn(async () => {}) };
    source = { connect: vi.fn(), disconnect: vi.fn() };
    gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
    resume = vi.fn(async () => {});
    close = vi.fn(async () => { this.state = 'closed'; });
    constructor() { contexts.push(this); }
    createMediaStreamSource() { return this.source; }
    createGain() { return this.gain; }
  });
  vi.stubGlobal('AudioWorkletNode', class {
    port = {};
    connect = vi.fn();
    disconnect = vi.fn();
    constructor() { worklets.push(this); }
  });
  session = createVoiceSession(vi.fn(), undefined, { voiceControls: true });
});

afterEach(() => { session.stop(); });

describe('persistent microphone transport', () => {
  it('adds voice to a text socket, keeps capturing across replies, and pauses only the mic', async () => {
    const textConnection = session.startTextOnly();
    sockets[0].open();
    await textConnection;
    expect(getUserMedia).not.toHaveBeenCalled();
    await session.start();
    expect(sockets).toHaveLength(1);
    expect(sockets[0].url).toContain('voice=manual');
    expect(sockets[0].send).toHaveBeenCalledWith(JSON.stringify({ type: 'voice.start' }));
    expect(contexts[0].gain.gain.value).toBe(0);
    expect(contexts[0].gain.connect).toHaveBeenCalledWith(contexts[0].destination);
    sockets[0].event({ type: 'agent.response', text: 'First reply' });
    sockets[0].event({ type: 'agent.status', status: 'idle' });
    const sendAudio = worklets[0].port.onmessage;
    sendAudio({ data: new ArrayBuffer(3200) });
    expect(tracks[0].stop).not.toHaveBeenCalled();
    session.stopMicrophone();
    expect(tracks[0].stop).toHaveBeenCalledTimes(1);
    expect(sockets[0].readyState).toBe(1);
    const count = sockets[0].send.mock.calls.length;
    sendAudio({ data: new ArrayBuffer(3200) });
    expect(sockets[0].send).toHaveBeenCalledTimes(count);
    await session.start();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(session.microphoneActive).toBe(true);
    expect(sockets).toHaveLength(1);
  });

  it('does not turn the mic on if voice is ended while the socket opens', async () => {
    const starting = session.start();
    session.stopMicrophone();
    sockets[0].open();
    expect(await starting).toBe(false);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('releases a microphone permission result that arrives after voice was ended', async () => {
    let grant;
    const lateTrack = { stop: vi.fn() };
    getUserMedia.mockImplementationOnce(() => new Promise((resolve) => { grant = resolve; }));
    const starting = session.start();
    sockets[0].open();
    await vi.waitFor(() => expect(grant).toBeDefined());
    session.stopMicrophone();
    grant({ getTracks: () => [lateTrack] });
    expect(await starting).toBe(false);
    expect(lateTrack.stop).toHaveBeenCalledTimes(1);
    expect(session.microphoneActive).toBe(false);
    await session.start();
    expect(session.microphoneActive).toBe(true);
  });

  it('cleans up capture on disconnect and fails promptly when the socket closes before opening', async () => {
    const starting = session.start();
    sockets[0].close();
    await expect(starting).rejects.toThrow('WebSocket connection failed');
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
