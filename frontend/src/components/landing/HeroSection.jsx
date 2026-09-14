import { Link } from 'react-router-dom';
import GlowButton from '../common/GlowButton';
import AnimatedReveal from '../common/AnimatedReveal';

/* Floating glass sphere decoration */
function FloatingSphere({ size, top, left, right, animClass, opacity = 0.12 }) {
  return (
    <div
      className={`absolute rounded-full pointer-events-none ${animClass}`}
      style={{
        width: size,
        height: size,
        top,
        left,
        right,
        background: `radial-gradient(circle at 35% 35%, rgba(168,183,255,${opacity * 2}), rgba(113,145,255,${opacity}), transparent 70%)`,
        border: '1px solid rgba(168,183,255,0.15)',
        backdropFilter: 'blur(2px)',
      }}
    />
  );
}

export default function HeroSection() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center overflow-hidden pt-16"
      style={{ background: 'linear-gradient(160deg, #080B18 0%, #101426 50%, #0D1230 100%)' }}
    >
      {/* Abstract background gradient blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute rounded-full"
          style={{
            width: 700,
            height: 700,
            top: '-200px',
            right: '-200px',
            background: 'radial-gradient(circle, rgba(113,145,255,0.08) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 500,
            height: 500,
            bottom: '-150px',
            left: '-100px',
            background: 'radial-gradient(circle, rgba(155,140,255,0.07) 0%, transparent 70%)',
          }}
        />

        {/* Floating decorative spheres */}
        <FloatingSphere size="120px" top="15%" left="5%" animClass="animate-float" opacity={0.15} />
        <FloatingSphere size="60px" top="60%" left="8%" animClass="animate-float-reverse" opacity={0.12} />
        <FloatingSphere size="80px" top="80%" right="10%" animClass="animate-float-delay" opacity={0.1} />
        <FloatingSphere size="40px" top="25%" right="28%" animClass="animate-float-delay-2" opacity={0.18} />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(rgba(168,183,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(168,183,255,1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-6 items-center min-h-[calc(100vh-64px)] py-16">

          {/* Left — Text content */}
          <div className="flex flex-col gap-6">
            <AnimatedReveal delay={0}>
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7191FF] px-4 py-2 rounded-full glass border border-[rgba(113,145,255,0.25)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7191FF] animate-pulse" />
                Voice-First Intelligence
              </span>
            </AnimatedReveal>

            <AnimatedReveal delay={100}>
              <h1 className="font-display font-bold text-5xl sm:text-6xl lg:text-7xl leading-[1.05] text-white">
                MEET{' '}
                <span className="shimmer-text">VEXORA</span>
              </h1>
            </AnimatedReveal>

            <AnimatedReveal delay={200}>
              <p className="text-xl sm:text-2xl text-[#A8B7FF] font-display font-medium leading-snug">
                Your AI that can listen, think,<br className="hidden sm:block" /> visualize, and take action.
              </p>
            </AnimatedReveal>

            <AnimatedReveal delay={300}>
              <p className="text-[#A7AEC4] text-base leading-relaxed max-w-lg">
                Talk naturally, explore live information, generate visual workflows,
                connect your Gmail, and create personalized AI experiences for your business.
              </p>
            </AnimatedReveal>

            <AnimatedReveal delay={400}>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  to="/dashboard"
                  id="hero-start-talking"
                  className="px-7 py-3.5 text-sm font-semibold font-display text-white rounded-xl bg-[#7191FF] hover:bg-[#8BA5FF] hover:shadow-[0_0_30px_rgba(113,145,255,0.5)] transition-all duration-200 btn-glow flex items-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                  Start Talking
                </Link>
                <a
                  href="/#features"
                  id="hero-explore-features"
                  className="px-7 py-3.5 text-sm font-semibold font-display text-[#DCE5FF] rounded-xl glass border border-[rgba(168,183,255,0.25)] hover:bg-white/10 hover:border-[rgba(168,183,255,0.5)] transition-all duration-200"
                >
                  Explore Features
                </a>
              </div>
            </AnimatedReveal>

            <AnimatedReveal delay={500}>
              <p className="text-xs text-[#5A6180] flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Powered by AssemblyAI voice technology
              </p>
            </AnimatedReveal>
          </div>

          {/* Right — Robot visual */}
          <AnimatedReveal direction="right" delay={200}>
            <div className="relative flex items-center justify-center lg:justify-end">

              {/* Glow ring behind robot */}
              <div
                className="absolute rounded-full animate-pulse-glow"
                style={{
                  width: '360px',
                  height: '360px',
                  background: 'radial-gradient(circle, rgba(113,145,255,0.12) 0%, transparent 70%)',
                  border: '1px solid rgba(113,145,255,0.1)',
                }}
              />

              {/* Hero robot image */}
              <div className="relative z-10 w-full max-w-[520px]">
                <img
                  src="/vexora-robot-hero.jpg"
                  alt="Vexora AI Robot"
                  className="w-full rounded-2xl"
                  style={{ filter: 'drop-shadow(0 0 40px rgba(113,145,255,0.2))' }}
                  loading="eager"
                />

                {/* Floating stat cards */}
                <div
                  className="absolute top-8 -left-4 glass rounded-2xl px-4 py-3 flex items-center gap-3 animate-float border border-[rgba(168,183,255,0.2)] shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                  style={{ minWidth: '160px' }}
                >
                  <div className="w-8 h-8 rounded-xl bg-[rgba(113,145,255,0.2)] flex items-center justify-center shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8B7FF" strokeWidth="2">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#5A6180] uppercase tracking-wider">Status</p>
                    <p className="text-sm font-semibold text-[#A8B7FF]">Listening…</p>
                  </div>
                </div>

                <div
                  className="absolute bottom-12 -right-4 glass rounded-2xl px-4 py-3 flex items-center gap-3 animate-float-reverse border border-[rgba(168,183,255,0.2)] shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                  style={{ minWidth: '170px' }}
                >
                  <div className="w-8 h-8 rounded-xl bg-[rgba(155,140,255,0.2)] flex items-center justify-center shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9B8CFF" strokeWidth="2">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#5A6180] uppercase tracking-wider">Response</p>
                    <p className="text-sm font-semibold text-white">98ms latency</p>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedReveal>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce opacity-40">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A8B7FF" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    </section>
  );
}
