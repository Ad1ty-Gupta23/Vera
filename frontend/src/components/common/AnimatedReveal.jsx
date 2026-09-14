import { useEffect, useRef } from 'react';

/**
 * AnimatedReveal — wraps children and applies a scroll-triggered reveal animation.
 * Uses IntersectionObserver; falls back gracefully when not supported.
 */
export default function AnimatedReveal({
  children,
  direction = 'up',   // 'up' | 'left' | 'right' | 'scale'
  delay = 0,
  className = '',
  threshold = 0.15,
}) {
  const ref = useRef(null);

  const directionClass = {
    up: 'reveal',
    left: 'reveal-left',
    right: 'reveal-right',
    scale: 'reveal',
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced-motion preference
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      el.classList.add('visible');
      return;
    }

    if (delay) el.style.transitionDelay = `${delay}ms`;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, threshold]);

  return (
    <div ref={ref} className={`${directionClass[direction]} ${className}`}>
      {children}
    </div>
  );
}
