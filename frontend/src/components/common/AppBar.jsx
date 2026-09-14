import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * AppBar — Universal top navigation for all authenticated pages.
 * Shows: Logo → Home | Chat | Business  +  breadcrumb  +  user dropdown
 * Appears on Dashboard, Business pages, Subscribe, Onboarding, etc.
 */
export default function AppBar({ title, subtitle, backTo, backLabel }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const userInitials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  // Detect active section for nav highlights
  const isBusiness = location.pathname.startsWith('/business');
  const isDashboard = location.pathname === '/dashboard';
  const isSubscribe = location.pathname === '/subscribe';

  const navItemStyle = (active) => ({
    padding: '5px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: active ? '600' : '400',
    color: active ? '#A8B7FF' : '#A7AEC4',
    background: active ? 'rgba(113,145,255,0.1)' : 'transparent',
    border: active ? '1px solid rgba(113,145,255,0.2)' : '1px solid transparent',
    textDecoration: 'none',
    transition: 'all 0.15s',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  return (
    <div
      style={{
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid rgba(180,195,255,0.08)',
        background: 'rgba(8,11,24,0.9)',
        backdropFilter: 'blur(16px)',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 20,
        gap: '12px',
      }}
    >
      {/* ── Left: Logo + breadcrumb ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: '1' }}>
        {/* Logo */}
        <Link
          to="/"
          id="appbar-home-logo"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          <div style={{
            width: '24px', height: '24px', borderRadius: '7px', overflow: 'hidden',
            boxShadow: '0 0 8px rgba(113,145,255,0.4)',
            border: '1px solid rgba(168,183,255,0.2)',
            flexShrink: 0,
          }}>
            <img src="/vexora-avatar.jpg" alt="Vexora" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '14px',
            color: '#fff',
            letterSpacing: '-0.02em',
            display: 'none',
          }}
            className="sm:!inline"
          >
            VEXORA
          </span>
        </Link>

        {/* Divider */}
        <span style={{ color: 'rgba(180,195,255,0.2)', fontSize: '16px', flexShrink: 0 }}>›</span>

        {/* Back link if provided */}
        {backTo && backLabel && (
          <>
            <Link
              to={backTo}
              id="appbar-back-link"
              style={navItemStyle(false)}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#DCE5FF'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#A7AEC4'; e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              {backLabel}
            </Link>
            <span style={{ color: 'rgba(180,195,255,0.2)', fontSize: '16px', flexShrink: 0 }}>›</span>
          </>
        )}

        {/* Page title / current location */}
        {title && (
          <span style={{
            fontSize: '13px',
            fontWeight: '500',
            color: '#DCE5FF',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {title}
          </span>
        )}
      </div>

      {/* ── Center: Nav links (desktop) ── */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }} className="hidden md:flex">
        <Link
          to="/"
          id="appbar-landing-link"
          style={navItemStyle(false)}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#DCE5FF'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#A7AEC4';
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.border = '1px solid transparent';
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Home
        </Link>

        <Link
          to="/dashboard"
          id="appbar-chat-link"
          style={navItemStyle(isDashboard)}
          onMouseEnter={(e) => {
            if (!isDashboard) { e.currentTarget.style.color = '#DCE5FF'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }
          }}
          onMouseLeave={(e) => {
            if (!isDashboard) { e.currentTarget.style.color = '#A7AEC4'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.border = '1px solid transparent'; }
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Chat
        </Link>

        {user?.plan === 'business' ? (
          <Link
            to="/business/overview"
            id="appbar-business-link"
            style={navItemStyle(isBusiness)}
            onMouseEnter={(e) => {
              if (!isBusiness) { e.currentTarget.style.color = '#DCE5FF'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }
            }}
            onMouseLeave={(e) => {
              if (!isBusiness) { e.currentTarget.style.color = '#A7AEC4'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.border = '1px solid transparent'; }
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Business
          </Link>
        ) : (
          <Link
            to="/subscribe"
            id="appbar-upgrade-link"
            style={navItemStyle(isSubscribe)}
            onMouseEnter={(e) => {
              if (!isSubscribe) { e.currentTarget.style.color = '#DCE5FF'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }
            }}
            onMouseLeave={(e) => {
              if (!isSubscribe) { e.currentTarget.style.color = '#A7AEC4'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.border = '1px solid transparent'; }
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Upgrade
          </Link>
        )}
      </nav>

      {/* ── Right: User dropdown ── */}
      <div style={{ flexShrink: 0, position: 'relative' }} ref={dropdownRef}>
        <button
          id="appbar-user-btn"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            padding: '4px 10px 4px 6px',
            borderRadius: '10px',
            background: dropdownOpen ? 'rgba(113,145,255,0.12)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${dropdownOpen ? 'rgba(113,145,255,0.3)' : 'rgba(180,195,255,0.1)'}`,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <div style={{
            width: '24px', height: '24px', borderRadius: '7px',
            background: 'linear-gradient(135deg, #7191FF, #9B8CFF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {userInitials}
          </div>
          <span style={{ fontSize: '12px', color: '#DCE5FF', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            className="hidden sm:inline"
          >
            {user?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'User'}
          </span>
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#A7AEC4" strokeWidth="2"
            style={{ transition: 'transform 0.2s', transform: dropdownOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {dropdownOpen && (
          <div style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: '220px',
            background: 'rgba(16,20,38,0.97)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(180,195,255,0.15)',
            borderRadius: '16px',
            boxShadow: '0 16px 50px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            zIndex: 100,
            animation: 'fade-up 0.15s ease-out forwards',
          }}>
            {/* User info */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(180,195,255,0.08)' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#DCE5FF', marginBottom: '2px' }}>
                {user?.name ?? 'User'}
              </p>
              <p style={{ fontSize: '11px', color: '#5A6180', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </p>
              {user?.plan === 'business' && (
                <span style={{
                  display: 'inline-block', marginTop: '6px',
                  fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                  color: '#7191FF', padding: '2px 8px', borderRadius: '20px',
                  background: 'rgba(113,145,255,0.15)', border: '1px solid rgba(113,145,255,0.25)',
                }}>Business</span>
              )}
            </div>

            {/* Nav links */}
            <div style={{ padding: '8px' }}>
              {[
                { to: '/', label: 'Landing Page', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
                { to: '/dashboard', label: 'Chat Dashboard', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg> },
                ...(user?.plan === 'business' ? [{ to: '/business/overview', label: 'Business Dashboard', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg> }] : [{ to: '/subscribe', label: 'Upgrade to Business', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg> }]),
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  id={`appbar-dropdown-${item.to.replace(/\//g, '-')}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '9px',
                    padding: '9px 10px', borderRadius: '10px',
                    fontSize: '13px', color: '#A7AEC4', textDecoration: 'none',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#DCE5FF'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#A7AEC4'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ color: '#5A6180', flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                </Link>
              ))}

              <div style={{ height: '1px', background: 'rgba(180,195,255,0.06)', margin: '6px 0' }} />

              {/* Sign out */}
              <button
                id="appbar-signout-btn"
                onClick={handleLogout}
                style={{
                  display: 'flex', alignItems: 'center', gap: '9px', width: '100%',
                  padding: '9px 10px', borderRadius: '10px',
                  fontSize: '13px', color: '#EF4444', textAlign: 'left',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#F87171'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#EF4444'; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
