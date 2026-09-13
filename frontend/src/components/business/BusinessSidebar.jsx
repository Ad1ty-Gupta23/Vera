import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/business/overview', label: 'Overview' },
  { to: '/business/knowledge-base', label: 'Knowledge Base' },
  { to: '/business/conversations', label: 'Conversations' },
  { to: '/business/email', label: 'Email Integration' },
  { to: '/business/customize', label: 'Customize Assistant' },
  { to: '/business/embed', label: 'Website Embed' },
  { to: '/business/subscription', label: 'Subscription' },
  { to: '/business/settings', label: 'Settings' },
];

export default function BusinessSidebar({ businessName }) {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-slate-800/70 bg-slate-950 py-5">
      <div className="px-5 mb-6">
        <p className="text-[10px] uppercase tracking-wider text-slate-600">Business</p>
        <h2 className="text-sm font-semibold text-slate-100 truncate mt-0.5">
          {businessName || 'Your workspace'}
        </h2>
      </div>
      <nav className="flex-1 px-3 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm transition-all ${
                isActive
                  ? 'bg-violet-600/15 text-violet-300 border border-violet-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 pt-4 border-t border-slate-800/70">
        <NavLink to="/dashboard" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
          ← Back to free chatbot
        </NavLink>
      </div>
    </aside>
  );
}
