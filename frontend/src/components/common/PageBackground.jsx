/**
 * PageBackground — reusable animated orb/bubble/grid background layer.
 * Drop this as the first child of any `position: relative` page wrapper.
 * All elements are pointer-events-none so they never interfere with UI.
 *
 * Usage:
 *   <div style={{ position: 'relative', minHeight: '100vh', background: '#080B18' }}>
 *     <PageBackground />
 *     ... page content ...
 *   </div>
 */
export default function PageBackground({ intensity = 1 }) {
  const alpha = (base) => Math.min(1, base * intensity);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      {/* ── Large ambient gradient blobs ─────────────────────── */}
      <div style={{
        position: 'absolute',
        width: 800, height: 800,
        top: -250, right: -200,
        borderRadius: '50%',
        background: `radial-gradient(circle, rgba(113,145,255,${alpha(0.09)}) 0%, transparent 70%)`,
      }} />
      <div style={{
        position: 'absolute',
        width: 600, height: 600,
        bottom: -180, left: -150,
        borderRadius: '50%',
        background: `radial-gradient(circle, rgba(155,140,255,${alpha(0.07)}) 0%, transparent 70%)`,
      }} />
      <div style={{
        position: 'absolute',
        width: 400, height: 400,
        top: '40%', left: '40%',
        borderRadius: '50%',
        background: `radial-gradient(circle, rgba(113,145,255,${alpha(0.04)}) 0%, transparent 70%)`,
      }} />

      {/* ── Floating glass spheres ────────────────────────────── */}
      {/* Large top-left */}
      <div className="animate-float" style={{
        position: 'absolute',
        width: 130, height: 130,
        top: '12%', left: '3%',
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, rgba(168,183,255,${alpha(0.3)}), rgba(113,145,255,${alpha(0.15)}), transparent 70%)`,
        border: `1px solid rgba(168,183,255,${alpha(0.18)})`,
        backdropFilter: 'blur(2px)',
        boxShadow: `0 0 40px rgba(113,145,255,${alpha(0.08)})`,
      }} />

      {/* Small bottom-left */}
      <div className="animate-float-reverse" style={{
        position: 'absolute',
        width: 65, height: 65,
        top: '65%', left: '6%',
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, rgba(168,183,255,${alpha(0.25)}), rgba(155,140,255,${alpha(0.12)}), transparent 70%)`,
        border: `1px solid rgba(168,183,255,${alpha(0.15)})`,
        backdropFilter: 'blur(2px)',
      }} />

      {/* Medium bottom-right */}
      <div className="animate-float-delay" style={{
        position: 'absolute',
        width: 90, height: 90,
        top: '78%', right: '8%',
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, rgba(168,183,255,${alpha(0.2)}), rgba(113,145,255,${alpha(0.1)}), transparent 70%)`,
        border: `1px solid rgba(168,183,255,${alpha(0.13)})`,
        backdropFilter: 'blur(2px)',
      }} />

      {/* Tiny top-right area */}
      <div className="animate-float-delay-2" style={{
        position: 'absolute',
        width: 44, height: 44,
        top: '22%', right: '18%',
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, rgba(168,183,255,${alpha(0.35)}), rgba(155,140,255,${alpha(0.18)}), transparent 70%)`,
        border: `1px solid rgba(168,183,255,${alpha(0.2)})`,
        backdropFilter: 'blur(2px)',
        boxShadow: `0 0 20px rgba(155,140,255,${alpha(0.12)})`,
      }} />

      {/* Medium top-center */}
      <div className="animate-float" style={{
        position: 'absolute',
        width: 55, height: 55,
        top: '8%', left: '45%',
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, rgba(155,140,255,${alpha(0.28)}), rgba(113,145,255,${alpha(0.14)}), transparent 70%)`,
        border: `1px solid rgba(155,140,255,${alpha(0.18)})`,
        backdropFilter: 'blur(2px)',
      }} />

      {/* Small mid-right */}
      <div className="animate-float-reverse" style={{
        position: 'absolute',
        width: 38, height: 38,
        top: '48%', right: '4%',
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, rgba(168,183,255,${alpha(0.3)}), transparent 70%)`,
        border: `1px solid rgba(168,183,255,${alpha(0.15)})`,
      }} />

      {/* ── Subtle grid overlay ───────────────────────────────── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: intensity * 0.028,
        backgroundImage: `
          linear-gradient(rgba(168,183,255,1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(168,183,255,1) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }} />

      {/* ── Noise texture for depth ───────────────────────────── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.015,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '256px 256px',
      }} />
    </div>
  );
}
