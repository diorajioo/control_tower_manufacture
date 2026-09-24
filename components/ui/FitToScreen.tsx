"use client";

import { useEffect, useRef } from "react";

const MIN_SCALE = 0.55;

interface FitToScreenProps {
  children: React.ReactNode;
  className?: string;
  /** Change this value to re-measure (e.g. `loading ? "loading" : "loaded"`). */
  resetKey?: string | number;
}

export function FitToScreen({ children, className, resetKey }: FitToScreenProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const rafId    = useRef(0);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    function compute() {
      if (!outer || !inner) return;

      // Step 1 — reset to natural layout so scrollHeight is accurate
      inner.style.transform    = "none";
      inner.style.width        = "100%";
      inner.style.transformOrigin = "";

      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        if (!outer || !inner) return;

        const outerH   = outer.clientHeight;
        const naturalH = inner.scrollHeight;
        if (!outerH || !naturalH) return;

        const scale = Math.max(MIN_SCALE, Math.min(1, outerH / naturalH));

        if (scale < 1) {
          // Expand inner width so it visually fills the container after scale
          inner.style.width           = `${100 / scale}%`;
          inner.style.transform       = `scale(${scale})`;
          inner.style.transformOrigin = "top left";
        }
      });
    }

    compute();

    // Re-compute on container resize (window resize, sidebar toggle, etc.)
    const ro = new ResizeObserver(compute);
    ro.observe(outer);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId.current);
    };
  }, [resetKey]);

  return (
    <div
      ref={outerRef}
      className={className}
      style={{ overflow: "hidden" }}
    >
      <div ref={innerRef}>
        {children}
      </div>
    </div>
  );
}
