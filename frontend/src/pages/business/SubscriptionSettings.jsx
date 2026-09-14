import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import { useToast } from '../../context/ToastContext';
import { selectPlan } from '../../services/business';

const GLASS = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,195,255,0.1)', borderRadius: '16px' };

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
    <div style={{ maxWidth: '520px', fontFamily: "'Inter', system-ui, sans-serif", color: '#DCE5FF' }}>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>
        Subscription
      </h1>
      <p style={{ fontSize: '13px', color: '#5A6180', marginBottom: '24px' }}>
        Manage your plan. Real payment collection isn't wired up yet — see the note below.
      </p>

      <div style={{ ...GLASS, padding: '24px' }}>
        {/* Current plan */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <p style={{ fontSize: '11px', color: '#5A6180', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
              Current plan
            </p>
            <p style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: 0, fontFamily: "'Space Grotesk', sans-serif", textTransform: 'capitalize' }}>
              {user?.plan || 'free'}
            </p>
          </div>
          <span style={{
            borderRadius: '20px', padding: '4px 14px', fontSize: '12px', fontWeight: 600,
            color: '#34D399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)',
          }}>
            {subscription?.status || 'active'}
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(180,195,255,0.08)', margin: '16px 0' }} />

        {/* Note */}
        <div style={{
          padding: '12px 14px', borderRadius: '10px',
          background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)',
          marginBottom: '20px',
        }}>
          <p style={{ fontSize: '12px', color: 'rgba(251,191,36,0.85)', lineHeight: '1.6', margin: 0 }}>
            No payment provider (Stripe, etc.) is connected yet, so this reflects a plan flag only — no card has been charged. When billing is added, this page will show renewal dates and an invoice history sourced from the provider instead.
          </p>
        </div>

        {user?.plan === 'business' && (
          <button
            onClick={handleDowngrade}
            disabled={submitting}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: '13px', color: '#5A6180', cursor: submitting ? 'not-allowed' : 'pointer',
              textDecoration: 'underline', opacity: submitting ? 0.5 : 1,
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#DCE5FF'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#5A6180'}
          >
            {submitting ? 'Switching…' : 'Switch to Free plan'}
          </button>
        )}
      </div>
    </div>
  );
}
