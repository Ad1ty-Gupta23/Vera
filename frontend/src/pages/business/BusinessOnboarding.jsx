import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useBusiness } from '../../context/BusinessContext';
import { useToast } from '../../context/ToastContext';
import FormField from '../../components/common/FormField';
import LoadingIndicator from '../../components/common/LoadingIndicator';

const EMPTY_FORM = {
  name: '',
  description: '',
  category: '',
  website: '',
  contact_email: '',
  phone: '',
  address: '',
  helpdesk_email: '',
  working_hours: '',
};

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5">
          <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold">Your business AI assistant is ready</h1>
        <p className="text-sm text-slate-400 mt-2">
          You can manage its knowledge base, appearance, and integrations from your dashboard.
        </p>

        <div className="mt-8 flex flex-col gap-2.5">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => navigate(a.to)}
              className="w-full flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-200 hover:border-slate-700 hover:bg-slate-900 transition-all text-left"
            >
              <span>{a.label}</span>
              {!a.ready && (
                <span className="text-[10px] uppercase tracking-wide text-slate-500 border border-slate-700 rounded-full px-2 py-0.5">
                  coming soon
                </span>
              )}
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingIndicator label="Loading…" />
      </div>
    );
  }

  if (plan !== 'business') {
    return <Navigate to="/subscribe" replace />;
  }

  if (business && !justCreated) {
    return <Navigate to="/business/overview" replace />;
  }

  if (justCreated) {
    return <ConfirmationScreen />;
  }

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
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold">Set up your business assistant</h1>
        <p className="text-slate-400 text-sm mt-1.5">
          Tell us about your business. You can add your knowledge base and connect Gmail
          afterward.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label="Business name"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              error={fieldErrors.name}
              placeholder="Acme Corp"
            />
            <FormField
              label="Category"
              name="category"
              value={form.category}
              onChange={handleChange}
              placeholder="E-commerce, SaaS, Retail…"
            />
          </div>

          <FormField
            label="Description"
            name="description"
            as="textarea"
            value={form.description}
            onChange={handleChange}
            placeholder="A short description of what your business does — this helps the assistant introduce itself accurately."
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label="Website"
              name="website"
              value={form.website}
              onChange={handleChange}
              placeholder="https://example.com"
            />
            <FormField
              label="Working hours"
              name="working_hours"
              value={form.working_hours}
              onChange={handleChange}
              placeholder="Mon–Fri, 9am–6pm"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label="Contact email"
              name="contact_email"
              type="email"
              value={form.contact_email}
              onChange={handleChange}
              placeholder="hello@example.com"
            />
            <FormField
              label="Phone number"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="+1 555 000 0000"
            />
          </div>

          <FormField
            label="Address"
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="123 Main St, City, Country"
          />

          <FormField
            label="Action inbox email"
            name="helpdesk_email"
            type="email"
            value={form.helpdesk_email}
            onChange={handleChange}
            required
            error={fieldErrors.helpdesk_email}
            hint="Optional confirmed email follow-ups will be sent here once Gmail is connected."
            placeholder="actions@example.com"
          />

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-medium text-white transition-all"
          >
            {submitting ? 'Creating your assistant…' : 'Create business assistant'}
          </button>
        </form>
      </div>
    </div>
  );
}
