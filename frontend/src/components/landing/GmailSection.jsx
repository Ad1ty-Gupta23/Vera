import AnimatedReveal from '../common/AnimatedReveal';
import SectionHeading from '../common/SectionHeading';
import GlassCard from '../common/GlassCard';

const OAUTH_STATES = [
  { id: 'connected', label: 'Gmail Connected', color: '#6BCB77', dot: '#6BCB77' },
  { id: 'ready', label: 'Email Ready', color: '#A8B7FF', dot: '#7191FF' },
  { id: 'sent', label: 'Email Sent', color: '#9B8CFF', dot: '#9B8CFF' },
];

export default function GmailSection() {
  return (
    <section
      id="gmail"
      className="py-24 md:py-32 relative"
      style={{ background: 'linear-gradient(180deg, #080B18 0%, #0C1020 100%)' }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left text */}
          <AnimatedReveal direction="left" className="order-2 lg:order-1">
            <div className="flex flex-col gap-6">
              <SectionHeading
                label="Gmail Automation"
                title="Send Emails by Voice Command"
                subtitle="Vexora drafts support emails, inquiry messages, and follow-ups from your Gmail account — with your explicit consent every time."
                align="left"
              />
              <div className="flex flex-col gap-3 mt-2">
                {[
                  'OAuth 2.0 secured — no stored passwords',
                  'Draft preview before sending',
                  'Your consent required for every email',
                  'Integrated with Google Workspace',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[rgba(107,203,119,0.2)] flex items-center justify-center shrink-0">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6BCB77" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-[#A7AEC4] text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedReveal>

          {/* Right — email card mockup */}
          <AnimatedReveal direction="right" className="order-1 lg:order-2">
            <GlassCard padding="p-6" className="relative">
              {/* Email compose header */}
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[rgba(180,195,255,0.1)]">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(234,67,53,0.15)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EA4335" strokeWidth="1.8">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">New Email Draft</p>
                  <p className="text-xs text-[#5A6180]">via Gmail · OAuth secured</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgba(107,203,119,0.15)] border border-[rgba(107,203,119,0.25)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#6BCB77]" />
                  <span className="text-[10px] font-semibold text-[#6BCB77]">Connected</span>
                </div>
              </div>

              {/* Email fields */}
              <div className="flex flex-col gap-3 mb-5">
                <div className="flex gap-3 items-start">
                  <span className="text-xs text-[#5A6180] w-14 pt-2 shrink-0">To</span>
                  <div className="flex-1 bg-[rgba(255,255,255,0.04)] border border-[rgba(180,195,255,0.12)] rounded-xl px-3 py-2">
                    <p className="text-sm text-[#A8B7FF]">support@acmecorp.com</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-xs text-[#5A6180] w-14 pt-2 shrink-0">Subject</span>
                  <div className="flex-1 bg-[rgba(255,255,255,0.04)] border border-[rgba(180,195,255,0.12)] rounded-xl px-3 py-2">
                    <p className="text-sm text-white">Inquiry about your services</p>
                  </div>
                </div>
                <div className="bg-[rgba(255,255,255,0.04)] border border-[rgba(180,195,255,0.12)] rounded-xl p-3">
                  <p className="text-sm text-[#A7AEC4] leading-relaxed">
                    Hello, I came across your business and would like to learn more about your offerings.
                    Could you please send me additional information? Thank you for your time.
                  </p>
                </div>
              </div>

              {/* Consent + send */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[rgba(113,145,255,0.08)] border border-[rgba(113,145,255,0.2)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7191FF" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span className="text-xs text-[#A8B7FF]">Your consent required before sending</span>
                </div>
                <button className="w-full py-2.5 rounded-xl bg-[#7191FF] text-white text-sm font-semibold font-display hover:bg-[#8BA5FF] hover:shadow-[0_0_20px_rgba(113,145,255,0.4)] transition-all btn-glow flex items-center justify-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  Send from your Gmail
                </button>
              </div>

              {/* OAuth state pills */}
              <div className="flex gap-2 mt-4 flex-wrap">
                {OAUTH_STATES.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full glass border border-[rgba(180,195,255,0.12)] text-[10px] font-medium"
                    style={{ color: s.color }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                    {s.label}
                  </div>
                ))}
              </div>
            </GlassCard>
          </AnimatedReveal>
        </div>
      </div>
    </section>
  );
}
