/**
 * SectionHeading — animated section heading with label + title + subtitle
 */
export default function SectionHeading({
  label,
  title,
  subtitle,
  align = 'center',
  className = '',
}) {
  const alignClass = {
    center: 'text-center items-center',
    left: 'text-left items-start',
    right: 'text-right items-end',
  };

  return (
    <div className={`flex flex-col gap-3 ${alignClass[align]} ${className}`}>
      {label && (
        <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7191FF] px-3 py-1.5 rounded-full glass border border-[rgba(113,145,255,0.25)]">
          {label}
        </span>
      )}
      {title && (
        <h2 className="font-display font-bold text-3xl md:text-4xl lg:text-5xl text-white leading-tight">
          {title}
        </h2>
      )}
      {subtitle && (
        <p className="text-[#A7AEC4] text-base md:text-lg leading-relaxed max-w-2xl">
          {subtitle}
        </p>
      )}
    </div>
  );
}
