import { Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import BusinessSidebar from '../components/business/BusinessSidebar';
import LoadingIndicator from '../components/common/LoadingIndicator';

const MOBILE_NAV_ITEMS = [
  { to: '/business/overview', label: 'Overview' },
  { to: '/business/knowledge-base', label: 'Knowledge Base' },
  { to: '/business/conversations', label: 'Conversations' },
  { to: '/business/email', label: 'Email Integration' },
  { to: '/business/customize', label: 'Customize Assistant' },
  { to: '/business/embed', label: 'Website Embed' },
  { to: '/business/subscription', label: 'Subscription' },
  { to: '/business/settings', label: 'Settings' },
];

export default function BusinessLayout() {
  const { user } = useAuth();
  const { business, isLoading, error } = useBusiness();
  const navigate = useNavigate();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingIndicator label="Loading your workspace…" />
      </div>
    );
  }

  if (user?.plan !== 'business') {
    return <Navigate to="/subscribe" replace />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-xs text-slate-400 hover:text-slate-200 underline"
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <BusinessSidebar businessName={business?.name} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile nav */}
        <div className="md:hidden border-b border-slate-800/70 px-4 py-3 flex items-center gap-3">
          <select
            value={location.pathname}
            onChange={(e) => navigate(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700/60 rounded-lg text-sm text-slate-200 px-3 py-2"
            aria-label="Business dashboard navigation"
          >
            {MOBILE_NAV_ITEMS.map((item) => (
              <option key={item.to} value={item.to}>
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
