import { useEffect } from 'react';
import { useSearchParams, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageBackground from '../components/common/PageBackground';

export default function Login() {
  const { isAuthenticated, isLoading, loginWithGoogle } = useAuth();
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  useEffect(() => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[auth] Google login failed:', error);
    }
  }, [error]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080B18' }}>
        <div className="w-8 h-8 rounded-full border-2 border-[rgba(113,145,255,0.3)] border-t-[#7191FF] animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #080B18 0%, #101426 60%, #0D1230 100%)' }}
    >
      {/* Animated bubbles — same system as Landing */}
      <PageBackground intensity={1.1} />

      {/* Back to home */}
      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-[#5A6180] hover:text-[#A7AEC4] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to home
      </Link>

      <div className="relative z-10 w-full max-w-md animate-fade-up">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-[rgba(168,183,255,0.3)] shadow-[0_0_40px_rgba(113,145,255,0.3)] animate-pulse-glow">
            <img src="/vexora-avatar.jpg" alt="Vexora" className="w-full h-full object-cover" />
          </div>
          <div className="text-center">
            <h1 className="font-display font-bold text-2xl text-white tracking-tight">
              VEXORA
            </h1>
            <p className="text-[#5A6180] text-xs uppercase tracking-[0.15em] mt-0.5">
              Voice-First AI Assistant
            </p>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 border"
          style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            borderColor: 'rgba(180,195,255,0.15)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.4), 0 0 40px rgba(113,145,255,0.05)',
          }}
        >
          <div className="text-center mb-6">
            <h2 className="font-display font-semibold text-xl text-white mb-1">
              Welcome back
            </h2>
            <p className="text-[#A7AEC4] text-sm">
              Sign in to access your AI assistant
            </p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <p className="text-sm text-red-400">Sign-in failed. Please try again.</p>
            </div>
          )}

          <button
            id="login-google-btn"
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl bg-white text-slate-900 font-semibold font-display text-sm hover:bg-slate-100 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all duration-200 active:scale-[0.98]"
          >
            {/* Google logo */}
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-[rgba(180,195,255,0.08)]" />
            <p className="text-[10px] text-[#5A6180] uppercase tracking-wider">Secured by</p>
            <div className="flex-1 h-px bg-[rgba(180,195,255,0.08)]" />
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-[#5A6180]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="text-xs">Google OAuth 2.0 · No passwords stored</span>
          </div>
        </div>

        <p className="text-center text-[#2D3560] text-xs mt-6">
          By signing in, you agree to our terms and privacy policy.
        </p>
      </div>
    </div>
  );
}
