import AnimatedReveal from '../common/AnimatedReveal';
import SectionHeading from '../common/SectionHeading';

const STEPS = [
  {
    number: '01',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
    title: 'Speak or Type',
    description: 'Start a conversation naturally. Use your voice or keyboard — Vexora understands both.',
    color: '#7191FF',
  },
  {
    number: '02',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: 'Understands Context',
    description: 'LangGraph-powered reasoning interprets your request and determines the best course of action.',
    color: '#A8B7FF',
  },
  {
    number: '03',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
    ),
    title: 'Uses Knowledge & Tools',
    description: 'Retrieves from ChromaDB knowledge bases, calls live APIs for maps and location data.',
    color: '#9B8CFF',
  },
  {
    number: '04',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: 'Responds or Acts',
    description: 'Speaks back, displays a visual, shows a map, or takes a real-world action like sending an email.',
    color: '#DCE5FF',
  },
];

export default function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="py-24 md:py-32 relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #080B18 0%, #101426 100%)' }}
    >
      {/* Background accent */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          width: 800,
          height: 400,
          background: 'radial-gradient(ellipse, rgba(113,145,255,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 relative z-10">
        <AnimatedReveal className="mb-16">
          <SectionHeading
            label="How It Works"
            title="From Words to Action in Milliseconds"
            align="center"
          />
        </AnimatedReveal>

        {/* Steps grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Connecting line (desktop only) */}
          <div
            className="hidden lg:block absolute top-[44px] left-[12.5%] right-[12.5%] h-px pointer-events-none"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(113,145,255,0.3), rgba(155,140,255,0.3), transparent)' }}
          />

          {STEPS.map((step, i) => (
            <AnimatedReveal key={step.number} delay={i * 100}>
              <div className="flex flex-col items-center text-center gap-4">
                {/* Step icon + number */}
                <div className="relative">
                  <div
                    className="w-[88px] h-[88px] rounded-2xl glass border flex items-center justify-center transition-all duration-300 hover:scale-105"
                    style={{
                      borderColor: `rgba(${hexToRgb(step.color)}, 0.3)`,
                      color: step.color,
                      boxShadow: `0 0 30px rgba(${hexToRgb(step.color)}, 0.1)`,
                    }}
                  >
                    {step.icon}
                  </div>
                  <div
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: `rgba(${hexToRgb(step.color)}, 0.2)`,
                      color: step.color,
                      border: `1px solid rgba(${hexToRgb(step.color)}, 0.4)`,
                    }}
                  >
                    {step.number}
                  </div>
                </div>

                <div>
                  <h3 className="font-display font-semibold text-white text-base mb-1">{step.title}</h3>
                  <p className="text-[#A7AEC4] text-sm leading-relaxed">{step.description}</p>
                </div>
              </div>
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
