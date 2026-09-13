/**
 * voice.js — WebSocket + optional microphone session
 *
 * start()     — connects WebSocket AND starts microphone (voice mode)
 * startTextOnly() — connects WebSocket only, no mic (text mode)
 * stop()      — cleans up everything
 */

const WS_URL = 'ws://localhost:8000/api/ws/voice';
const SAMPLE_RATE = 16000;

export function createVoiceSession(onEvent, wsUrl = WS_URL) {
  let ws = null;
  let audioContext = null;
  let workletNode = null;
  let stream = null;
  let sourceNode = null;
  let stopped = false;

  function cleanupAudio() {
    workletNode?.disconnect();
    sourceNode?.disconnect();
    stream?.getTracks().forEach((t) => t.stop());
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(() => {});
    }
    workletNode = null;
    sourceNode = null;
    stream = null;
    audioContext = null;
  }

  function cleanup() {
    stopped = true;
    cleanupAudio();
    if (ws && ws.readyState < WebSocket.CLOSING) {
      ws.close();
    }
    ws = null;
  }

  async function connectWs() {
    ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('WebSocket connection failed'));
    });

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        onEvent(event);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (!stopped) {
        onEvent({ type: 'error', message: 'Connection closed unexpectedly' });
        cleanup();
      }
    };

    ws.onerror = () => {
      if (!stopped) {
        onEvent({ type: 'error', message: 'WebSocket error' });
        cleanup();
      }
    };
  }

  async function startMic() {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: SAMPLE_RATE, channelCount: 1, echoCancellation: true },
    });

    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    await audioContext.audioWorklet.addModule('/microphoneProcessor.js');

    sourceNode = audioContext.createMediaStreamSource(stream);
    workletNode = new AudioWorkletNode(audioContext, 'microphone-processor');

    workletNode.port.onmessage = (e) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(e.data);
      }
    };

    sourceNode.connect(workletNode);
  }

  // Full voice mode: WebSocket + microphone
  async function start() {
    await connectWs();
    await startMic();
  }

  // Text-only mode: WebSocket only, no mic
  async function startTextOnly() {
    await connectWs();
  }

  function stop() {
    cleanup();
  }

  return { start, startTextOnly, stop, get _ws() { return ws; } };
}