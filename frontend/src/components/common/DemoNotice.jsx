import { useState } from 'react';

const ACKNOWLEDGED_KEY = 'vera-demo-notice-acknowledged';

export default function DemoNotice() {
  const [expanded, setExpanded] = useState(() => {
    try {
      return sessionStorage.getItem(ACKNOWLEDGED_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  if (import.meta.env.VITE_SHOW_DEMO_NOTICE === 'false') return null;

  function acknowledge() {
    setExpanded(false);
    try {
      sessionStorage.setItem(ACKNOWLEDGED_KEY, 'true');
    } catch {
      // The notice still collapses when browser storage is unavailable.
    }
  }

  return (
    <aside className="demo-notice" aria-label="Demo hosting notice">
      {expanded && (
        <div className="demo-notice__panel" id="demo-notice-details">
          <h2 className="demo-notice__title">A quick note before you explore</h2>
          <p>
            This is a demo on free hosting. The first load after inactivity may
            take about a minute while the server wakes up.
          </p>
          <p>
            Keep the backend server running for all features to work. If it is
            asleep or offline, chat, voice, and other server-powered features
            will be unavailable until it is running again.
          </p>
          <p>
            Saved chats, business settings, and uploaded knowledge may be cleared
            when the server restarts. Keep your own copies of anything important.
          </p>
          <button className="demo-notice__acknowledge" type="button" onClick={acknowledge}>
            Got it
          </button>
        </div>
      )}
      <button
        className="demo-notice__toggle"
        type="button"
        aria-expanded={expanded}
        aria-controls="demo-notice-details"
        onClick={() => setExpanded((previous) => !previous)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M12 3 2 21h20L12 3Z" strokeLinejoin="round" />
          <path d="M12 9v5m0 3v.5" strokeLinecap="round" />
        </svg>
        Demo mode
        <span className="demo-notice__toggle-detail">{expanded ? 'Hide notice' : 'View notice'}</span>
      </button>
    </aside>
  );
}
