import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  {
    to: '/business/overview',
    label: 'Overview',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="7" height="7" /><rect x="15" y="3" width="7" height="7" /><rect x="15" y="14" width="7" height="7" /><rect x="2" y="14" width="7" height="7" /></svg>,
  },
  {
    to: '/business/knowledge-base',
    label: 'Knowledge Base',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>,
  },
  {
    to: '/business/conversations',
    label: 'Conversations',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  },
  {
    to: '/business/actions',
    label: 'Action Center',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
  },
  {
    to: '/business/email',
    label: 'Email Integration',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
  },
  {
    to: '/business/customize',
    label: 'Customize',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" /></svg>,
  },
  {
    to: '/business/embed',
    label: 'Website Embed',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>,
  },
  {
    to: '/business/subscription',
    label: 'Subscription',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  },
  {
    to: '/business/settings',
    label: 'Settings',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  },
];

export default function BusinessSidebar({ businessName }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const userInitials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <aside
      className="hidden md:flex w-64 shrink-0 flex-col h-full"
      style={{
        background: 'rgba(8,11,24,0.92)',
        backdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(113,145,255,0.15)',
        boxShadow: '4px 0 40px rgba(0,0,0,0.4), inset -1px 0 0 rgba(113,145,255,0.08)',
        position: 'relative',
      }}
    >
      {/* Inner top ambient glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '200px',
          background: 'radial-gradient(ellipse at 50% -20%, rgba(113,145,255,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      {/* Logo header */}
      <div
        className="flex items-center gap-3 px-5 py-4 shrink-0"
        style={{
          borderBottom: '1px solid rgba(180,195,255,0.08)',
          background: 'linear-gradient(180deg, rgba(113,145,255,0.06) 0%, transparent 100%)',
          position: 'relative', zIndex: 1,
        }}
      >
        <div
          className="w-8 h-8 rounded-xl overflow-hidden"
          style={{
            boxShadow: '0 0 16px rgba(113,145,255,0.45), 0 0 40px rgba(113,145,255,0.15)',
            border: '1px solid rgba(168,183,255,0.25)',
          }}
        >
          <img src="/vexora-avatar.jpg" alt="Vexora" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-bold text-white tracking-tight truncate"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {businessName || 'Your Workspace'}
          </p>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: '#5A6180' }}>Business Dashboard</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto" style={{ position: 'relative', zIndex: 1 }}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${isActive
                ? 'text-[#A8B7FF] font-medium'
                : 'text-[#A7AEC4] hover:text-[#DCE5FF]'
              }`
            }
            style={({ isActive }) => ({
              background: isActive ? 'rgba(113,145,255,0.14)' : 'transparent',
              border: isActive ? '1px solid rgba(113,145,255,0.25)' : '1px solid transparent',
              boxShadow: isActive ? '0 0 20px rgba(113,145,255,0.08), inset 0 1px 0 rgba(168,183,255,0.1)' : 'none',
            })}
          >
            <span className="shrink-0">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div
        className="px-3 py-4 shrink-0 flex flex-col gap-2"
        style={{
          borderTop: '1px solid rgba(180,195,255,0.08)',
          background: 'linear-gradient(0deg, rgba(113,145,255,0.04) 0%, transparent 100%)',
          position: 'relative', zIndex: 1,
        }}
      >
        {/* Back to chat */}
        <NavLink
          to="/dashboard"
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all duration-150"
          style={{ color: '#5A6180' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#A7AEC4'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#5A6180'; e.currentTarget.style.background = 'transparent'; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Chat
        </NavLink>

        {/* User info */}
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(180,195,255,0.08)',
            boxShadow: 'inset 0 1px 0 rgba(168,183,255,0.06)',
          }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
            style={{
              background: 'linear-gradient(135deg, #7191FF, #9B8CFF)',
              boxShadow: '0 0 12px rgba(113,145,255,0.4)',
            }}
          >
            {userInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#DCE5FF] truncate">{user?.name ?? 'User'}</p>
            <p className="text-[10px] truncate" style={{ color: '#5A6180' }}>{user?.email}</p>
          </div>
        </div>

        {/* Sign out */}
        <button
          id="business-signout-btn"
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150 w-full text-left"
          style={{ color: '#EF4444' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
