/** A conversation socket whose microphone can be enabled and paused independently. */
import API_BASE, { toWebSocketUrl } from './api';

const WS_URL = toWebSocketUrl(`${API_BASE}/ws/voice`);
const SAMPLE_RATE = 16000;

export function createVoiceSession(onEvent, wsUrl = WS_URL, { voiceControls = false } = {}) {
  let ws = null;
  let connecting = null;
  let startingMic = null;
  let audioContext = null;
  let workletNode = null;
  let silentGain = null;
  let stream = null;
  let sourceNode = null;
  let stopped = false;
  let micGeneration = 0;

  function sendControl(type) {
    if (voiceControls && ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type }));
  }

  function cleanupAudio() {
    micGeneration += 1;
    workletNode?.disconnect();
    sourceNode?.disconnect();
    silentGain?.disconnect();
    stream?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => {});
    workletNode = sourceNode = silentGain = stream = audioContext = null;
  }

  function cleanup() {
    stopped = true;
    cleanupAudio();
    if (ws && ws.readyState < WebSocket.CLOSING) ws.close();
    ws = null;
  }

  function connectWs() {
    if (stopped) return Promise.reject(new Error('Session has ended'));
    if (ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (connecting) return connecting;
    const url = new URL(wsUrl);
    if (voiceControls) url.searchParams.set('voice', 'manual');
    const socket = new WebSocket(url.toString());
    ws = socket;
    socket.binaryType = 'arraybuffer';
    connecting = new Promise((resolve, reject) => {
      let opened = false;
      const timeout = window.setTimeout(() => {
        reject(new Error('Connection timed out'));
        cleanup();
      }, 10000);
      socket.onopen = () => {
        window.clearTimeout(timeout);
        opened = true;
        resolve();
      };
      // Install handlers before opening so the first session event cannot be lost.
      socket.onmessage = (event) => {
        if (stopped || ws !== socket) return;
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        onEvent(data);
      };
      const closed = () => {
        window.clearTimeout(timeout);
        if (!opened) reject(new Error('WebSocket connection failed'));
        if (!stopped && ws === socket) {
          cleanup();
          onEvent({ type: voiceControls ? 'connection.closed' : 'error', message: 'Connection lost. Start voice or send a message to reconnect.' });
        }
      };
      socket.onclose = closed;
      socket.onerror = closed;
    }).finally(() => { connecting = null; });
    return connecting;
  }

  async function startMic() {
    if (stream) return true;
    if (startingMic) return startingMic;
    const generation = micGeneration;
    startingMic = (async () => {
      const captured = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE, channelCount: 1,
          echoCancellation: true, noiseSuppression: true, autoGainControl: !voiceControls,
        },
      });
      if (stopped || generation !== micGeneration) {
        captured.getTracks().forEach((track) => track.stop());
        return false;
      }
      stream = captured;
      try {
        const context = new AudioContext({ sampleRate: SAMPLE_RATE });
        audioContext = context;
        await context.audioWorklet.addModule('/microphoneProcessor.js?v=noise-gate-1');
        if (stopped || generation !== micGeneration) return false;
        sourceNode = context.createMediaStreamSource(captured);
        workletNode = new AudioWorkletNode(context, 'microphone-processor', {
          processorOptions: { noiseGate: voiceControls },
        });
        silentGain = context.createGain();
        silentGain.gain.value = 0;
        workletNode.port.onmessage = (event) => {
          if (generation === micGeneration && ws?.readyState === WebSocket.OPEN) ws.send(event.data);
        };
        // A connected, silent output keeps the worklet processing continuously.
        sourceNode.connect(workletNode);
        workletNode.connect(silentGain);
        silentGain.connect(context.destination);
        await context.resume();
        if (stopped || generation !== micGeneration) return false;
        captured.getTracks().forEach((track) => {
          track.onended = () => {
            stopMicrophone();
            onEvent({ type: 'microphone.error', message: 'Microphone disconnected. Reconnect it and start voice again.' });
          };
        });
        sendControl('voice.start');
        return true;
      } catch (error) {
        if (generation === micGeneration) cleanupAudio();
        throw error;
      }
    })().finally(() => { startingMic = null; });
    return startingMic;
  }

  async function start() {
    const generation = micGeneration;
    await connectWs();
    if (startingMic) await startingMic.catch(() => {});
    if (stopped || generation !== micGeneration) return false;
    return startMic();
  }

  function stopMicrophone() {
    cleanupAudio();
    sendControl('voice.stop');
  }

  return {
    start,
    startTextOnly: connectWs,
    stopMicrophone,
    interrupt: () => sendControl('agent.interrupt'),
    stop: cleanup,
    get _ws() { return ws; },
    get microphoneActive() { return Boolean(stream); },
  };
}
