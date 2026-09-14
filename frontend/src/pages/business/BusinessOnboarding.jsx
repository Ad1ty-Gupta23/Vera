import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useBusiness } from '../../context/BusinessContext';
import { useToast } from '../../context/ToastContext';
import FormField from '../../components/common/FormField';
import LoadingIndicator from '../../components/common/LoadingIndicator';

const EMPTY_FORM = {
  name: '', description: '', category: '', website: '',
  contact_email: '', phone: '', address: '', helpdesk_email: '', working_hours: '',
};

const GLASS = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,195,255,0.1)', borderRadius: '16px' };

function ConfirmationScreen() {
  const navigate = useNavigate();

  const actions = [
    { label: 'Open assistant overview', to: '/business/overview', ready: true },
    { label: 'Manage knowledge base', to: '/business/knowledge-base', ready: true },
    { label: 'Customize assistant', to: '/business/customize', ready: true },
    { label: 'Configure voice actions', to: '/business/actions', ready: true },
    { label: 'Connect Gmail', to: '/business/email', ready: true },
    { label: 'Get embed code', to: '/business/embed', ready: true },
  ];

  return (
    <div style={{
      minHeight: '100vh', background: '#080B18', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
        {/* Success icon */}
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '24px', fontWeight: 700, color: '#fff', margin: '0 0 10px' }}>
          Your business AI assistant is ready
        </h1>
        <p style={{ fontSize: '14px', color: '#5A6180', marginBottom: '32px' }}>
          You can manage its knowledge base, appearance, and integrations from your dashboard.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => navigate(a.to)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                ...GLASS, padding: '14px 18px',
                fontSize: '14px', color: '#DCE5FF', cursor: 'pointer',
                textAlign: 'left', transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(113,145,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(113,145,255,0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(180,195,255,0.1)'; }}
            >
              <span>{a.label}</span>
              {!a.ready && (
                <span style={{
                  fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: '#5A6180', border: '1px solid rgba(180,195,255,0.15)', borderRadius: '20px', padding: '2px 8px',
                }}>
                  coming soon
                </span>
              )}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5A6180" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BusinessOnboarding() {
  const { business, plan, isLoading, createBusiness } = useBusiness();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [justCreated, setJustCreated] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#080B18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingIndicator label="Loading…" />
      </div>
    );
  }

  if (plan !== 'business') return <Navigate to="/subscribe" replace />;
  if (business && !justCreated) return <Navigate to="/business/overview" replace />;
  if (justCreated) return <ConfirmationScreen />;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Business name is required.';
    if (!form.helpdesk_email.trim()) {
      errors.helpdesk_email = 'An action inbox email is required for optional customer follow-up.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v.trim() === '' ? null : v.trim()])
      );
      await createBusiness(payload);
      setJustCreated(true);
    } catch (err) {
      toast.error(err.message || 'Could not create your business workspace.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#080B18', padding: '48px 24px',
      fontFamily: "'Inter', system-ui, sans-serif", color: '#DCE5FF',
    }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(113,145,255,0.1)', border: '1px solid rgba(113,145,255,0.25)',
            borderRadius: '20px', padding: '4px 14px', fontSize: '12px', color: '#A8B7FF', marginBottom: '16px',
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#7191FF' }} />
            Business Plan
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '28px', fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>
            Set up your business assistant
          </h1>
          <p style={{ fontSize: '14px', color: '#5A6180' }}>
            Tell us about your business. You can add your knowledge base and connect Gmail afterward.
          </p>
        </div>

        {/* Form card */}
        <div style={{ ...GLASS, padding: '28px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: '1fr 1fr' }}>
              <FormField label="Business name" name="name" value={form.name} onChange={handleChange} required error={fieldErrors.name} placeholder="Acme Corp" />
              <FormField label="Category" name="category" value={form.category} onChange={handleChange} placeholder="E-commerce, SaaS, Retail…" />
            </div>

            <FormField
              label="Description" name="description" as="textarea" value={form.description}
              onChange={handleChange}
              placeholder="A short description of what your business does — this helps the assistant introduce itself accurately."
            />

            <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: '1fr 1fr' }}>
              <FormField label="Website" name="website" value={form.website} onChange={handleChange} placeholder="https://example.com" />
              <FormField label="Working hours" name="working_hours" value={form.working_hours} onChange={handleChange} placeholder="Mon–Fri, 9am–6pm" />
            </div>

            <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: '1fr 1fr' }}>
              <FormField label="Contact email" name="contact_email" type="email" value={form.contact_email} onChange={handleChange} placeholder="hello@example.com" />
              <FormField label="Phone number" name="phone" value={form.phone} onChange={handleChange} placeholder="+1 555 000 0000" />
            </div>

            <FormField label="Address" name="address" value={form.address} onChange={handleChange} placeholder="123 Main St, City, Country" />

            <FormField
              label="Action inbox email" name="helpdesk_email" type="email" value={form.helpdesk_email}
              onChange={handleChange} required error={fieldErrors.helpdesk_email}
              hint="Optional confirmed email follow-ups will be sent here once Gmail is connected."
              placeholder="actions@example.com"
            />

            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(180,195,255,0.08)' }} />

            <button
              type="submit"
              disabled={submitting}
              style={{
                background: submitting ? 'rgba(113,145,255,0.3)' : 'linear-gradient(135deg, #7191FF, #9B8CFF)',
                border: 'none', borderRadius: '12px',
                padding: '13px 24px', fontSize: '15px', fontWeight: 600, color: '#fff',
                cursor: submitting ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                width: '100%',
              }}
            >
              {submitting ? 'Creating your assistant…' : 'Create business assistant'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
