import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { VERAProvider } from './context/VERAContext';
import { ToastProvider } from './context/ToastContext';
import { BusinessProvider } from './context/BusinessContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import BusinessLayout from './layouts/BusinessLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SubscriptionSelect from './pages/business/SubscriptionSelect';
import BusinessOnboarding from './pages/business/BusinessOnboarding';
import BusinessOverview from './pages/business/BusinessOverview';
import KnowledgeBase from './pages/business/KnowledgeBase';
import CustomizeAssistant from './pages/business/CustomizeAssistant';
import Conversations from './pages/business/Conversations';
import EmailIntegration from './pages/business/EmailIntegration';
import BusinessSettings from './pages/business/BusinessSettings';
import SubscriptionSettings from './pages/business/SubscriptionSettings';
import WebsiteEmbed from './pages/business/WebsiteEmbed';
import SupportDesk from './pages/business/SupportDesk';

// The existing free chatbot (VERAProvider + Dashboard) is untouched — it's
// just now mounted behind auth, at /dashboard, instead of being the only
// route in the app. Business-tier routes (onboarding, business dashboard,
// etc.) are added alongside this block without touching it (Stage 3).
function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <VERAProvider>
                    <Dashboard />
                  </VERAProvider>
                </ProtectedRoute>
              }
            />

            {/* Stage 3 — subscription selection */}
            <Route
              path="/subscribe"
              element={
                <ProtectedRoute>
                  <SubscriptionSelect />
                </ProtectedRoute>
              }
            />

            {/* Stage 3 — business onboarding (only reachable pre-workspace;
                BusinessOnboarding itself redirects away once a workspace
                exists or the user isn't on the Business plan) */}
            <Route
              path="/business/onboarding"
              element={
                <ProtectedRoute>
                  <BusinessProvider>
                    <BusinessOnboarding />
                  </BusinessProvider>
                </ProtectedRoute>
              }
            />

            {/* Stage 3 — business dashboard shell. BusinessLayout enforces
                plan + workspace-exists guards before rendering children. */}
            <Route
              path="/business"
              element={
                <ProtectedRoute>
                  <BusinessProvider>
                    <BusinessLayout />
                  </BusinessProvider>
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<BusinessOverview />} />
              <Route path="knowledge-base" element={<KnowledgeBase />} />
              <Route path="conversations" element={<Conversations />} />
              <Route path="actions" element={<SupportDesk />} />
              <Route path="support" element={<Navigate to="../actions" replace />} />
              <Route path="email" element={<EmailIntegration />} />
              <Route path="customize" element={<CustomizeAssistant />} />
              <Route path="embed" element={<WebsiteEmbed />} />
              <Route path="subscription" element={<SubscriptionSettings />} />
              <Route path="settings" element={<BusinessSettings />} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
