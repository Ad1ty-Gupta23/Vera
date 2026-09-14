import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import RobotAvatar from './RobotAvatar';

const NAV_LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#business', label: 'Business AI' },
];

export default function Navbar() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close mobile on route change
  useEffect(() => {
    setMobileOpen(false);
    setDropdownOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'glass border-b border-[rgba(180,195,255,0.12)] shadow-[0_4px_30px_rgba(0,0,0,0.3)]'
          : 'bg-transparent'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" id="nav-logo" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-8 h-8 rounded-xl overflow-hidden ring-1 ring-[rgba(168,183,255,0.3)] group-hover:ring-[rgba(168,183,255,0.6)] transition-all duration-200 shadow-[0_0_12px_rgba(113,145,255,0.3)]">
            <img src="/vexora-avatar.jpg" alt="Vexora" className="w-full h-full object-cover" />
          </div>
          <span className="font-display font-bold text-lg text-white tracking-tight">
            VEXORA
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#A7AEC4] hover:text-white hover:bg-white/5 transition-all duration-200"
            >
              {link.label}
            </a>
          ))}
          {isAuthenticated && (
            <Link
              to="/dashboard"
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#A7AEC4] hover:text-white hover:bg-white/5 transition-all duration-200"
            >
              Dashboard
            </Link>
          )}
        </div>

        {/* Auth area */}
        <div className="hidden md:flex items-center gap-3">
          {isLoading ? (
            <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />
          ) : isAuthenticated ? (
            /* Logged-in user dropdown */
            <div className="relative" ref={dropdownRef}>
              <button
                id="nav-user-menu"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-haspopup="true"
                aria-expanded={dropdownOpen}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl glass hover:bg-white/10 transition-all duration-200 group"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7191FF] to-[#9B8CFF] flex items-center justify-center text-xs font-bold text-white">
                  {initials}
                </div>
                <span className="text-sm text-[#DCE5FF] max-w-[120px] truncate">
                  {user?.name ?? user?.email}
                </span>
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" className={`text-[#A7AEC4] transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 glass rounded-2xl shadow-xl border border-[rgba(180,195,255,0.18)] overflow-hidden animate-scale-in">
                  <div className="px-4 py-3 border-b border-[rgba(180,195,255,0.1)]">
                    <p className="text-xs text-[#A7AEC4] truncate">{user?.email}</p>
                    {user?.plan === 'business' && (
                      <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wider text-[#7191FF] px-2 py-0.5 rounded-full bg-[rgba(113,145,255,0.15)] border border-[rgba(113,145,255,0.25)]">
                        Business
                      </span>
                    )}
                  </div>
                  <div className="p-2 flex flex-col gap-1">
                    <Link
                      to="/dashboard"
                      id="nav-dashboard-link"
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[#DCE5FF] hover:bg-white/10 transition-all"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                      </svg>
                      Dashboard
                    </Link>
                    {user?.plan === 'business' && (
                      <Link
                        to="/business/overview"
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[#DCE5FF] hover:bg-white/10 transition-all"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                          <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        Business
                      </Link>
                    )}
                    <button
                      id="nav-signout-btn"
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all w-full text-left"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
          ) : (
            /* Logged-out buttons */
            <>
              <Link
                to="/login"
                id="nav-signin-btn"
                className="px-4 py-2 text-sm font-medium text-[#A7AEC4] hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/login"
                id="nav-get-started-btn"
                className="px-5 py-2 text-sm font-semibold font-display text-white rounded-xl bg-[#7191FF] hover:bg-[#8BA5FF] hover:shadow-[0_0_20px_rgba(113,145,255,0.4)] transition-all duration-200 btn-glow"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          id="nav-mobile-menu-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle mobile menu"
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg glass text-[#A7AEC4] hover:text-white transition-all"
        >
          {mobileOpen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden glass border-t border-[rgba(180,195,255,0.12)] px-4 py-4 flex flex-col gap-2 animate-fade-up">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="px-4 py-3 rounded-xl text-sm font-medium text-[#A7AEC4] hover:text-white hover:bg-white/5 transition-all"
            >
              {link.label}
            </a>
          ))}
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="px-4 py-3 rounded-xl text-sm font-medium text-[#DCE5FF] hover:bg-white/5 transition-all"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                id="mobile-signout-btn"
                className="px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 text-left transition-all"
              >
                Sign Out
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2 pt-2 border-t border-[rgba(180,195,255,0.1)]">
              <Link
                to="/login"
                className="px-4 py-3 rounded-xl text-sm font-medium text-[#A7AEC4] hover:text-white hover:bg-white/5 transition-all text-center"
              >
                Sign In
              </Link>
              <Link
                to="/login"
                className="px-4 py-3 rounded-xl text-sm font-semibold font-display text-white bg-[#7191FF] hover:bg-[#8BA5FF] transition-all text-center"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
