import { Link } from 'react-router-dom';
import AnimatedReveal from '../common/AnimatedReveal';
import SectionHeading from '../common/SectionHeading';
import GlassCard from '../common/GlassCard';

const CHAT_MESSAGES = [
  { role: 'user', text: 'What are your opening hours?' },
  { role: 'assistant', text: 'We are open Monday to Friday, 9 AM to 6 PM, and Saturday 10 AM to 4 PM. How can I help you today?' },
  { role: 'user', text: 'Do you offer free consultations?' },
  { role: 'assistant', text: 'Yes! We offer a free 30-minute consultation for all new clients. Would you like to schedule one?' },
];

export default function BusinessSection() {
  return (
    <section
      id="business"
      className="py-24 md:py-32 relative"
      style={{ background: 'linear-gradient(180deg, #101426 0%, #080B18 100%)' }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <AnimatedReveal className="mb-16">
          <SectionHeading
            label="Business AI"
            title="Your Brand, Powered by AI"
            subtitle="Create a personalized AI assistant trained on your business knowledge. Embed it directly on your website and deliver exceptional support 24/7."
            align="center"
          />
        </AnimatedReveal>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Left — Business chatbot mockup */}
          <AnimatedReveal direction="left">
            <GlassCard padding="p-0" className="overflow-hidden">
              {/* Chatbot header */}
              <div
                className="px-5 py-4 flex items-center gap-3 border-b border-[rgba(180,195,255,0.1)]"
                style={{ background: 'linear-gradient(135deg, rgba(113,145,255,0.08), rgba(155,140,255,0.05))' }}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7191FF] to-[#9B8CFF] flex items-center justify-center text-white font-bold font-display text-sm shadow-[0_0_15px_rgba(113,145,255,0.4)]">
                  AC
                </div>
                <div>
                  <p className="font-semibold font-display text-white text-sm">Acme Corp Assistant</p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <p className="text-xs text-[#A7AEC4]">Online · Powered by Vexora</p>
                  </div>
                </div>
                <button className="ml-auto w-7 h-7 rounded-lg glass text-[#5A6180] hover:text-white transition-colors flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Chat messages */}
              <div className="p-5 flex flex-col gap-3">
                {CHAT_MESSAGES.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#7191FF] to-[#9B8CFF] flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                        A
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                          ? 'bg-[rgba(113,145,255,0.2)] border border-[rgba(113,145,255,0.3)] text-[#DCE5FF] rounded-br-sm'
                          : 'glass border border-[rgba(180,195,255,0.12)] text-[#A7AEC4] rounded-bl-sm'
                        }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {/* Typing indicator */}
                <div className="flex justify-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#7191FF] to-[#9B8CFF] flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                    A
                  </div>
                  <div className="glass border border-[rgba(180,195,255,0.12)] px-3 py-3 rounded-2xl rounded-bl-sm flex gap-1">
                    {[0.2, 0.4, 0.6].map((d) => (
                      <div
                        key={d}
                        className="w-1.5 h-1.5 rounded-full bg-[#7191FF] animate-bounce"
                        style={{ animationDelay: `${d}s` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Input bar */}
                <div className="mt-2 flex gap-2">
                  <div className="flex-1 glass border border-[rgba(180,195,255,0.15)] rounded-xl px-3 py-2 text-sm text-[#5A6180]">
                    Type a message…
                  </div>
                  <button className="w-9 h-9 rounded-xl bg-[#7191FF] flex items-center justify-center text-white shrink-0 hover:bg-[#8BA5FF] transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
              </div>
            </GlassCard>
          </AnimatedReveal>

          {/* Right — feature list + CTA */}
          <AnimatedReveal direction="right">
            <div className="flex flex-col gap-6">
              {[
                {
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>,
                  title: 'Knowledge Base',
                  desc: 'Train your assistant on FAQs, product docs, policies, and more.',
                },
                {
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>,
                  title: 'Website Embed',
                  desc: 'Embed with a single script tag on any website.',
                },
                {
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
                  title: 'Email Automation',
                  desc: 'Automatically collect customer inquiries and send replies.',
                },
                {
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
                  title: 'Analytics Dashboard',
                  desc: 'Track conversations, response quality, and customer satisfaction.',
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-xl glass border border-[rgba(113,145,255,0.2)] flex items-center justify-center shrink-0 text-[#7191FF]">
                    {item.icon}
                  </div>
                  <div>
                    <p className="font-semibold font-display text-white text-sm mb-1">{item.title}</p>
                    <p className="text-[#A7AEC4] text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t border-[rgba(180,195,255,0.08)]">
                <p className="text-[#A7AEC4] text-sm mb-4">
                  "Create an AI assistant trained on your business knowledge and embedded directly into your website."
                </p>
                <Link
                  to="/subscribe"
                  id="business-section-cta"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold font-display text-white rounded-xl bg-[#7191FF] hover:bg-[#8BA5FF] hover:shadow-[0_0_25px_rgba(113,145,255,0.4)] transition-all duration-200 btn-glow"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Create Business Agent
                </Link>
              </div>
            </div>
          </AnimatedReveal>
        </div>
      </div>
    </section>
  );
}
