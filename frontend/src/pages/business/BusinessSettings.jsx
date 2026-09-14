import { useEffect, useState } from 'react';
import { useBusiness } from '../../context/BusinessContext';
import { useToast } from '../../context/ToastContext';
import FormField from '../../components/common/FormField';

const FIELDS = ['name', 'description', 'category', 'website', 'contact_email', 'phone', 'address', 'helpdesk_email', 'working_hours'];

function toFormState(business) {
  const state = {};
  for (const key of FIELDS) state[key] = business?.[key] ?? '';
  return state;
}

export default function BusinessSettings() {
  const { business, updateBusiness } = useBusiness();
  const toast = useToast();
  const [form, setForm] = useState(() => toFormState(business));
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => { setForm(toFormState(business)); }, [business]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Business name is required.';
    if (!form.helpdesk_email.trim()) errors.helpdesk_email = 'Action inbox email is required.';
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
      await updateBusiness(payload);
      toast.success('Business profile updated.');
    } catch (err) {
      toast.error(err.message || 'Could not save changes.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px', fontFamily: "'Inter', system-ui, sans-serif", color: '#DCE5FF' }}>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>
        Settings
      </h1>
      <p style={{ fontSize: '13px', color: '#5A6180', marginBottom: '28px' }}>
        This information is used by your AI assistant to answer customer questions.
      </p>

      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(180,195,255,0.1)',
        borderRadius: '16px',
        padding: '24px',
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'grid', gap: '18px', gridTemplateColumns: '1fr 1fr' }}>
            <FormField label="Business name" name="name" value={form.name} onChange={handleChange} required error={fieldErrors.name} />
            <FormField label="Category" name="category" value={form.category} onChange={handleChange} />
          </div>

          <FormField label="Description" name="description" as="textarea" value={form.description} onChange={handleChange} />

          <div style={{ display: 'grid', gap: '18px', gridTemplateColumns: '1fr 1fr' }}>
            <FormField label="Website" name="website" value={form.website} onChange={handleChange} />
            <FormField label="Working hours" name="working_hours" value={form.working_hours} onChange={handleChange} />
          </div>

          <div style={{ display: 'grid', gap: '18px', gridTemplateColumns: '1fr 1fr' }}>
            <FormField label="Contact email" name="contact_email" type="email" value={form.contact_email} onChange={handleChange} />
            <FormField label="Phone number" name="phone" value={form.phone} onChange={handleChange} />
          </div>

          <FormField label="Address" name="address" value={form.address} onChange={handleChange} />

          <FormField
            label="Action inbox email"
            name="helpdesk_email"
            type="email"
            value={form.helpdesk_email}
            onChange={handleChange}
            required
            error={fieldErrors.helpdesk_email}
            hint="Optional confirmed customer-action emails are sent here once Gmail is connected."
          />

          <div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: submitting ? 'rgba(113,145,255,0.3)' : 'linear-gradient(135deg, #7191FF, #9B8CFF)',
                border: 'none', borderRadius: '12px',
                padding: '11px 24px',
                fontSize: '14px', fontWeight: 600, color: '#fff',
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
