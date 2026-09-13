import { useEffect } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
        <h1 className="mb-2 text-2xl font-semibold">Sign in to VERA</h1>
        <p className="mb-6 text-sm text-slate-400">
          Your accessible AI assistant — voice, maps, and diagrams, all in one place.
        </p>
        {error && (
          <p className="mb-4 rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">
            Sign-in failed. Please try again.
          </p>
        )}
        <button
          onClick={loginWithGoogle}
          className="w-full rounded-lg bg-white px-4 py-2.5 font-medium text-slate-900 transition hover:bg-slate-200"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}
