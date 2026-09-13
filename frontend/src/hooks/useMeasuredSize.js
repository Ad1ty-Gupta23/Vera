import { useEffect, useRef, useState } from 'react';

/**
 * Measures a DOM node's actual pixel size via ResizeObserver and returns it.
 *
 * Why this exists: both ReactFlow and react-three-fiber's <Canvas> size
 * themselves off their *immediate parent's* box at the moment they mount.
 * If that parent is a flex child (as ours are — "flex-1" inside a
 * conditionally-rendered panel), the browser can report a 0×0 box on the
 * very first paint, before the flex layout has settled. Neither library
 * recovers from that gracefully on its own in every browser, so the
 * canvas/SVG viewport ends up permanently sized 0×0 — which renders as
 * nothing, and against this app's near-black panel background
 * (bg-slate-950) that reads as a solid "black screen".
 *
 * Using this hook, callers wait for a real, non-zero measurement before
 * mounting ReactFlow / <Canvas>, and remount them (via `key`) if the size
 * changes from 0 to non-zero.
 */
export function useMeasuredSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height }
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}