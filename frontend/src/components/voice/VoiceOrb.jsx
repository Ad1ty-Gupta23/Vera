import { AGENT_STATUS } from '../../utils/constants';

const orbConfig = {
  [AGENT_STATUS.IDLE]: {
    ring: 'border-slate-700',
    core: 'bg-slate-800',
    glow: '',
    animation: '',
    label: 'Idle',
  },
  [AGENT_STATUS.LISTENING]: {
    ring: 'border-violet-500',
    core: 'bg-violet-950',
    glow: 'shadow-[0_0_24px_4px_rgba(139,92,246,0.25)]',
    animation: 'animate-pulse',
    label: 'Listening',
  },
  [AGENT_STATUS.THINKING]: {
    ring: 'border-sky-500',
    core: 'bg-sky-950',
    glow: 'shadow-[0_0_24px_4px_rgba(14,165,233,0.2)]',
    animation: 'animate-spin-slow',
    label: 'Thinking',
  },
  [AGENT_STATUS.SPEAKING]: {
    ring: 'border-emerald-500',
    core: 'bg-emerald-950',
    glow: 'shadow-[0_0_28px_6px_rgba(16,185,129,0.25)]',
    animation: 'animate-pulse',
    label: 'Speaking',
  },
  [AGENT_STATUS.INTERRUPTED]: {
    ring: 'border-amber-500',
    core: 'bg-amber-950',
    glow: 'shadow-[0_0_20px_4px_rgba(245,158,11,0.2)]',
    animation: '',
    label: 'Interrupted',
  },
  [AGENT_STATUS.SEARCHING]: {
    ring: 'border-cyan-500',
    core: 'bg-cyan-950',
    glow: 'shadow-[0_0_24px_4px_rgba(6,182,212,0.2)]',
    animation: 'animate-pulse',
    label: 'Searching',
  },
  [AGENT_STATUS.ERROR]: {
    ring: 'border-red-600',
    core: 'bg-red-950',
    glow: 'shadow-[0_0_20px_4px_rgba(220,38,38,0.2)]',
    animation: '',
    label: 'Error',
  },
};

export default function VoiceOrb({ agentStatus = AGENT_STATUS.IDLE }) {
  const config = orbConfig[agentStatus] ?? orbConfig[AGENT_STATUS.IDLE];

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      {/* Outer ring */}
      <div
        className={`relative flex items-center justify-center w-28 h-28 rounded-full border-2 transition-all duration-500 ${config.ring} ${config.glow}`}
      >
        {/* Spinning arc for thinking state */}
        {agentStatus === AGENT_STATUS.THINKING && (
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-sky-400 animate-spin" />
        )}
        {/* Core */}
        <div
          className={`w-20 h-20 rounded-full transition-all duration-500 ${config.core} ${config.animation} flex items-center justify-center`}
        >
          {/* Inner dot */}
          <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
            agentStatus === AGENT_STATUS.IDLE ? 'bg-slate-600' : 'bg-white/30'
          }`} />
        </div>
      </div>
    </div>
  );
}
