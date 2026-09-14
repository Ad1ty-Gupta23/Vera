import AnimatedReveal from '../common/AnimatedReveal';
import GlassCard from '../common/GlassCard';
import SectionHeading from '../common/SectionHeading';

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
    color: '#7191FF',
    label: 'Voice Conversations',
    description: 'Talk naturally in real-time. Vexora listens, understands context, and responds instantly with human-like voice.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    color: '#9B8CFF',
    label: 'AI Chat',
    description: 'Type or speak — Vexora understands both. Context-aware conversations that remember what matters.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polygon points="3 11 22 2 13 21 11 13 3 11" />
      </svg>
    ),
    color: '#A8B7FF',
    label: 'Live Maps',
    description: 'Ask about nearby places and get real-time interactive maps with category filters and detailed recommendations.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="3" width="7" height="7" rx="1" /><rect x="15" y="3" width="7" height="7" rx="1" />
        <rect x="2" y="14" width="7" height="7" rx="1" /><rect x="15" y="14" width="7" height="7" rx="1" />
        <line x1="9" y1="6.5" x2="15" y2="6.5" /><line x1="9" y1="17.5" x2="15" y2="17.5" />
        <line x1="6.5" y1="10" x2="6.5" y2="14" /><line x1="17.5" y1="10" x2="17.5" y2="14" />
      </svg>
    ),
    color: '#7191FF',
    label: 'Visual Workflows',
    description: 'See Vexora\'s reasoning as a live interactive diagram. Complex decisions made visual and understandable.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
    color: '#9B8CFF',
    label: 'Gmail Automation',
    description: 'Draft and send emails from your Gmail with a single voice command. Your data stays secure with Google OAuth.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    color: '#A8B7FF',
    label: 'Business AI Agents',
    description: 'Deploy a custom AI trained on your knowledge base directly into your website. 24/7 intelligent support.',
  },
];

export default function FeatureCards() {
  return (
    <section
      id="features"
      className="py-24 md:py-32 relative"
      style={{ background: 'linear-gradient(180deg, #101426 0%, #080B18 100%)' }}
    >
      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(168,183,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(168,183,255,1) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 relative z-10">
        <AnimatedReveal className="mb-16">
          <SectionHeading
            label="What Vexora Can Do"
            title="Intelligence at Your Command"
            subtitle="Six powerful capabilities working together to give you an AI assistant that truly understands and acts."
            align="center"
          />
        </AnimatedReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature, i) => (
            <AnimatedReveal key={feature.label} delay={i * 80}>
              <GlassCard glow hover className="group h-full">
                <div className="flex flex-col gap-4 h-full">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                    style={{
                      background: `rgba(${hexToRgb(feature.color)}, 0.15)`,
                      color: feature.color,
                      boxShadow: `0 0 20px rgba(${hexToRgb(feature.color)}, 0.2)`,
                    }}
                  >
                    {feature.icon}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="font-display font-semibold text-white text-base">
                      {feature.label}
                    </h3>
                    <p className="text-[#A7AEC4] text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </AnimatedReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '113,145,255';
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}
