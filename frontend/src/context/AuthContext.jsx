import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import API_BASE from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = not checked yet, null = checked and logged out, object = logged in
  const [user, setUser] = useState(undefined);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
      if (!res.ok) {
        setUser(null);
        return;
      }
      setUser(await res.json());
    } catch {
      // Backend unreachable — treat as logged out rather than hanging on
      // "checking" forever.
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loginWithGoogle = () => {
    // Full-page redirect — the backend owns the whole OAuth dance and the
    // client secret never touches this code.
    window.location.href = `${API_BASE}/auth/google`;
  };

  const logout = async () => {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  const value = {
    user,
    isLoading: user === undefined,
    isAuthenticated: Boolean(user),
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
