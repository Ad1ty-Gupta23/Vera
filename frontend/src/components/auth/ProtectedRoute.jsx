import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#080B18',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '2px solid rgba(113,145,255,0.2)',
            borderTopColor: '#7191FF',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    );
  }

  // After logout, navigate('/') fires before this re-render, so users land on
  // the Landing page. This redirect is a fallback for direct URL access while
  // unauthenticated — sends them to Landing which has the Sign In button.
  if (!isAuthenticated) return <Navigate to="/" replace />;

  return children;
}
