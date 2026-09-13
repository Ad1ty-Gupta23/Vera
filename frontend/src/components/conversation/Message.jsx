import { MESSAGE_ROLE } from '../../utils/constants';

export default function Message({ message }) {
  const { role, text, status } = message;
  const isUser = role === MESSAGE_ROLE.USER;

  return (
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      <span className="text-xs text-slate-600 px-1">
        {isUser ? 'You' : 'VERA'}
      </span>
      <div
        className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-violet-600/25 text-slate-100 border border-violet-500/25 rounded-br-md'
            : 'bg-slate-800/70 text-slate-200 border border-slate-700/50 rounded-bl-md'
        } ${status === 'partial' ? 'opacity-60' : ''}`}
      >
        {text}
        {status === 'partial' && (
          <span className="inline-block ml-1 w-1 h-3 bg-current opacity-70 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}
