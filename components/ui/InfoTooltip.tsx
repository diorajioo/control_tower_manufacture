"use client";

import { useState, useRef } from "react";
import { Info } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  text: string;
  /** Icon size px. Default 12. */
  size?: number;
  /** Tooltip panel width px. Default 224 (= w-56). */
  width?: number;
  className?: string;
}

export function InfoTooltip({ text, size = 12, width = 224, className }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ bottom: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  function show() {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({
        // distance from viewport bottom so the tooltip floats just above the icon
        bottom: window.innerHeight - rect.top + 8,
        // centered on icon, clamped to stay inside viewport
        left: Math.max(8, Math.min(
          window.innerWidth - width - 8,
          rect.left + rect.width / 2 - width / 2,
        )),
      });
    }
    setOpen(true);
  }

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
            role="tooltip"
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.88 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none text-xs text-slate-100 bg-[#2A3D4A] px-3 py-2 rounded-xl shadow-2xl leading-relaxed font-normal normal-case tracking-normal"
            style={{
              position: "fixed",
              bottom: pos.bottom,
              left: pos.left,
              width,
              zIndex: 9999,
              transformOrigin: "50% 100%",
            }}
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
