"use client";

import { useState, useRef, useLayoutEffect } from "react";
import { Info } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  /** Plain explanation (short tooltips) */
  text?: string;
  /** Labelled rules — label column on the left, text on the right (long tooltips, e.g. chart rules) */
  rows?: { label: string; text: string }[];
  /** Muted line under the rows */
  footer?: string;
  /** Icon size px. Default 12. */
  size?: number;
  /** Tooltip panel width px. Default 224 (= w-56). */
  width?: number;
  className?: string;
}

export function InfoTooltip({ text, rows, footer, size = 12, width = 224, className }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  // Above the icon by default; below it when the panel would not fit above (measured before it is shown)
  const [pos, setPos] = useState<{ left: number; anchorTop: number; anchorBottom: number; below: boolean | null } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLSpanElement>(null);

  function show() {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({
        // centered on icon, clamped to stay inside viewport
        left: Math.max(8, Math.min(
          window.innerWidth - width - 8,
          rect.left + rect.width / 2 - width / 2,
        )),
        anchorTop: rect.top,
        anchorBottom: rect.bottom,
        below: null,
      });
    }
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open || !pos || pos.below !== null || !panel.current) return;
    const h = panel.current.offsetHeight;
    setPos({ ...pos, below: pos.anchorTop - h - 8 < 8 });
  }, [open, pos]);

  return (
    <span
      ref={ref}
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
      onFocus={show}
      onBlur={() => setOpen(false)}
    >
      <Info
        size={size}
        className={cn("cursor-help transition-colors", open ? "text-slate-400" : "text-slate-300")}
      />
      <AnimatePresence>
        {open && pos && (
          <motion.span
            ref={panel}
            role="tooltip"
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.88 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none text-xs text-slate-100 bg-[#2A3D4A] px-3 py-2 rounded-xl shadow-2xl leading-relaxed font-normal normal-case tracking-normal"
            style={{
              position: "fixed",
              ...(pos.below
                ? { top: pos.anchorBottom + 8 }
                : { bottom: window.innerHeight - pos.anchorTop + 8 }),
              left: pos.left,
              width,
              zIndex: 9999,
              transformOrigin: pos.below ? "50% 0%" : "50% 100%",
              // hidden for the one frame in which the height is measured
              visibility: pos.below === null ? "hidden" : "visible",
            }}
          >
            {text}
            {rows && (
              <span className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5" style={{ display: "grid" }}>
                {rows.map((r) => (
                  <span key={r.label} className="contents">
                    <span className="font-bold text-slate-300 whitespace-nowrap">{r.label}</span>
                    <span>{r.text}</span>
                  </span>
                ))}
              </span>
            )}
            {footer && <span className="block mt-2 pt-1.5 border-t border-white/10 text-[10.5px] text-slate-400">{footer}</span>}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
