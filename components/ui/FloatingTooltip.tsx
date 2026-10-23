"use client";

// Tooltip that follows the cursor and can never be clipped (CLAUDE.md → Tooltips always on top):
// rendered into document.body through a portal (no card overflow, no transformed ancestor can cut or
// shift it), fixed position, flipped left / up when it would leave the viewport.
// Use it for custom (non-Nivo) charts; content = <LineTooltip> or any tooltip body.

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const GAP = 12;
const EDGE = 8;

export function FloatingTooltip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = x + GAP;
    if (left + width > vw - EDGE) left = Math.max(EDGE, x - GAP - width);
    let top = y - 8;
    if (top + height > vh - EDGE) top = Math.max(EDGE, vh - EDGE - height);
    setPos({ left, top });
  }, [x, y]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed", left: pos?.left ?? x + GAP, top: pos?.top ?? y - 8,
        zIndex: 10000, pointerEvents: "none", visibility: pos ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
