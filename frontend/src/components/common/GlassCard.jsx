/**
 * GlassCard — reusable glassmorphism card component
 */
export default function GlassCard({
  children,
  className = '',
  glow = false,
  glowColor = 'periwinkle',
  hover = true,
  padding = 'p-6',
  onClick,
}) {
  const glowStyles = {
    periwinkle: 'hover:shadow-[0_0_40px_rgba(113,145,255,0.2)]',
    violet: 'hover:shadow-[0_0_40px_rgba(155,140,255,0.2)]',
    blue: 'hover:shadow-[0_0_40px_rgba(113,145,255,0.25)]',
  };

  return (
    <div
      onClick={onClick}
      className={`
        glass rounded-2xl transition-all duration-300
        ${padding}
        ${hover ? 'hover:bg-white/[0.09] hover:border-[rgba(168,183,255,0.35)]' : ''}
        ${glow ? glowStyles[glowColor] : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
