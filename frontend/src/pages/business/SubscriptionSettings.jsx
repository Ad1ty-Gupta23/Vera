import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import { useToast } from '../../context/ToastContext';
import { selectPlan } from '../../services/business';

export default function SubscriptionSettings() {
  const { user, refreshUser } = useAuth();
  const { subscription, refresh } = useBusiness();
  const toast = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const handleDowngrade = async () => {
    setSubmitting(true);
    try {
      await selectPlan('free');
      await refreshUser();
      await refresh();
      toast.success('Switched to the Free plan.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Could not update your plan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold text-slate-100">Subscription</h1>
      <p className="text-sm text-slate-500 mt-1">
        Manage your plan. Real payment collection isn't wired up yet — see the note below.
      </p>

      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Current plan</p>
            <p className="text-lg font-medium text-slate-100 mt-0.5 capitalize">
              {user?.plan || 'free'}
            </p>
          </div>
          <span className="text-xs rounded-full border border-emerald-800 bg-emerald-950/60 text-emerald-300 px-2.5 py-1">
            {subscription?.status || 'active'}
          </span>
        </div>

        <p className="text-xs text-amber-400/80 mt-4 leading-relaxed">
          No payment provider (Stripe, etc.) is connected yet, so this reflects a plan flag only
          — no card has been charged. When billing is added, this page will show renewal dates
          and an invoice history sourced from the provider instead.
        </p>

        {user?.plan === 'business' && (
          <button
            onClick={handleDowngrade}
            disabled={submitting}
            className="mt-5 text-sm text-slate-400 hover:text-slate-200 underline disabled:opacity-50"
          >
            {submitting ? 'Switching…' : 'Switch to Free plan'}
          </button>
        )}
      </div>
    </div>
  );
}
