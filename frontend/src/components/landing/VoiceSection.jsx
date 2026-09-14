import { Link } from 'react-router-dom';
import AnimatedReveal from '../common/AnimatedReveal';
import SectionHeading from '../common/SectionHeading';
import GlassCard from '../common/GlassCard';

/* Waveform bars */
function Waveform({ active, bars = 12 }) {
  return (
    <div className="flex items-center gap-[3px] h-8">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full transition-all duration-300 ${active ? 'bg-[#7191FF]' : 'bg-[#2D3560]'}`}
          style={{
            height: active ? `${20 + Math.sin(i * 0.8) * 14}px` : '6px',
            animationName: active ? 'waveform' : 'none',
            animationDuration: `${0.8 + (i % 4) * 0.15}s`,
            animationDelay: `${i * 0.05}s`,
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
          }}
        />
      ))}
    </div>
  );
}

const VOICE_STATES = [
  {
    id: 'idle',
    label: 'Idle',
    description: 'Ready to listen',
    color: '#5A6180',
    dotColor: '#5A6180',
    ring: 'border-[#2D3560]',
    core: 'bg-[#171C2F]',
  },
  {
    id: 'listening',
    label: 'Listening',
    description: 'Speak now…',
    color: '#7191FF',
    dotColor: '#7191FF',
    ring: 'border-[#7191FF]',
    core: 'bg-[#1A2050]',
    glow: 'shadow-[0_0_30px_rgba(113,145,255,0.35)]',
  },
  {
    id: 'processing',
    label: 'Thinking',
    description: 'Understanding context',
    color: '#A8B7FF',
    dotColor: '#A8B7FF',
    ring: 'border-[#A8B7FF]',
    core: 'bg-[#1A1E40]',
  },
  {
    id: 'speaking',
    label: 'Speaking',
    description: 'Responding…',
    color: '#9B8CFF',
    dotColor: '#9B8CFF',
    ring: 'border-[#9B8CFF]',
    core: 'bg-[#1E1A40]',
    glow: 'shadow-[0_0_30px_rgba(155,140,255,0.35)]',
  },
];

export default function VoiceSection() {
  return (
    <section
      id="voice"
      className="py-24 md:py-32 relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #080B18 0%, #0D1230 50%, #080B18 100%)' }}
    >
      {/* Glow orb */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(113,145,255,0.05) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — voice orb UI mockup */}
          <AnimatedReveal direction="left">
            <GlassCard padding="p-8 md:p-10" className="relative overflow-hidden">
              {/* Background glow */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 50% 40%, rgba(113,145,255,0.06) 0%, transparent 60%)' }}
              />

              <div className="relative z-10 flex flex-col items-center gap-8">
                {/* Main orb */}
                <div className="relative">
                  {/* Outer pulse ring */}
                  <div
                    className="absolute inset-0 rounded-full animate-pulse"
                    style={{
                      border: '1px solid rgba(113,145,255,0.2)',
                      margin: '-16px',
                    }}
                  />
                  <div
                    className="w-28 h-28 rounded-full border-2 border-[#7191FF] flex items-center justify-center animate-pulse-glow"
                    style={{ background: 'radial-gradient(circle, rgba(113,145,255,0.2), rgba(16,20,38,0.95))' }}
                  >
                    <div className="w-16 h-16 rounded-full bg-[rgba(113,145,255,0.15)] flex items-center justify-center">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#A8B7FF" strokeWidth="1.8">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Waveform */}
                <div className="flex flex-col items-center gap-2">
                  <Waveform active={true} bars={18} />
                  <p className="text-xs text-[#7191FF] font-medium tracking-wider animate-pulse">
                    LISTENING — SPEAK NOW
                  </p>
                </div>

                {/* State indicators */}
                <div className="grid grid-cols-2 gap-3 w-full">
                  {VOICE_STATES.map((state) => (
                    <div
                      key={state.id}
                      className={`glass rounded-xl px-3 py-2.5 flex items-center gap-2.5 border transition-all ${state.id === 'listening'
                          ? 'border-[rgba(113,145,255,0.4)] bg-[rgba(113,145,255,0.08)]'
                          : 'border-[rgba(180,195,255,0.1)]'
                        }`}
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          background: state.dotColor,
                          boxShadow: state.id === 'listening' ? `0 0 8px ${state.dotColor}` : 'none',
                        }}
                      />
                      <div>
                        <p className="text-xs font-semibold" style={{ color: state.color }}>{state.label}</p>
                        <p className="text-[10px] text-[#5A6180]">{state.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <Link
                  to="/dashboard"
                  id="voice-section-cta"
                  className="px-6 py-3 text-sm font-semibold font-display text-white rounded-xl bg-[#7191FF] hover:bg-[#8BA5FF] hover:shadow-[0_0_25px_rgba(113,145,255,0.5)] transition-all duration-200 btn-glow flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  </svg>
                  Talk to Vexora
                </Link>
              </div>
            </GlassCard>
          </AnimatedReveal>

          {/* Right — text */}
          <AnimatedReveal direction="right">
            <div className="flex flex-col gap-6">
              <SectionHeading
                label="Voice-First Experience"
                title="Just Speak. Vexora Handles the Rest."
                subtitle="Powered by AssemblyAI's real-time voice technology, Vexora understands natural speech with sub-100ms latency. No wake words. No button holding. Just talk."
                align="left"
              />
              <div className="flex flex-col gap-3 mt-2">
                {[
                  'Real-time voice transcription',
                  'Natural language understanding',
                  'Instant spoken responses',
                  'Barge-in interruption support',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[rgba(113,145,255,0.2)] flex items-center justify-center shrink-0">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7191FF" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-[#A7AEC4] text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedReveal>
        </div>
      </div>
    </section>
  );
}
