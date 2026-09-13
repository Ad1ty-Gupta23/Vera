import { CONNECTION_STATUS } from '../../utils/constants';

const statusMeta = {
  idle:         { label: 'Ready',       color: 'text-slate-400',   dot: 'bg-slate-500' },
  listening:    { label: 'Listening',   color: 'text-violet-400',  dot: 'bg-violet-400 animate-pulse' },
  processing:   { label: 'Thinking',    color: 'text-sky-400',     dot: 'bg-sky-400 animate-pulse' },
  clarifying:   { label: 'Clarifying',  color: 'text-amber-400',   dot: 'bg-amber-400 animate-pulse' },
  tool_pending: { label: 'Searching',   color: 'text-cyan-400',    dot: 'bg-cyan-400 animate-pulse' },
  responding:   { label: 'Responding',  color: 'text-emerald-400', dot: 'bg-emerald-400 animate-pulse' },
  interrupted:  { label: 'Interrupted', color: 'text-amber-400',   dot: 'bg-amber-400' },
  error:        { label: 'Error',       color: 'text-red-400',     dot: 'bg-red-500' },
};

const connMeta = {
  [CONNECTION_STATUS.DISCONNECTED]: { label: 'Not connected', dot: 'bg-slate-600' },
  [CONNECTION_STATUS.CONNECTING]:   { label: 'Connecting',    dot: 'bg-amber-400 animate-pulse' },
  [CONNECTION_STATUS.CONNECTED]:    { label: null,            dot: null },
  [CONNECTION_STATUS.ERROR]:        { label: 'Conn. error',   dot: 'bg-red-500' },
};

export default function AgentStatus({ agentStatus, connectionStatus }) {
  const conn = connMeta[connectionStatus] ?? connMeta[CONNECTION_STATUS.DISCONNECTED];
  const agent = statusMeta[agentStatus] ?? statusMeta['idle'];

  if (connectionStatus !== CONNECTION_STATUS.CONNECTED) {
    return (
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${conn.dot}`} />
        <span className="text-xs text-slate-500 tracking-wide">{conn.label}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${agent.dot}`} />
      <span className={`text-xs font-medium tracking-wide ${agent.color}`}>{agent.label}</span>
    </div>
  );
}
