import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/common/Navbar';
import HeroSection from '../components/landing/HeroSection';
import FeatureCards from '../components/landing/FeatureCards';
import VoiceSection from '../components/landing/VoiceSection';
import WorkflowSection from '../components/landing/WorkflowSection';
import GmailSection from '../components/landing/GmailSection';
import BusinessSection from '../components/landing/BusinessSection';
import HowItWorksSection from '../components/landing/HowItWorksSection';
import CtaSection from '../components/landing/CtaSection';

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();

  // If logged in, send to dashboard automatically
  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div style={{ background: '#080B18', minHeight: '100vh' }}>
      <Navbar />
      <main>
        <HeroSection />
        <FeatureCards />
        <VoiceSection />
        <WorkflowSection />
        <GmailSection />
        <BusinessSection />
        <HowItWorksSection />
        <CtaSection />
      </main>
    </div>
  );
}
