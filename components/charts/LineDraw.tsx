"use client";

// Line draw-in for every Nivo line chart (standard since 2026-10-13): solid lines are drawn left → right
// (stroke-dashoffset), dashed lines (UCL / mean / LCL) fade in at the end so their dash pattern is kept.
// Wrap the ResponsiveLine; the animation replays whenever `drawKey` changes (new data, metric, grain).
// Charts set `animate: false` (LINE_DEFAULTS) — no spring morph between data sets with a different point count.

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export function LineDraw({ drawKey, duration = 800, className, style, children }: {
  /** Replay trigger — anything whose identity changes when the data shown changes (not on hover) */
  drawKey: unknown;
  /** ms for the solid lines; sparklines use ~600 */
  duration?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, tries = 0, cancelled = false;
    let done: ReturnType<typeof setTimeout> | undefined;
    let touched: SVGPathElement[] = [];

    const reset = (p: SVGPathElement) => {
      p.style.removeProperty("stroke-dasharray");
      p.style.removeProperty("stroke-dashoffset");
      p.style.removeProperty("transition");
      p.style.removeProperty("opacity");
    };

    const run = () => {
      if (cancelled) return;
      // Line strokes only (Nivo lines, our limit lines); the hover mesh, grid and axes are not stroked paths
      const paths = Array.from(el.querySelectorAll<SVGPathElement>("svg path")).filter((p) => {
        const stroke = p.getAttribute("stroke");
        return p.getAttribute("fill") === "none" && !!stroke && stroke !== "none" && stroke !== "transparent";
      });
      // ResponsiveLine renders after it measures its box — wait for the paths (max ~1 s)
      if (paths.length === 0) { if (tries++ < 60) raf = requestAnimationFrame(run); return; }

      touched = paths;
      for (const p of paths) {
        const dash = p.getAttribute("stroke-dasharray");
        if (dash && dash !== "0" && dash !== "none") {
          p.style.transition = "none";
          p.style.opacity = "0";
          void p.getBoundingClientRect();
          p.style.transition = `opacity 300ms ease-out ${Math.round(duration * 0.6)}ms`;
          p.style.opacity = "1";
        } else {
          const len = p.getTotalLength();
          p.style.transition = "none";
          p.style.strokeDasharray = `${len}`;
          p.style.strokeDashoffset = `${len}`;
          void p.getBoundingClientRect();
          p.style.transition = `stroke-dashoffset ${duration}ms ${EASE}`;
          p.style.strokeDashoffset = "0";
        }
      }
      // Clean up so hover re-renders and later resizes draw normally
      done = setTimeout(() => touched.forEach(reset), duration + Math.round(duration * 0.6) + 350);
    };

    raf = requestAnimationFrame(run);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (done) clearTimeout(done);
      touched.forEach(reset);
    };
  }, [drawKey, duration]);

  return <div ref={ref} className={className} style={{ width: "100%", height: "100%", ...style }}>{children}</div>;
}
