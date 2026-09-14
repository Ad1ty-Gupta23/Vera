import AnimatedReveal from '../common/AnimatedReveal';
import SectionHeading from '../common/SectionHeading';
import GlassCard from '../common/GlassCard';

/* A simplified visual workflow node */
function WorkflowNode({ icon, label, sublabel, color, isActive = false }) {
  return (
    <div
      className={`glass rounded-2xl px-4 py-3 flex items-center gap-3 border transition-all duration-300 ${isActive
          ? 'border-[rgba(113,145,255,0.5)] bg-[rgba(113,145,255,0.08)] shadow-[0_0_20px_rgba(113,145,255,0.15)]'
          : 'border-[rgba(180,195,255,0.12)]'
        }`}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `rgba(${hexToRgb(color)}, 0.18)`, color }}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        {sublabel && <p className="text-[11px] text-[#5A6180]">{sublabel}</p>}
      </div>
    </div>
  );
}

function ArrowDown() {
  return (
    <div className="flex justify-start pl-[22px]">
      <div className="flex flex-col items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-px h-3 rounded-full"
            style={{ background: `rgba(113,145,255,${0.6 - i * 0.15})` }}
          />
        ))}
        <svg width="8" height="6" viewBox="0 0 8 6" fill="#7191FF" style={{ opacity: 0.7 }}>
          <path d="M0 0L4 6L8 0H0Z" />
        </svg>
      </div>
    </div>
  );
}

const WORKFLOW_STEPS = [
  {
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
    label: 'User Request',
    sublabel: '"Find nearby hospitals"',
    color: '#DCE5FF',
  },
  {
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
    label: 'Understand Intent',
    sublabel: 'Context analysis',
    color: '#A8B7FF',
    isActive: true,
  },
  {
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>,
    label: 'Use Location Tool',
    sublabel: 'Fetching nearby results',
    color: '#7191FF',
    isActive: true,
  },
  {
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
    label: 'Generate Answer',
    sublabel: 'With map visualization',
    color: '#9B8CFF',
  },
];

export default function WorkflowSection() {
  return (
    <section
      id="workflows"
      className="py-24 md:py-32 relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0D1230 0%, #101426 100%)' }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left text */}
          <AnimatedReveal direction="left">
            <div className="flex flex-col gap-6">
              <SectionHeading
                label="Visual Workflow Intelligence"
                title="See How Vexora Thinks"
                subtitle="Every action Vexora takes is transparent. Watch live as it analyzes your request, selects the right tools, and builds its response — step by step."
                align="left"
              />
              <div className="flex flex-col gap-3 mt-2">
                {[
                  'Real-time reasoning visualization',
                  'Tool and action transparency',
                  'Knowledge retrieval from ChromaDB',
                  'Multi-step agent workflows',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[rgba(155,140,255,0.2)] flex items-center justify-center shrink-0">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9B8CFF" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-[#A7AEC4] text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedReveal>

          {/* Right — workflow diagram */}
          <AnimatedReveal direction="right">
            <GlassCard padding="p-6" className="relative">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-widest text-[#5A6180] font-semibold">Live Reasoning</p>
                <div className="flex gap-1">
                  {['#FF6B6B', '#FFE66D', '#6BCB77'].map((c) => (
                    <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.7 }} />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {WORKFLOW_STEPS.map((step, i) => (
                  <div key={step.label}>
                    <WorkflowNode {...step} />
                    {i < WORKFLOW_STEPS.length - 1 && <ArrowDown />}
                  </div>
                ))}
              </div>
              {/* "Generating" badge */}
              <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-[rgba(113,145,255,0.1)] border border-[rgba(113,145,255,0.2)]">
                <div className="w-2 h-2 rounded-full bg-[#7191FF] animate-pulse" />
                <span className="text-xs text-[#A8B7FF] font-medium">Generating visual workflow…</span>
              </div>
            </GlassCard>
          </AnimatedReveal>
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
