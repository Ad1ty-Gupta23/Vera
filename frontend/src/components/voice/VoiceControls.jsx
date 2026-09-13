import { CONNECTION_STATUS, AGENT_STATUS } from '../../utils/constants';

export default function VoiceControls({
  agentStatus,
  connectionStatus,
  onStart,
  onStop,
}) {
  const isConnecting = connectionStatus === CONNECTION_STATUS.CONNECTING;
  const isListening = agentStatus === AGENT_STATUS.LISTENING;
  const canStop = isListening;
  const canStart = !isListening && !isConnecting;

  return (
    <div className="flex items-center gap-3">
      {canStop ? (
        <button
          onClick={onStop}
          className="px-5 py-2 rounded-full text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-red-500/40"
        >
          Stop
        </button>
      ) : (
        <button
          onClick={onStart}
          disabled={!canStart}
          className="px-6 py-2 rounded-full text-sm font-medium bg-violet-600/20 text-violet-300 border border-violet-500/40 hover:bg-violet-600/30 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {isConnecting ? 'Connecting…' : 'Start'}
        </button>
      )}
    </div>
  );
}
