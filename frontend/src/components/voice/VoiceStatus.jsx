import { AGENT_STATUS } from '../../utils/constants';

const statusMeta = {
  [AGENT_STATUS.IDLE]:        { label: 'Idle',        dot: 'bg-slate-500' },
  [AGENT_STATUS.LISTENING]:   { label: 'Listening',   dot: 'bg-violet-400' },
  [AGENT_STATUS.THINKING]:    { label: 'Thinking',    dot: 'bg-sky-400' },
  [AGENT_STATUS.SPEAKING]:    { label: 'Speaking',    dot: 'bg-emerald-400' },
  [AGENT_STATUS.INTERRUPTED]: { label: 'Interrupted', dot: 'bg-amber-400' },
  [AGENT_STATUS.SEARCHING]:   { label: 'Searching',   dot: 'bg-cyan-400' },
  [AGENT_STATUS.ERROR]:       { label: 'Error',       dot: 'bg-red-500' },
};

export default function VoiceStatus({ agentStatus = AGENT_STATUS.IDLE }) {
  const meta = statusMeta[agentStatus] ?? statusMeta[AGENT_STATUS.IDLE];
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
      <span className="text-xs font-medium tracking-widest uppercase text-slate-400">
        {meta.label}
      </span>
    </div>
  );
}
