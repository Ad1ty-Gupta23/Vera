import { useRef, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useVERA } from './useVERA';
import { useLocation } from './useLocation';
import { createFreeVoiceSession } from '../services/freeVoice';
import { speak, stop as stopSpeech } from '../services/tts';
import { isStopCommand } from '../utils/voiceCommands';
import { CONNECTION_STATUS, AGENT_STATUS, MESSAGE_ROLE } from '../utils/constants';

export function useVoice() {
  const vera = useVERA();
  const veraRef = useRef(vera);
  useLayoutEffect(() => { veraRef.current = vera; }, [vera]);
  const sessionRef = useRef(null);
  const wsRef = useRef(null);
  const voiceRequested = useRef(false);
  const voiceReady = useRef(false);
  const voiceAttempt = useRef(0);
  const suppressResponse = useRef(false);
  const previewMessage = useRef(null);
  const responsePending = useRef(false);
  const [isVoiceStarting, setVoiceStarting] = useState(false);
  const [voiceMode, setVoiceMode] = useState(null);

  const { handleLocationRequest } = useLocation({
    wsRef,
    onLocationObtained: (loc) => veraRef.current.setLocation(loc),
    onLocationError: (msg) => veraRef.current.setError(msg),
  });
  const locationHandler = useRef(handleLocationRequest);
  useLayoutEffect(() => { locationHandler.current = handleLocationRequest; }, [handleLocationRequest]);

  const interruptReply = useCallback((notifyServer = false) => {
    suppressResponse.current = true;
    previewMessage.current = null;
    responsePending.current = false;
    stopSpeech();
    const current = veraRef.current;
    current.setSpeaking(false);
    current.setAgentStatus(voiceRequested.current ? AGENT_STATUS.LISTENING : AGENT_STATUS.IDLE);
    if (notifyServer) sessionRef.current?.interrupt();
  }, []);

  const stopVoice = useCallback(() => {
    voiceAttempt.current += 1;
    voiceRequested.current = false;
    voiceReady.current = false;
    setVoiceStarting(false);
    interruptReply(true);
    sessionRef.current?.stopMicrophone();
    veraRef.current.setListening(false);
    veraRef.current.setPartialTranscript(null);
  }, [interruptReply]);

  const stopSession = useCallback(() => {
    stopVoice();
    const session = sessionRef.current;
    sessionRef.current = null;
    wsRef.current = null;
    session?.stop();
    veraRef.current.setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
  }, [stopVoice]);

  useEffect(() => () => stopSession(), [stopSession]);

  const handleEvent = useCallback((event) => {
    const current = veraRef.current;
    switch (event.type) {
      case 'session.begin':
        current.setConnectionStatus(CONNECTION_STATUS.CONNECTED);
        break;
      case 'voice.mode':
        setVoiceMode(event.mode);
        break;
      case 'voice.playback':
        current.setSpeaking(event.active);
        if (event.active) current.setAgentStatus(AGENT_STATUS.RESPONDING);
        else if (!responsePending.current) current.setAgentStatus(voiceRequested.current ? AGENT_STATUS.LISTENING : AGENT_STATUS.IDLE);
        break;
      case 'voice.status':
        if (event.status === 'listening' && voiceRequested.current) {
          voiceReady.current = true;
          setVoiceStarting(false);
          current.setListening(Boolean(sessionRef.current?.microphoneActive));
          current.setAgentStatus(AGENT_STATUS.LISTENING);
        } else if (event.status === 'connecting' && voiceRequested.current) {
          voiceReady.current = false;
          setVoiceStarting(true);
        } else if (event.status === 'unavailable') {
          stopVoice();
          current.setError(event.message || 'Voice is unavailable. You can keep typing or try starting voice again.');
        }
        break;
      case 'transcript.partial':
        if (!voiceRequested.current) break;
        if (event.text?.trim()) interruptReply();
        current.setPartialTranscript(event.text);
        break;
      case 'transcript.final':
        if (!voiceRequested.current) break;
        interruptReply();
        current.setPartialTranscript(null);
        current.addMessage({ role: MESSAGE_ROLE.USER, text: event.text });
        // The backend consumes this as a control, without generating an answer.
        if (isStopCommand(event.text)) current.setAgentStatus(AGENT_STATUS.LISTENING);
        break;
      case 'agent.response':
        if (suppressResponse.current) break;
        if (event.phase === 'final' && previewMessage.current === event.message_id) {
          current.updateLastMessage({ text: event.text });
          previewMessage.current = null;
        } else {
          current.addMessage({ role: MESSAGE_ROLE.ASSISTANT, text: event.text });
        }
        responsePending.current = event.phase === 'preview';
        if (event.phase === 'preview') previewMessage.current = event.message_id;
        // The initial explanation is already playing while the visual builds.
        // Updating its chat bubble must not restart or interrupt that speech.
        if (event.speak === false || event.audioManaged) break;
        current.setSpeaking(true);
        speak(event.text, {
          rate: voiceRequested.current ? 1.08 : 1.0,
          onEnd: () => {
            veraRef.current.setSpeaking(false);
            veraRef.current.setAgentStatus(responsePending.current ? AGENT_STATUS.PROCESSING
              : voiceRequested.current ? AGENT_STATUS.LISTENING : AGENT_STATUS.IDLE);
          },
        });
        break;
      case 'speech.started':
        if (voiceRequested.current) interruptReply();
        break;
      case 'agent.interrupted':
        interruptReply();
        break;
      case 'agent.status':
        if (event.status === AGENT_STATUS.PROCESSING) {
          suppressResponse.current = false;
          responsePending.current = true;
        } else if (event.status === AGENT_STATUS.LISTENING) {
          responsePending.current = false;
        }
        current.setAgentStatus(
          ['idle', 'responding', 'interrupted'].includes(event.status) && voiceRequested.current
            ? AGENT_STATUS.LISTENING : event.status,
        );
        break;
      case 'location.request':
        wsRef.current = sessionRef.current?._ws;
        locationHandler.current();
        break;
      case 'visual.show':
      case 'visual.update':
        if (!suppressResponse.current) current.setVisual({ visual_type: event.visual_type, visual: event.visual });
        break;
      case 'visual.hide':
        if (!suppressResponse.current) current.hideVisual();
        break;
      case 'location.updated':
        if (event.location) current.setLocation(event.location);
        break;
      case 'places.loading':
        current.setAgentStatus(AGENT_STATUS.TOOL_PENDING);
        break;
      case 'places.error':
        current.setError(event.error?.message ?? 'Could not retrieve nearby places.');
        current.setAgentStatus(voiceRequested.current ? AGENT_STATUS.LISTENING : AGENT_STATUS.IDLE);
        break;
      case 'map.show':
      case 'map.hide':
      case 'agent.state':
      case 'places.updated':
        if (!suppressResponse.current) current.handleAgentEvent(event);
        break;
      case 'microphone.error':
        stopVoice();
        current.setError(event.message);
        break;
      case 'session.end':
      case 'connection.closed':
        stopSession();
        if (event.message) current.setError(event.message);
        break;
      case 'error':
        // A failed answer/location request must not shut down the microphone.
        current.setError(event.message ?? 'Voice session error');
        current.setAgentStatus(voiceRequested.current ? AGENT_STATUS.LISTENING : AGENT_STATUS.IDLE);
        break;
      default:
        break;
    }
  }, [interruptReply, stopVoice, stopSession]);

  const getSession = useCallback(() => {
    if (sessionRef.current) return sessionRef.current;
    const session = createFreeVoiceSession((event) => {
      // Ignore callbacks from a socket that was replaced or explicitly ended.
      if (sessionRef.current === session) handleEvent(event);
    });
    sessionRef.current = session;
    return session;
  }, [handleEvent]);

  const startVoice = useCallback(async () => {
    if (voiceRequested.current) return;
    const attempt = ++voiceAttempt.current;
    voiceRequested.current = true;
    voiceReady.current = false;
    setVoiceStarting(true);
    const current = veraRef.current;
    current.clearError();
    const session = getSession();
    if (!session._ws || session._ws.readyState !== WebSocket.OPEN) {
      current.setConnectionStatus(CONNECTION_STATUS.CONNECTING);
    }
    try {
      const started = await session.start();
      if (sessionRef.current !== session || attempt !== voiceAttempt.current || !voiceRequested.current || !started) return;
      wsRef.current = session._ws;
      current.setConnectionStatus(CONNECTION_STATUS.CONNECTED);
      current.setListening(true);
      setVoiceStarting(!voiceReady.current);
    } catch (error) {
      if (sessionRef.current !== session || attempt !== voiceAttempt.current) return;
      stopVoice();
      // Permission failure leaves the conversation socket available for typing.
      wsRef.current = session._ws;
      const connected = session._ws?.readyState === WebSocket.OPEN;
      if (!connected) {
        sessionRef.current = null;
        wsRef.current = null;
        session.stop();
      }
      current.setConnectionStatus(connected ? CONNECTION_STATUS.CONNECTED : CONNECTION_STATUS.ERROR);
      const message = error?.name === 'NotAllowedError' ? 'Microphone permission denied.'
        : error?.name === 'NotFoundError' ? 'No microphone found.'
          : 'Could not start voice. You can keep typing or try again.';
      current.setError(message);
    }
  }, [getSession, stopVoice]);

  const sendText = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const current = veraRef.current;
    current.clearError();
    interruptReply(true);
    const session = getSession();
    try {
      await session.startTextOnly();
      if (sessionRef.current !== session) return;
      wsRef.current = session._ws;
      current.setConnectionStatus(CONNECTION_STATUS.CONNECTED);
      current.addMessage({ role: MESSAGE_ROLE.USER, text: trimmed });
      await session.sendText(trimmed);
    } catch {
      if (sessionRef.current === session) {
        stopSession();
        current.setError('Could not connect to VERA. Is the backend running?');
      }
    }
  }, [getSession, interruptReply, stopSession]);

  const stopSpeaking = useCallback(() => interruptReply(true), [interruptReply]);

  return {
    startVoice, stopVoice, stopSession, sendText, stopSpeaking,
    isVoiceActive: vera.isListening, isVoiceStarting, voiceMode,
  };
}
