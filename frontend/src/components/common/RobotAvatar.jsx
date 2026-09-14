/**
 * RobotAvatar — small inline robot avatar for chat messages and UI
 */
export default function RobotAvatar({ size = 'sm', glow = false, className = '' }) {
  const sizes = {
    xs: 'w-5 h-5',
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  };

  return (
    <div
      className={`
        ${sizes[size]} rounded-full overflow-hidden shrink-0
        ${glow ? 'shadow-[0_0_14px_rgba(113,145,255,0.5)]' : ''}
        ring-1 ring-[rgba(168,183,255,0.3)]
        ${className}
      `}
    >
      <img
        src="/vexora-avatar.jpg"
        alt="Vexora AI"
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
}
