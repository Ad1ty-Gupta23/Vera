import { useEffect, useState } from 'react';
import { useBusiness } from '../../context/BusinessContext';
import { useToast } from '../../context/ToastContext';
import FormField from '../../components/common/FormField';

const FIELDS = [
  'name',
  'description',
  'category',
  'website',
  'contact_email',
  'phone',
  'address',
  'helpdesk_email',
  'working_hours',
];

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

  useEffect(() => {
    setForm(toFormState(business));
  }, [business]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Business name is required.';
    if (!form.helpdesk_email.trim()) errors.helpdesk_email = 'Helpdesk email is required.';
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
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-100">Settings</h1>
      <p className="text-sm text-slate-500 mt-1">
        This information is used by your AI assistant to answer customer questions.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Business name"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            error={fieldErrors.name}
          />
          <FormField label="Category" name="category" value={form.category} onChange={handleChange} />
        </div>

        <FormField
          label="Description"
          name="description"
          as="textarea"
          value={form.description}
          onChange={handleChange}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Website" name="website" value={form.website} onChange={handleChange} />
          <FormField
            label="Working hours"
            name="working_hours"
            value={form.working_hours}
            onChange={handleChange}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Contact email"
            name="contact_email"
            type="email"
            value={form.contact_email}
            onChange={handleChange}
          />
          <FormField label="Phone number" name="phone" value={form.phone} onChange={handleChange} />
        </div>

        <FormField label="Address" name="address" value={form.address} onChange={handleChange} />

        <FormField
          label="Helpdesk email"
          name="helpdesk_email"
          type="email"
          value={form.helpdesk_email}
          onChange={handleChange}
          required
          error={fieldErrors.helpdesk_email}
          hint="Customer issue reports will be emailed here once Gmail is connected."
        />

        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-medium text-white transition-all"
        >
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
