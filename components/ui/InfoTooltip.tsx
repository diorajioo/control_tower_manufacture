"use client";

import { useState } from "react";
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
  return (
    <span
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <Info
        size={size}
        className={cn("cursor-help transition-colors", open ? "text-slate-400" : "text-slate-300")}
      />
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, scale: 0.88, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 6 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 text-xs text-slate-100 bg-[#2A3D4A] px-3 py-2 rounded-xl shadow-2xl z-50 leading-relaxed font-normal normal-case tracking-normal"
            style={{ transformOrigin: "50% 100%", width }}
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
