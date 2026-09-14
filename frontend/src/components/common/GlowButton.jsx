/**
 * GlowButton — primary and secondary button variants with periwinkle glow
 */
export default function GlowButton({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  href,
  disabled = false,
  className = '',
  type = 'button',
  id,
}) {
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
    xl: 'px-10 py-5 text-lg',
  };

  const variants = {
    primary: `
      bg-[#7191FF] text-white font-semibold
      hover:bg-[#8BA5FF] hover:shadow-[0_0_30px_rgba(113,145,255,0.5)]
      active:scale-[0.98]
      disabled:bg-[#2D3560] disabled:text-[#5A6180] disabled:shadow-none disabled:cursor-not-allowed
    `,
    secondary: `
      glass text-[#DCE5FF] font-medium
      hover:bg-white/10 hover:border-[rgba(168,183,255,0.5)] hover:text-white
      active:scale-[0.98]
    `,
    ghost: `
      text-[#A7AEC4] font-medium
      hover:text-white hover:bg-white/5
      active:scale-[0.98]
    `,
    danger: `
      bg-red-500/15 border border-red-500/30 text-red-400 font-medium
      hover:bg-red-500/25 hover:border-red-500/50
      active:scale-[0.98]
    `,
  };

  const baseClass = `
    inline-flex items-center justify-center gap-2
    rounded-xl border border-transparent
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-[rgba(113,145,255,0.4)]
    font-display btn-glow
    ${sizes[size]}
    ${variants[variant]}
    ${className}
  `;

  if (href) {
    return (
      <a href={href} id={id} className={baseClass}>
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      id={id}
      onClick={onClick}
      disabled={disabled}
      className={baseClass}
    >
      {children}
    </button>
  );
}
