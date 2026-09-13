import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { selectPlan } from '../../services/business';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    tagline: 'The general-purpose AI assistant, for anyone.',
    features: [
      'General-purpose AI chatbot',
      'Voice input & output',
      'Diagrams & visual intelligence',
      'Maps when location is relevant',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: 'Custom',
    tagline: 'Your own AI assistant, trained on your business.',
    features: [
      'Personalized AI assistant',
      'Your own knowledge base (RAG)',
      'Business-specific answers',
      'Gmail-based issue reporting',
      'Embeddable website widget',
      'Business dashboard & analytics',
    ],
    highlighted: true,
  },
];

export default function SubscriptionSelect() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(null);

  const handleSelect = async (planId) => {
    setSubmitting(planId);
    try {
      await selectPlan(planId);
      await refreshUser();
      if (planId === 'business') {
        toast.success("You're on the Business plan — let's set up your workspace.");
        navigate('/business/onboarding');
      } else {
        toast.success("You're on the Free plan.");
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.message || 'Could not update your plan. Please try again.');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-16">
      <div className="max-w-4xl mx-auto text-center mb-12">
        <h1 className="text-2xl md:text-3xl font-semibold">Choose your plan</h1>
        <p className="text-slate-400 mt-2 text-sm">
          {user?.plan === 'business'
            ? 'You can switch back to Free at any time.'
            : 'Start free, or unlock a personalized assistant for your business.'}
        </p>
        <p className="text-xs text-amber-400/80 mt-3 max-w-lg mx-auto">
          No payment provider is connected yet — selecting Business unlocks the workspace for
          setup and testing, it doesn't charge a card.
        </p>
      </div>

      <div className="max-w-4xl mx-auto grid gap-6 sm:grid-cols-2">
        {PLANS.map((plan) => {
          const isCurrent = user?.plan === plan.id;
          return (
            <div
              key={plan.id}
              className={`flex flex-col rounded-2xl border p-6 ${
                plan.highlighted
                  ? 'border-violet-600/60 bg-violet-950/20 shadow-[0_0_30px_rgba(139,92,246,0.08)]'
                  : 'border-slate-800 bg-slate-900/60'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                <span className="text-sm text-slate-400">{plan.price}</span>
              </div>
              <p className="text-sm text-slate-400 mt-1">{plan.tagline}</p>

              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                    <svg
                      className="w-4 h-4 mt-0.5 shrink-0 text-violet-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelect(plan.id)}
                disabled={submitting !== null || isCurrent}
                className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  plan.highlighted
                    ? 'bg-violet-600 hover:bg-violet-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                }`}
              >
                {isCurrent
                  ? 'Current plan'
                  : submitting === plan.id
                  ? 'Updating…'
                  : `Choose ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
