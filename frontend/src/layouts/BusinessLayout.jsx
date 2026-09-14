import { Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import BusinessSidebar from '../components/business/BusinessSidebar';
import LoadingIndicator from '../components/common/LoadingIndicator';
import AppBar from '../components/common/AppBar';
import PageBackground from '../components/common/PageBackground';

const MOBILE_NAV_ITEMS = [
  { to: '/business/overview', label: 'Overview' },
  { to: '/business/knowledge-base', label: 'Knowledge Base' },
  { to: '/business/conversations', label: 'Conversations' },
  { to: '/business/actions', label: 'Action Center' },
  { to: '/business/email', label: 'Email Integration' },
  { to: '/business/customize', label: 'Customize Assistant' },
  { to: '/business/embed', label: 'Website Embed' },
  { to: '/business/subscription', label: 'Subscription' },
  { to: '/business/settings', label: 'Settings' },
];

// Map a pathname to a human-readable title for the AppBar breadcrumb
function getPageTitle(pathname) {
  const found = MOBILE_NAV_ITEMS.find((item) => pathname.startsWith(item.to));
  return found?.label ?? 'Business';
}

export default function BusinessLayout() {
  const { user } = useAuth();
  const { business, isLoading, error } = useBusiness();
  const navigate = useNavigate();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#080B18' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 0 20px rgba(113,145,255,0.4)', border: '1px solid rgba(168,183,255,0.25)' }}
          >
            <img src="/vexora-avatar.jpg" alt="Vexora" className="w-full h-full object-cover" />
          </div>
          <LoadingIndicator label="Loading your workspace…" />
        </div>
      </div>
    );
  }

  if (user?.plan !== 'business') {
    return <Navigate to="/subscribe" replace />;
  }

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: '#080B18', color: '#DCE5FF' }}
      >
        <div className="max-w-sm text-center">
          <div
            className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs px-4 py-2 rounded-xl transition-all"
            style={{ color: '#A7AEC4', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(180,195,255,0.1)' }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (business === null) {
    return <Navigate to="/business/onboarding" replace />;
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ background: '#080B18', color: '#DCE5FF', fontFamily: "'Inter', system-ui, sans-serif", position: 'relative' }}
    >
      {/* ── Animated bubble / orb background (shared with landing) ── */}
      <PageBackground intensity={0.85} />

      {/* Sidebar with 3-D edge glow */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        <BusinessSidebar businessName={business?.name} />
      </div>

      {/* Main content column */}
      <div className="flex-1 flex flex-col min-w-0" style={{ position: 'relative', zIndex: 1 }}>
        {/* Universal navigation bar (desktop + mobile) */}
        <AppBar
          title={getPageTitle(location.pathname)}
          backTo="/dashboard"
          backLabel="Chat"
        />

        {/* Mobile section selector */}
        <div
          className="md:hidden px-3 py-2 flex items-center gap-2"
          style={{ borderBottom: '1px solid rgba(180,195,255,0.06)', background: 'rgba(8,11,24,0.7)', backdropFilter: 'blur(12px)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5A6180" strokeWidth="2" style={{ flexShrink: 0 }}>
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
          <select
            value={location.pathname}
            onChange={(e) => navigate(e.target.value)}
            className="flex-1 rounded-lg px-2 py-1.5 text-xs focus:outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(180,195,255,0.1)',
              color: '#DCE5FF',
            }}
            aria-label="Business dashboard section"
          >
            {MOBILE_NAV_ITEMS.map((item) => (
              <option key={item.to} value={item.to} style={{ background: '#101426' }}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <main className="flex-1 min-h-0 overflow-y-auto px-5 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
