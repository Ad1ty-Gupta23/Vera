import { useVERA } from '../hooks/useVERA';
import { useVoice } from '../hooks/useVoice';
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MapPanel from '../components/map/MapPanel';
import VisualPanel from '../components/visual/VisualPanel';
import ErrorMessage from '../components/common/ErrorMessage';
import Message from '../components/conversation/Message';
import Transcript from '../components/conversation/Transcript';
import RobotAvatar from '../components/common/RobotAvatar';
import AppBar from '../components/common/AppBar';
import PageBackground from '../components/common/PageBackground';
import { useAuth } from '../context/AuthContext';
import { CONNECTION_STATUS, AGENT_STATUS } from '../utils/constants';

export default function Dashboard() {
  const vera = useVERA();
  const { user, logout } = useAuth();
  const { startVoice, stopSession, sendText, stopSpeaking } = useVoice();
  const navigate = useNavigate();

  const [inputText, setInputText] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const isConnected = vera.connectionStatus === CONNECTION_STATUS.CONNECTED;
  const isConnecting = vera.connectionStatus === CONNECTION_STATUS.CONNECTING;
  const isProcessing =
    vera.agentStatus === AGENT_STATUS.PROCESSING ||
    vera.agentStatus === 'processing' ||
    vera.agentStatus === AGENT_STATUS.TOOL_PENDING;
  const isListening = vera.agentStatus === AGENT_STATUS.LISTENING;

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

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  /* Status helpers */
  const statusLabel = () => {
    if (isConnecting) return 'Connecting…';
    if (vera.agentStatus === 'processing') return 'Thinking…';
    if (vera.agentStatus === AGENT_STATUS.TOOL_PENDING) return 'Searching…';
    if (vera.isSpeaking) return 'Speaking…';
    if (isListening) return 'Listening…';
    if (isConnected) return 'Connected';
    return null;
  };

  const statusColor = () => {
    if (isConnecting) return '#FFB347';
    if (vera.agentStatus === 'processing' || vera.agentStatus === AGENT_STATUS.TOOL_PENDING) return '#A8B7FF';
    if (vera.isSpeaking) return '#9B8CFF';
    if (isListening) return '#7191FF';
    if (isConnected) return '#5A6180';
    return '#2D3560';
  };

  const label = statusLabel();
  const userInitials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div
      className="h-screen flex overflow-hidden"
      style={{ background: '#080B18', color: '#DCE5FF', fontFamily: "'Inter', system-ui, sans-serif", position: 'relative' }}
    >
      {/* ── Animated bubble / orb background ── */}
      <PageBackground intensity={0.7} />
      {/* ── Sidebar ── */}
      <>
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`
            fixed md:relative z-40 md:z-auto
            flex flex-col shrink-0 h-full
            transition-transform duration-300
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
          style={{
            width: '260px',
            background: 'rgba(10,13,28,0.95)',
            backdropFilter: 'blur(20px)',
            borderRight: '1px solid rgba(180,195,255,0.08)',
          }}
        >
          {/* Sidebar header — Logo */}
          <div
            className="flex items-center gap-3 px-5 py-4 border-b shrink-0"
            style={{ borderColor: 'rgba(180,195,255,0.08)' }}
          >
            <div
              className="w-8 h-8 rounded-xl overflow-hidden ring-1"
              style={{ boxShadow: '0 0 12px rgba(113,145,255,0.35)', ringColor: 'rgba(168,183,255,0.3)' }}
            >
              <img src="/vexora-avatar.jpg" alt="Vexora" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-bold font-display text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                VEXORA
              </p>
              <p className="text-[10px] text-[#5A6180] uppercase tracking-wider">AI Assistant</p>
            </div>
            {/* Close on mobile */}
            <button
              className="ml-auto md:hidden w-7 h-7 rounded-lg flex items-center justify-center text-[#5A6180] hover:text-[#A7AEC4]"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Nav links */}
          <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
            {/* New Chat */}
            <button
              id="dashboard-new-chat"
              onClick={() => window.location.reload()}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm transition-all duration-150 text-left"
              style={{ color: '#7191FF', background: 'rgba(113,145,255,0.1)', border: '1px solid rgba(113,145,255,0.2)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Conversation
            </button>

            <div className="h-px my-2" style={{ background: 'rgba(180,195,255,0.06)' }} />

            {/* Nav items */}
            {[
              {
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
                label: 'Home',
                href: '/',
              },
              {
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
                label: user?.plan === 'business' ? 'Business Dashboard' : 'Upgrade to Business',
                href: user?.plan === 'business' ? '/business/overview' : '/subscribe',
              },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.href}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-150"
                style={{ color: '#A7AEC4' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#DCE5FF'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#A7AEC4'; e.currentTarget.style.background = 'transparent'; }}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Sidebar footer — user profile + sign out */}
          <div
            className="px-3 py-4 border-t shrink-0"
            style={{ borderColor: 'rgba(180,195,255,0.08)' }}
          >
            {/* User info */}
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-2"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,195,255,0.08)' }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #7191FF, #9B8CFF)' }}
              >
                {userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#DCE5FF] truncate">
                  {user?.name ?? 'User'}
                </p>
                <p className="text-[10px] text-[#5A6180] truncate">{user?.email}</p>
              </div>
            </div>

            {/* Sign out */}
            <button
              id="dashboard-signout-btn"
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm transition-all duration-150"
              style={{ color: '#EF4444' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </div>
        </aside>
      </>

      {/* ── Main content ── */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">

        {/* Universal navigation bar */}
        <AppBar title="Chat" />

        {/* Chat status bar */}
        <header
          className="flex items-center justify-between px-4 py-2 shrink-0"
          style={{ borderBottom: '1px solid rgba(180,195,255,0.06)', background: 'rgba(8,11,24,0.6)' }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile sidebar toggle */}
            <button
              id="dashboard-mobile-sidebar-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[#5A6180] hover:text-[#A7AEC4] transition-colors"
              style={{ border: '1px solid rgba(180,195,255,0.1)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Voice status orb */}
            <div
              className="w-6 h-6 rounded-full border flex items-center justify-center transition-all duration-500"
              style={{
                borderColor: statusColor(),
                boxShadow: isConnected || isListening || vera.isSpeaking ? `0 0 10px ${statusColor()}60` : 'none',
              }}
            >
              <div
                className={`w-2 h-2 rounded-full transition-all duration-500 ${isConnected || isListening || vera.isSpeaking ? 'animate-pulse' : ''}`}
                style={{ background: statusColor() }}
              />
            </div>

            {label && (
              <span className="text-xs font-medium" style={{ color: statusColor() }}>{label}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {vera.isSpeaking && (
              <button
                onClick={stopSpeaking}
                className="text-xs px-3 py-1.5 rounded-lg transition-all duration-150 font-medium"
                style={{ background: 'rgba(155,140,255,0.12)', border: '1px solid rgba(155,140,255,0.3)', color: '#9B8CFF' }}
              >
                Stop Speaking
              </button>
            )}
          </div>
        </header>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Chat column */}
          <div
            className={`flex flex-col min-h-0 transition-all duration-300 ${vera.mapVisible || vera.visualVisible ? 'w-full md:w-[45%]' : 'w-full'
              }`}
          >
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4">
              {vera.messages.length === 0 && !vera.partialTranscript ? (
                /* Empty state */
                <div className="flex flex-1 items-center justify-center">
                  <div className="flex flex-col items-center gap-5 text-center max-w-xs">
                    <div className="relative">
                      <div
                        className="absolute inset-0 rounded-full animate-pulse"
                        style={{ background: 'radial-gradient(circle, rgba(113,145,255,0.15), transparent)', margin: '-16px' }}
                      />
                      <RobotAvatar size="lg" glow />
                    </div>
                    <div>
                      <p
                        className="font-bold text-lg text-white mb-1"
                        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                      >
                        Hi, I'm Vexora
                      </p>
                      <p className="text-sm" style={{ color: '#A7AEC4' }}>
                        Type a message or press the mic to start talking
                      </p>
                    </div>
                    {/* Quick prompts */}
                    <div className="flex flex-col gap-2 w-full">
                      {[
                        'Find hospitals near me',
                        'Show me a workflow diagram',
                        'What can you do?',
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => { sendText(prompt); }}
                          className="px-4 py-2.5 rounded-xl text-sm text-left transition-all duration-150"
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(180,195,255,0.1)',
                            color: '#A7AEC4',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(113,145,255,0.3)'; e.currentTarget.style.color = '#DCE5FF'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(180,195,255,0.1)'; e.currentTarget.style.color = '#A7AEC4'; }}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
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
            <div
              className="shrink-0 px-4 py-3"
              style={{ borderTop: '1px solid rgba(180,195,255,0.08)', background: 'rgba(8,11,24,0.6)', backdropFilter: 'blur(12px)' }}
            >
              <div className="flex items-end gap-2">

                {/* Text input */}
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    id="dashboard-text-input"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message…"
                    rows={1}
                    className="w-full resize-none rounded-2xl px-4 py-3 text-sm leading-relaxed transition-all duration-200 focus:outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: `1px solid ${inputText ? 'rgba(113,145,255,0.4)' : 'rgba(180,195,255,0.1)'}`,
                      color: '#DCE5FF',
                      minHeight: '44px',
                      maxHeight: '128px',
                      overflowY: 'auto',
                      boxShadow: inputText ? '0 0 0 3px rgba(113,145,255,0.08)' : 'none',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(113,145,255,0.5)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(113,145,255,0.1)';
                    }}
                    onBlur={(e) => {
                      if (!inputText) {
                        e.currentTarget.style.borderColor = 'rgba(180,195,255,0.1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  />
                </div>

                {/* Send button */}
                <button
                  id="dashboard-send-btn"
                  onClick={handleSend}
                  disabled={!inputText.trim() || isProcessing}
                  aria-label="Send message"
                  className="shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95 focus:outline-none"
                  style={{
                    background: inputText.trim() && !isProcessing ? '#7191FF' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${inputText.trim() && !isProcessing ? 'rgba(113,145,255,0.5)' : 'rgba(180,195,255,0.1)'}`,
                    color: inputText.trim() && !isProcessing ? '#fff' : '#5A6180',
                    boxShadow: inputText.trim() && !isProcessing ? '0 0 16px rgba(113,145,255,0.35)' : 'none',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>

                {/* Mic button */}
                <button
                  id="dashboard-mic-btn"
                  onClick={handleToggleVoice}
                  disabled={isConnecting}
                  aria-label={isConnected ? 'Stop voice' : 'Start voice'}
                  className="shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: isListening
                      ? '#7191FF'
                      : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${isListening ? 'rgba(113,145,255,0.6)' : 'rgba(180,195,255,0.12)'}`,
                    color: isListening ? '#fff' : '#5A6180',
                    boxShadow: isListening ? '0 0 20px rgba(113,145,255,0.5)' : 'none',
                  }}
                >
                  {isListening ? (
                    /* Stop icon */
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
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

              {/* Voice listening hint */}
              {isListening && (
                <p className="text-xs mt-2 text-center animate-pulse" style={{ color: 'rgba(113,145,255,0.7)' }}>
                  Listening — speak now
                </p>
              )}
            </div>
          </div>

          {/* Map panel — desktop */}
          {vera.mapVisible && (
            <div
              className="hidden md:flex flex-col flex-1 min-h-0 p-3"
              style={{ borderLeft: '1px solid rgba(180,195,255,0.08)' }}
            >
              <MapPanel
                location={vera.location}
                searchResults={vera.searchResults}
                selectedPlace={vera.selectedPlace}
                onSelectPlace={vera.setSelectedPlace}
                onClose={vera.closeMap}
              />
            </div>
          )}

          {/* Visual panel — desktop */}
          {vera.visualVisible && (
            <div
              className="hidden md:flex flex-col flex-1 min-h-0 p-3"
              style={{ borderLeft: '1px solid rgba(180,195,255,0.08)', minWidth: '420px' }}
            >
              <VisualPanel
                visualType={vera.visualType}
                visualSpec={vera.visualSpec}
                visible={vera.visualVisible}
              />
            </div>
          )}
        </div>

        {/* Mobile map */}
        {vera.mapVisible && (
          <div
            className="md:hidden h-64 shrink-0 p-3"
            style={{ borderTop: '1px solid rgba(180,195,255,0.08)' }}
          >
            <MapPanel
              location={vera.location}
              searchResults={vera.searchResults}
              selectedPlace={vera.selectedPlace}
              onSelectPlace={vera.setSelectedPlace}
              onClose={vera.closeMap}
            />
          </div>
        )}

        {/* Mobile visual panel */}
        {vera.visualVisible && (
          <div
            className="md:hidden h-64 shrink-0 p-3"
            style={{ borderTop: '1px solid rgba(180,195,255,0.08)' }}
          >
            <VisualPanel
              visualType={vera.visualType}
              visualSpec={vera.visualSpec}
              visible={vera.visualVisible}
            />
          </div>
        )}
      </div>
    </div>
  );
}