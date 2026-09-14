import { AGENT_STATUS } from '../../utils/constants';

const orbConfig = {
  [AGENT_STATUS.IDLE]: {
    outerRing: 'border-[#2D3560]',
    innerBg: 'bg-[#171C2F]',
    glow: '',
    dotColor: 'bg-[#2D3560]',
    spin: false,
    pulse: false,
  },
  [AGENT_STATUS.LISTENING]: {
    outerRing: 'border-[#7191FF]',
    innerBg: 'bg-[rgba(113,145,255,0.12)]',
    glow: 'shadow-[0_0_32px_rgba(113,145,255,0.45),0_0_60px_rgba(113,145,255,0.15)]',
    dotColor: 'bg-[#7191FF]',
    spin: false,
    pulse: true,
  },
  [AGENT_STATUS.PROCESSING]: {
    outerRing: 'border-[#A8B7FF]',
    innerBg: 'bg-[rgba(168,183,255,0.1)]',
    glow: 'shadow-[0_0_28px_rgba(168,183,255,0.3)]',
    dotColor: 'bg-[#A8B7FF]',
    spin: true,
    pulse: false,
  },
  [AGENT_STATUS.TOOL_PENDING]: {
    outerRing: 'border-[#A8B7FF]',
    innerBg: 'bg-[rgba(168,183,255,0.08)]',
    glow: 'shadow-[0_0_24px_rgba(168,183,255,0.25)]',
    dotColor: 'bg-[#A8B7FF]',
    spin: true,
    pulse: false,
  },
  [AGENT_STATUS.RESPONDING]: {
    outerRing: 'border-[#9B8CFF]',
    innerBg: 'bg-[rgba(155,140,255,0.12)]',
    glow: 'shadow-[0_0_32px_rgba(155,140,255,0.4),0_0_60px_rgba(155,140,255,0.12)]',
    dotColor: 'bg-[#9B8CFF]',
    spin: false,
    pulse: true,
  },
  [AGENT_STATUS.INTERRUPTED]: {
    outerRing: 'border-[#FFB347]',
    innerBg: 'bg-[rgba(255,179,71,0.08)]',
    glow: 'shadow-[0_0_20px_rgba(255,179,71,0.25)]',
    dotColor: 'bg-[#FFB347]',
    spin: false,
    pulse: false,
  },
  [AGENT_STATUS.ERROR]: {
    outerRing: 'border-red-500',
    innerBg: 'bg-[rgba(239,68,68,0.08)]',
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.25)]',
    dotColor: 'bg-red-500',
    spin: false,
    pulse: false,
  },
};

export default function VoiceOrb({ agentStatus = AGENT_STATUS.IDLE }) {
  const cfg = orbConfig[agentStatus] ?? orbConfig[AGENT_STATUS.IDLE];

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      {/* Outer ring */}
      <div
        className={`
          relative flex items-center justify-center w-28 h-28 rounded-full border-2
          transition-all duration-500
          ${cfg.outerRing} ${cfg.glow}
        `}
      >
        {/* Spinning arc overlay for processing states */}
        {cfg.spin && (
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#A8B7FF] animate-spin" />
        )}

        {/* Pulse ring for listening/speaking */}
        {cfg.pulse && (
          <div className={`absolute inset-[-8px] rounded-full border ${cfg.outerRing} opacity-30 animate-ping`} />
        )}

        {/* Inner core */}
        <div
          className={`
            w-20 h-20 rounded-full transition-all duration-500
            ${cfg.innerBg}
            flex items-center justify-center
          `}
        >
          {/* Mic icon for listening, waveform bars for speaking, dot otherwise */}
          {agentStatus === AGENT_STATUS.LISTENING && (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7191FF" strokeWidth="1.8">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
          {agentStatus === AGENT_STATUS.RESPONDING && (
            <div className="flex items-end gap-[3px] h-6">
              {[1, 1.5, 1, 1.8, 1.2, 1.5, 1].map((h, i) => (
                <div
                  key={i}
                  className="w-[3px] rounded-full bg-[#9B8CFF]"
                  style={{
                    height: `${h * 8}px`,
                    animationName: 'waveform',
                    animationDuration: `${0.8 + i * 0.1}s`,
                    animationDelay: `${i * 0.07}s`,
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                  }}
                />
              ))}
            </div>
          )}
          {agentStatus === AGENT_STATUS.PROCESSING || agentStatus === AGENT_STATUS.TOOL_PENDING ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A8B7FF" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          ) : null}
          {agentStatus === AGENT_STATUS.IDLE && (
            <div className="w-3 h-3 rounded-full bg-[#2D3560]" />
          )}
          {agentStatus === AGENT_STATUS.ERROR && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          {agentStatus === AGENT_STATUS.INTERRUPTED && (
            <div className="w-4 h-4 rounded bg-[#FFB347]" />
          )}
        </div>
      </div>
    </div>
  );
}
