import { useEffect, useRef, useState } from 'react';

/**
 * AnimatedReveal — scroll-triggered "resolve into focus" transition.
 *
 * Content starts blurred, slightly scaled down and offset, then sharpens into
 * place with a long expo-out ease. Staggering via `delay` makes groups feel
 * like they are firing in sequence. When an element scrolls fully out of view
 * it resets, so the transition replays when you scroll back to it.
 *
 * Drop-in replacement: same props as before (direction, delay, className,
 * threshold). No changes needed in index.css or in any section component.
 *
 *   direction: 'up' | 'left' | 'right' | 'scale'
 */

const DURATION = 1000; // ms
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'; // expo-out

const HIDDEN_TRANSFORM = {
  up: 'translate3d(0, 56px, 0) scale(0.96)',
  left: 'translate3d(-72px, 0, 0) scale(0.96)',
  right: 'translate3d(72px, 0, 0) scale(0.96)',
  scale: 'translate3d(0, 0, 0) scale(0.86)',
};

function shouldSkipMotion() {
  if (typeof window === 'undefined') return true;
  if (!('IntersectionObserver' in window)) return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function AnimatedReveal({
  children,
  direction = 'up',
  delay = 0,
  className = '',
  threshold = 0.15,
}) {
  const ref = useRef(null);
  // hidden -> shown (animating) -> settled (animation done, styles cleared)
  const [phase, setPhase] = useState(() => (shouldSkipMotion() ? 'settled' : 'hidden'));

  // Watch the element entering / leaving the viewport
  useEffect(() => {
    const el = ref.current;
    if (!el || shouldSkipMotion()) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const viewportH = entry.rootBounds?.height ?? window.innerHeight;
        const enoughVisible =
          entry.intersectionRatio >= threshold ||
          entry.intersectionRect.height >= viewportH * 0.4; // covers very tall blocks

        if (entry.isIntersecting && enoughVisible) {
          setPhase((p) => (p === 'hidden' ? 'shown' : p));
        } else if (!entry.isIntersecting) {
          setPhase('hidden'); // fully off-screen, so reset invisibly
        }
      },
      { threshold: [0, threshold, 0.4], rootMargin: '0px 0px -6% 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  // After the animation finishes, drop transform/filter so children with
  // backdrop-filter (glass cards) and hover effects behave normally again.
  useEffect(() => {
    if (phase !== 'shown') return;
    const id = setTimeout(
      () => setPhase((p) => (p === 'shown' ? 'settled' : p)),
      delay + DURATION + 60
    );
    return () => clearTimeout(id);
  }, [phase, delay]);

  let style;
  if (phase === 'hidden') {
    style = {
      opacity: 0,
      transform: HIDDEN_TRANSFORM[direction] ?? HIDDEN_TRANSFORM.up,
      filter: 'blur(14px)',
      transition: 'none',
      willChange: 'opacity, transform, filter',
    };
  } else if (phase === 'shown') {
    style = {
      opacity: 1,
      transform: 'translate3d(0, 0, 0) scale(1)',
      filter: 'blur(0px)',
      transition: [
        `opacity ${DURATION * 0.7}ms ${EASE} ${delay}ms`,
        `transform ${DURATION}ms ${EASE} ${delay}ms`,
        `filter ${DURATION * 0.8}ms ${EASE} ${delay}ms`,
      ].join(', '),
      willChange: 'opacity, transform, filter',
    };
  } else {
    style = { opacity: 1, transform: 'none', filter: 'none', transition: 'none' };
  }

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}