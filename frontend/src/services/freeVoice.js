/** Managed audio + the existing VERA socket for session-scoped tools and history. */
import { createVoiceSession } from './voice';
import { createAssemblyVoiceAgentSession, VoiceAgentUnavailableError } from './assemblyVoiceAgent';
import { isStopCommand } from '../utils/voiceCommands';

export function createFreeVoiceSession(onEvent) {
  let managed = null;
  let generation = 0;
  let userMessageId = null;
  let latestUserText = '';
  let starting = null;
  const pending = new Map();

  function send(event) {
    if (transport._ws?.readyState !== WebSocket.OPEN) throw new Error('VERA connection is closed');
    transport._ws.send(JSON.stringify(event));
  }

  function cancelPending() {
    [...pending.values()].forEach((entry) => entry.reject(new DOMException('Voice request cancelled', 'AbortError')));
  }

  function request(type, payload = {}, signal) {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const finish = (callback, value) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', aborted);
        pending.delete(requestId);
        callback(value);
      };
      const aborted = () => finish(reject, new DOMException('Voice request cancelled', 'AbortError'));
      const timer = setTimeout(() => {
        finish(reject, new VoiceAgentUnavailableError('Voice request timed out'));
        if (type === 'managed.tool') transport.interrupt();
      }, type === 'managed.bootstrap' ? 14000 : 42000);
      pending.set(requestId, {
        resolve: (value) => finish(resolve, value),
        reject: (error) => finish(reject, error),
      });
      signal?.addEventListener('abort', aborted, { once: true });
      if (signal?.aborted) { aborted(); return; }
      try { send({ type, ...payload, request_id: requestId }); }
      catch (error) { finish(reject, error); }
    });
  }

  function handleBackend(event) {
    if (event.type === 'managed.result') {
      const entry = pending.get(event.request_id);
      if (event.error) entry?.reject(new VoiceAgentUnavailableError(event.error));
      else entry?.resolve(event.result);
      return;
    }
    // A cancelled tool must not change the screen when its old events arrive.
    if (event.request_id && !pending.has(event.request_id)) return;
    if (managed && ['agent.response', 'agent.interrupted', 'agent.status', 'voice.status'].includes(event.type)) {
      if (event.request_id && event.type === 'agent.status' && event.status === 'processing') onEvent(event);
      return;
    }
    if (event.type === 'connection.closed') {
      managed?.stop();
      managed = null;
      cancelPending();
    }
    onEvent(event);
  }

  const transport = createVoiceSession(handleBackend, undefined, { voiceControls: true });

  function recordUser(text, id = crypto.randomUUID()) {
    userMessageId = `voice-user:${id}`;
    latestUserText = text;
    send({ type: 'managed.user', message_id: userMessageId, text });
  }

  function handleManaged(event) {
    if (event.type === 'voice.mode') {
      onEvent(event);
      onEvent({ type: 'voice.status', status: 'listening' });
      return;
    }
    if (event.type === 'speech.started') transport.interrupt();
    if (event.type === 'transcript.final') {
      recordUser(event.text, event.eventId || crypto.randomUUID());
      if (isStopCommand(event.text)) transport.interrupt();
    }
    if (event.type === 'agent.response') {
      send({ type: 'managed.assistant', message_id: `voice-assistant:${event.eventId || crypto.randomUUID()}`, text: event.text });
    }
    onEvent(event);
  }

  async function start() {
    const attempt = ++generation;
    await transport.startTextOnly();
    if (attempt !== generation) return false;
    onEvent({ type: 'voice.status', status: 'connecting' });
    const session = createAssemblyVoiceAgentSession((event) => {
      if (managed === session && attempt === generation) handleManaged(event);
    }, {
      conversationMode: true,
      getBootstrap: () => request('managed.bootstrap'),
      executeTool: (call, { signal }) => request('managed.tool', {
        name: call.name,
        message: latestUserText || call.arguments?.message,
        user_message_id: userMessageId,
      }, signal),
    });
    managed = session;
    try {
      await session.start();
      return attempt === generation;
    } catch (error) {
      if (attempt !== generation) return false;
      managed = null;
      session.stop();
      send({ type: 'managed.stop' });
      if (!error.fallbackAllowed) throw error;
      onEvent({ type: 'voice.mode', mode: 'realtime-stt' });
      return transport.start();
    }
  }

  function stopMicrophone() {
    generation += 1;
    starting = null;
    const session = managed;
    managed = null;
    session?.stop();
    cancelPending();
    if (transport._ws?.readyState === WebSocket.OPEN) send({ type: 'managed.stop' });
    transport.stopMicrophone();
  }

  return {
    start: () => {
      if (!starting) {
        const attempt = start().finally(() => { if (starting === attempt) starting = null; });
        starting = attempt;
      }
      return starting;
    },
    startTextOnly: transport.startTextOnly,
    stopMicrophone,
    interrupt: () => { managed?.interrupt(); transport.interrupt(); },
    sendText: async (text) => {
      // Wait for managed readiness (or fallback) before choosing the text path.
      // Otherwise the managed setup could hide an ordinary pipeline's answer.
      while (starting) await starting.catch(() => {});
      if (managed?.ready) {
        recordUser(text);
        managed.sendText(text);
        onEvent({ type: 'agent.status', status: 'processing' });
      } else send({ type: 'text.message', text });
    },
    stop: () => { stopMicrophone(); transport.stop(); },
    get _ws() { return transport._ws; },
    get microphoneActive() { return managed ? managed.microphoneActive : transport.microphoneActive; },
  };
}
