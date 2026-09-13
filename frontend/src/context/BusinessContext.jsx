import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  listBusinesses,
  createBusiness as apiCreateBusiness,
  updateBusiness as apiUpdateBusiness,
  getSubscription,
} from '../services/business';

const BusinessContext = createContext(null);

export function BusinessProvider({ children }) {
  const { user, refreshUser } = useAuth();

  // undefined = not loaded yet, null = loaded and none exist, object = loaded
  const [business, setBusiness] = useState(undefined);
  const [subscription, setSubscription] = useState(undefined);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [businesses, sub] = await Promise.all([listBusinesses(), getSubscription()]);
      setBusiness(businesses && businesses.length > 0 ? businesses[0] : null);
      setSubscription(sub);
    } catch (err) {
      setError(err.message || 'Failed to load business data.');
      setBusiness(null);
      setSubscription(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createBusiness = useCallback(
    async (payload) => {
      const created = await apiCreateBusiness(payload);
      setBusiness(created);
      return created;
    },
    []
  );

  const updateBusiness = useCallback(
    async (payload) => {
      if (!business) throw new Error('No business workspace to update.');
      const updated = await apiUpdateBusiness(business.id, payload);
      setBusiness(updated);
      return updated;
    },
    [business]
  );

  const value = {
    business,
    subscription,
    plan: user?.plan,
    isLoading: business === undefined || subscription === undefined,
    error,
    refresh,
    createBusiness,
    updateBusiness,
    refreshUser,
  };

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error('useBusiness must be used within a BusinessProvider');
  return ctx;
}
