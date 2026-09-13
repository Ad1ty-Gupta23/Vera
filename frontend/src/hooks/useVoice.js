import { useRef, useCallback } from 'react';
import { useVERA } from './useVERA';
import { useLocation } from './useLocation';
import { createVoiceSession } from '../services/voice';
import { speak, stop as stopSpeech } from '../services/tts';
import { CONNECTION_STATUS, AGENT_STATUS, MESSAGE_ROLE } from '../utils/constants';

export function useVoice() {
  const vera = useVERA();
  const sessionRef = useRef(null);
  const wsRef = useRef(null);

  const { handleLocationRequest } = useLocation({
    wsRef,
    onLocationObtained: (loc) => vera.setLocation(loc),
    onLocationError: (msg) => vera.setError(msg),
  });

  const handleEvent = useCallback(
    (event) => {
      switch (event.type) {
        case 'session.begin':
          vera.setConnectionStatus(CONNECTION_STATUS.CONNECTED);
          if (event.voice_available === false) {
            // AssemblyAI unavailable — text mode only
            vera.setAgentStatus(AGENT_STATUS.IDLE);
            vera.setListening(false);
          } else {
            vera.setAgentStatus(AGENT_STATUS.LISTENING);
            vera.setListening(true);
          }
          break;

        case 'transcript.partial':
          vera.setPartialTranscript(event.text);
          break;

        case 'transcript.final':
          vera.setPartialTranscript(null);
          vera.addMessage({ role: MESSAGE_ROLE.USER, text: event.text });
          break;

        case 'agent.response': {
          const text = event.text;
          vera.addMessage({ role: MESSAGE_ROLE.ASSISTANT, text });
          vera.setSpeaking(true);
          speak(text, { onEnd: () => vera.setSpeaking(false) });
          break;
        }

        case 'speech.started':
          // Earliest possible barge-in signal — AssemblyAI fires this the
          // instant it detects you talking, before any transcript text
          // exists. By the time you interrupt, VERA has usually already
          // finished "thinking" and is just reading its answer out loud, so
          // there's nothing left for the backend to cancel — the frontend
          // has to stop the audio itself, immediately, on this event.
          stopSpeech();
          vera.setSpeaking(false);
          break;

        case 'agent.interrupted':
          // Backend cancelled VERA's in-progress turn because the user
          // started speaking again — stop reading the old response out loud
          // immediately. The mic keeps listening the whole time; the new
          // utterance's transcript/response will arrive as its own events.
          stopSpeech();
          vera.setSpeaking(false);
          vera.setAgentStatus(AGENT_STATUS.INTERRUPTED);
          break;

        case 'location.request':
          handleLocationRequest();
          break;

        case 'visual.show':
        case 'visual.update':
          vera.setVisual({ visual_type: event.visual_type, visual: event.visual });
          break;

        case 'visual.hide':
          vera.hideVisual();
          break;

        case 'location.updated':
          if (event.location) vera.setLocation(event.location);
          break;

        case 'places.loading':
          vera.setAgentStatus(AGENT_STATUS.TOOL_PENDING);
          break;

        case 'places.error':
          vera.setError(event.error?.message ?? 'Could not retrieve nearby places.');
          vera.setAgentStatus(AGENT_STATUS.IDLE);
          break;

        case 'map.show':
        case 'map.hide':
        case 'agent.state':
        case 'agent.status':
        case 'places.updated':
          vera.handleAgentEvent(event);
          break;

        case 'session.end':
          vera.setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
          vera.setAgentStatus(AGENT_STATUS.IDLE);
          vera.setListening(false);
          vera.setPartialTranscript(null);
          break;

        case 'error':
          vera.setError(event.message ?? 'Voice session error');
          vera.setConnectionStatus(CONNECTION_STATUS.ERROR);
          vera.setAgentStatus(AGENT_STATUS.IDLE);
          vera.setListening(false);
          vera.setPartialTranscript(null);
          break;

        default:
          if (import.meta.env.DEV) console.debug('[VERA] unhandled event', event);
      }
    },
    [vera, handleLocationRequest]
  );

  // Connect WebSocket + start microphone (voice mode)
  const startVoice = useCallback(async () => {
    if (sessionRef.current) return;
    vera.clearError();
    vera.setConnectionStatus(CONNECTION_STATUS.CONNECTING);

    const session = createVoiceSession(handleEvent);
    sessionRef.current = session;

    try {
      await session.start();
      wsRef.current = session._ws;
      // Mark connected immediately — session.begin will update agent status when ready
      vera.setConnectionStatus(CONNECTION_STATUS.CONNECTED);
      vera.setAgentStatus(AGENT_STATUS.IDLE);
    } catch (err) {
      sessionRef.current = null;
      wsRef.current = null;
      const msg =
        err?.name === 'NotAllowedError' ? 'Microphone permission denied.' :
        err?.name === 'NotFoundError' ? 'No microphone found.' :
        'Could not start voice session.';
      vera.setError(msg);
      vera.setConnectionStatus(CONNECTION_STATUS.ERROR);
      vera.setAgentStatus(AGENT_STATUS.IDLE);
    }
  }, [handleEvent, vera]);

  // Connect WebSocket only — no mic (text mode)
  const ensureConnected = useCallback(async () => {
    if (sessionRef.current) return true;
    vera.clearError();
    vera.setConnectionStatus(CONNECTION_STATUS.CONNECTING);

    const session = createVoiceSession(handleEvent);
    sessionRef.current = session;

    try {
      await session.startTextOnly();
      wsRef.current = session._ws;
      vera.setConnectionStatus(CONNECTION_STATUS.CONNECTED);
      vera.setAgentStatus(AGENT_STATUS.IDLE);
      return true;
    } catch (err) {
      sessionRef.current = null;
      wsRef.current = null;
      vera.setError('Could not connect to VERA. Is the backend running?');
      vera.setConnectionStatus(CONNECTION_STATUS.ERROR);
      vera.setAgentStatus(AGENT_STATUS.IDLE);
      return false;
    }
  }, [handleEvent, vera]);

  const stopSession = useCallback(() => {
    stopSpeech();
    sessionRef.current?.stop();
    sessionRef.current = null;
    wsRef.current = null;
    vera.setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
    vera.setAgentStatus(AGENT_STATUS.IDLE);
    vera.setListening(false);
    vera.setPartialTranscript(null);
    vera.setSpeaking(false);
  }, [vera]);

  // Send typed text — auto-connects if needed
  const sendText = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const connected = await ensureConnected();
      if (!connected) return;

      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        vera.setError('Connection lost. Please try again.');
        return;
      }

      vera.addMessage({ role: MESSAGE_ROLE.USER, text: trimmed });
      ws.send(JSON.stringify({ type: 'text.message', text: trimmed }));
    },
    [ensureConnected, vera]
  );

  const stopSpeaking = useCallback(() => {
    stopSpeech();
    vera.setSpeaking(false);
  }, [vera]);

  return { startVoice, stopSession, sendText, stopSpeaking };
}