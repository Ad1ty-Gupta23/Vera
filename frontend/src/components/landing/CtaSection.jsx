import { Link } from 'react-router-dom';
import AnimatedReveal from '../common/AnimatedReveal';
import GlassCard from '../common/GlassCard';

export default function CtaSection() {
  return (
    <section
      className="py-24 md:py-32 relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #101426 0%, #080B18 100%)' }}
    >
      {/* Centered glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(113,145,255,0.08) 0%, transparent 70%)' }}
      />

      {/* Decorative orbs */}
      <div
        className="absolute left-10 top-16 w-32 h-32 rounded-full animate-float-reverse pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(113,145,255,0.1), transparent)', border: '1px solid rgba(168,183,255,0.1)' }}
      />
      <div
        className="absolute right-12 bottom-16 w-20 h-20 rounded-full animate-float pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(155,140,255,0.1), transparent)', border: '1px solid rgba(155,140,255,0.1)' }}
      />

      <div className="max-w-4xl mx-auto px-4 md:px-6 text-center relative z-10">
        <AnimatedReveal>
          <div className="flex flex-col items-center gap-8">
            <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#7191FF] px-4 py-2 rounded-full glass border border-[rgba(113,145,255,0.25)]">
              Get Started Today
            </span>

            <h2 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl text-white leading-tight">
              READY TO TALK<br />
              <span className="shimmer-text">TO THE FUTURE?</span>
            </h2>

            <p className="text-[#A7AEC4] text-base md:text-lg max-w-xl leading-relaxed">
              Join and experience what it feels like to have a truly intelligent AI assistant at your side — one that listens, thinks, and acts.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                to="/dashboard"
                id="cta-start-talking"
                className="px-8 py-4 text-base font-semibold font-display text-white rounded-xl bg-[#7191FF] hover:bg-[#8BA5FF] hover:shadow-[0_0_40px_rgba(113,145,255,0.5)] transition-all duration-200 btn-glow flex items-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
                Start Talking
              </Link>
              <Link
                to="/subscribe"
                id="cta-build-business"
                className="px-8 py-4 text-base font-semibold font-display text-[#DCE5FF] rounded-xl glass border border-[rgba(168,183,255,0.25)] hover:bg-white/10 hover:border-[rgba(168,183,255,0.5)] transition-all duration-200 flex items-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Build for Your Business
              </Link>
            </div>

            {/* Mini robot card */}
            <GlassCard padding="px-5 py-3" className="inline-flex items-center gap-3 mt-2">
              <div className="w-10 h-10 rounded-xl overflow-hidden ring-1 ring-[rgba(168,183,255,0.3)]">
                <img src="/vexora-avatar.jpg" alt="Vexora" className="w-full h-full object-cover" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">Vexora is ready</p>
                <p className="text-xs text-[#5A6180]">No setup required · Start instantly</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-[#7191FF] animate-pulse" />
            </GlassCard>
          </div>
        </AnimatedReveal>
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-20 pt-8 border-t border-[rgba(180,195,255,0.07)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5A6180]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md overflow-hidden">
            <img src="/vexora-avatar.jpg" alt="Vexora" className="w-full h-full object-cover" />
          </div>
          <span className="font-display font-semibold text-[#A7AEC4]">VEXORA</span>
          <span className="text-[#2D3560]">·</span>
          <span>Voice-First AI Assistant</span>
        </div>
        <span>Powered by AssemblyAI · LangGraph · ChromaDB · Google OAuth</span>
      </div>
    </section>
  );
}
