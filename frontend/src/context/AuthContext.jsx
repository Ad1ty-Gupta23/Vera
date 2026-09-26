import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import API_BASE from '../services/api';
import { subscribeToSessionExpiry } from '../services/apiResponse';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = not checked yet, null = checked and logged out, object = logged in
  const [user, setUser] = useState(undefined);
  const [sessionExpired, setSessionExpired] = useState(false);
  const requestVersion = useRef(0);

  useEffect(() => subscribeToSessionExpiry(() => {
    // Do not let an older /auth/me response restore a rejected session.
    requestVersion.current += 1;
    setSessionExpired(true);
    setUser(null);
  }), []);

  const refreshUser = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
      if (!res.ok) {
        if (version === requestVersion.current) setUser(null);
        return;
      }
      const currentUser = await res.json();
      if (version !== requestVersion.current) return;
      setSessionExpired(false);
      setUser(currentUser);
    } catch {
      // Backend unreachable — treat as logged out rather than hanging on
      // "checking" forever.
      if (version === requestVersion.current) setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser();
    return () => { requestVersion.current += 1; };
  }, [refreshUser]);

  const loginWithGoogle = () => {
    // Full-page redirect — the backend owns the whole OAuth dance and the
    // client secret never touches this code.
    window.location.href = `${API_BASE}/auth/google`;
  };

  const logout = async () => {
    requestVersion.current += 1;
    try {
      // Use redirect:'manual' so fetch() doesn't silently follow any
      // redirect the server might return, which can cause CORS errors.
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        redirect: 'manual',
      });
    } catch {
      // Network error or CORS block — the server still deleted the cookie
      // for any request that reached it. We always clear local state.
    } finally {
      // Always clear the local auth state regardless of network outcome.
      setSessionExpired(false);
      setUser(null);
    }
  };

  const value = {
    user,
    isLoading: user === undefined,
    isAuthenticated: Boolean(user),
    sessionExpired,
    loginWithGoogle,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
