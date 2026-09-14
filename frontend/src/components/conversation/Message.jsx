import { MESSAGE_ROLE } from '../../utils/constants';
import RobotAvatar from '../common/RobotAvatar';

export default function Message({ message }) {
  const { role, text, status } = message;
  const isUser = role === MESSAGE_ROLE.USER;

  return (
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      {/* Sender label */}
      <span className="text-[10px] text-[#5A6180] px-1 uppercase tracking-wider font-medium">
        {isUser ? 'You' : 'Vexora'}
      </span>

      <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Robot avatar for assistant */}
        {!isUser && (
          <RobotAvatar size="xs" className="mb-0.5 shrink-0" />
        )}

        <div
          className={`
            max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed
            ${isUser
              ? 'bg-[rgba(113,145,255,0.18)] text-[#DCE5FF] border border-[rgba(113,145,255,0.3)] rounded-br-sm'
              : 'bg-[rgba(255,255,255,0.06)] text-[#C5CEDE] border border-[rgba(180,195,255,0.12)] rounded-bl-sm backdrop-blur-sm'
            }
            ${status === 'partial' ? 'opacity-70' : ''}
          `}
          style={isUser ? {} : {
            boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
          }}
        >
          {text}
          {status === 'partial' && (
            <span className="inline-block ml-1 w-[3px] h-3.5 bg-[#7191FF] opacity-80 animate-pulse align-middle rounded-full" />
          )}
        </div>
      </div>
    </div>
  );
}
