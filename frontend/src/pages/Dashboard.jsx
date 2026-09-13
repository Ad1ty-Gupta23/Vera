import { useVERA } from '../hooks/useVERA';
import { useVoice } from '../hooks/useVoice';
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MapPanel from '../components/map/MapPanel';
import VisualPanel from '../components/visual/VisualPanel';
import ErrorMessage from '../components/common/ErrorMessage';
import Message from '../components/conversation/Message';
import Transcript from '../components/conversation/Transcript';
import { useAuth } from '../context/AuthContext';
import { CONNECTION_STATUS, AGENT_STATUS } from '../utils/constants';

export default function Dashboard() {
  const vera = useVERA();
  const { user } = useAuth();
  const { startVoice, stopSession, sendText, stopSpeaking } = useVoice();

  const [inputText, setInputText] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const isConnected = vera.connectionStatus === CONNECTION_STATUS.CONNECTED;
  const isConnecting = vera.connectionStatus === CONNECTION_STATUS.CONNECTING;
  const isProcessing = vera.agentStatus === AGENT_STATUS.PROCESSING ||
                       vera.agentStatus === 'processing' ||
                       vera.agentStatus === AGENT_STATUS.TOOL_PENDING;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [vera.messages, vera.partialTranscript]);

  const handleToggleVoice = async () => {
    if (isConnected || isConnecting) {
      stopSession();
    } else {
      await startVoice();
    }
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    sendText(text);
    setInputText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const statusLabel = () => {
    if (isConnecting) return 'Connecting…';
    if (vera.agentStatus === 'processing') return 'Thinking…';
    if (vera.agentStatus === AGENT_STATUS.TOOL_PENDING) return 'Searching…';
    if (vera.isSpeaking) return 'Speaking…';
    if (vera.agentStatus === AGENT_STATUS.LISTENING) return 'Listening…';
    if (isConnected) return 'Connected';
    return null;
  };

  const statusColor = () => {
    if (isConnecting) return 'text-amber-400';
    if (vera.agentStatus === 'processing' || vera.agentStatus === AGENT_STATUS.TOOL_PENDING) return 'text-sky-400';
    if (vera.isSpeaking) return 'text-emerald-400';
    if (vera.agentStatus === AGENT_STATUS.LISTENING) return 'text-violet-400';
    if (isConnected) return 'text-slate-400';
    return 'text-slate-600';
  };

  const label = statusLabel();

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden">

      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-slate-800/70 shrink-0">
        <div className="flex items-center gap-3">
          {/* Logo orb */}
          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
            vera.agentStatus === AGENT_STATUS.LISTENING ? 'border-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.4)]' :
            vera.isSpeaking ? 'border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]' :
            isProcessing ? 'border-sky-500 shadow-[0_0_12px_rgba(14,165,233,0.3)]' :
            'border-slate-700'
          }`}>
            <div className={`w-3 h-3 rounded-full transition-all duration-500 ${
              vera.agentStatus === AGENT_STATUS.LISTENING ? 'bg-violet-500 animate-pulse' :
              vera.isSpeaking ? 'bg-emerald-500 animate-pulse' :
              isProcessing ? 'bg-sky-500 animate-pulse' :
              'bg-slate-700'
            }`} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white leading-none">VERA</h1>
            <p className="text-xs text-slate-600 leading-none mt-0.5">Voice-to-Action Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={user?.plan === 'business' ? '/business/overview' : '/subscribe'}
            className="text-xs px-2.5 py-1 rounded-lg border border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all"
          >
            {user?.plan === 'business' ? 'Business dashboard' : 'Upgrade to Business'}
          </Link>
          {label && (
            <span className={`text-xs font-medium ${statusColor()}`}>{label}</span>
          )}
          {vera.isSpeaking && (
            <button
              onClick={stopSpeaking}
              className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all"
            >
              Stop speaking
            </button>
          )}
        </div>
      </header>

      {/* Body — chat + optional map */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Chat column */}
        <div className={`flex flex-col min-h-0 transition-all duration-300 ${(vera.mapVisible || vera.visualVisible) ? 'w-full md:w-[45%]' : 'w-full'}`}>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {vera.messages.length === 0 && !vera.partialTranscript ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full border-2 border-slate-800 flex items-center justify-center mx-auto mb-4">
                    <div className="w-6 h-6 rounded-full bg-slate-800" />
                  </div>
                  <p className="text-slate-400 text-sm font-medium">Hi, I'm VERA</p>
                  <p className="text-slate-600 text-xs mt-1">Type a message or press the mic to speak</p>
                </div>
              </div>
            ) : (
              <>
                {vera.messages.map((msg) => (
                  <Message key={msg.id} message={msg} />
                ))}
                {vera.partialTranscript && (
                  <Transcript partialTranscript={vera.partialTranscript} />
                )}
              </>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Error */}
          {vera.error && (
            <div className="px-4 pb-2">
              <ErrorMessage error={vera.error} onDismiss={vera.clearError} />
            </div>
          )}

          {/* Input bar */}
          <div className="shrink-0 px-4 py-3 border-t border-slate-800/70">
            <div className="flex items-end gap-2">

              {/* Text input */}
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message…"
                  rows={1}
                  className="w-full resize-none bg-slate-900 border border-slate-700/60 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all leading-relaxed max-h-32 overflow-y-auto"
                  style={{ minHeight: '44px' }}
                />
              </div>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || isProcessing}
                className="shrink-0 w-11 h-11 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 disabled:text-slate-600 text-white flex items-center justify-center transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                aria-label="Send message"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>

              {/* Mic button */}
              <button
                onClick={handleToggleVoice}
                disabled={isConnecting}
                className={`shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-all active:scale-95 focus:outline-none focus:ring-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                  vera.agentStatus === AGENT_STATUS.LISTENING
                    ? 'bg-violet-600 text-white shadow-[0_0_16px_rgba(139,92,246,0.4)] focus:ring-violet-500/40'
                    : 'bg-slate-800 border border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600 focus:ring-slate-500/40'
                }`}
                aria-label={isConnected ? 'Stop voice' : 'Start voice'}
              >
                {vera.agentStatus === AGENT_STATUS.LISTENING ? (
                  /* Stop/square icon when listening */
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                ) : (
                  /* Mic icon */
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                )}
              </button>
            </div>

            {/* Voice hint */}
            {vera.agentStatus === AGENT_STATUS.LISTENING && (
              <p className="text-xs text-violet-400/70 mt-2 text-center animate-pulse">
                Listening — speak now
              </p>
            )}
          </div>
        </div>

        {/* Map panel */}
        {vera.mapVisible && (
          <div className="hidden md:flex flex-col flex-1 min-h-0 p-3 border-l border-slate-800/70">
            <MapPanel
              location={vera.location}
              searchResults={vera.searchResults}
              selectedPlace={vera.selectedPlace}
              onSelectPlace={vera.setSelectedPlace}
              onClose={vera.closeMap}
            />
          </div>
        )}

        {/* Visual panel — diagram / 3D scene / image explanation */}
        {vera.visualVisible && (
          <div
            className="hidden md:flex flex-col flex-1 min-h-0 p-3 border-l border-slate-800/70"
            style={{ minWidth: 420 }}
          >
            <VisualPanel
              visualType={vera.visualType}
              visualSpec={vera.visualSpec}
              visible={vera.visualVisible}
            />
          </div>
        )}
      </div>

      {/* Mobile map — slides up below chat */}
      {vera.mapVisible && (
        <div className="md:hidden h-64 shrink-0 border-t border-slate-800/70 p-3">
          <MapPanel
            location={vera.location}
            searchResults={vera.searchResults}
            selectedPlace={vera.selectedPlace}
            onSelectPlace={vera.setSelectedPlace}
            onClose={vera.closeMap}
          />
        </div>
      )}

      {/* Mobile visual panel — slides up below chat */}
      {vera.visualVisible && (
        <div className="md:hidden h-64 shrink-0 border-t border-slate-800/70 p-3">
          <VisualPanel
            visualType={vera.visualType}
            visualSpec={vera.visualSpec}
            visible={vera.visualVisible}
          />
        </div>
      )}
    </div>
  );
}