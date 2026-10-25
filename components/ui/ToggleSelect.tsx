"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { FIELD, FIELD_ON, MENU, MENU_ITEM, MENU_ITEM_ON, MENU_ITEM_OFF } from "@/components/ui/FilterField";

// Dropdown for chart card headers, in the filter field standard (FilterField FIELD box + menu — same look as
// the Header filter bar dropdowns, without the label above). 28px high, so it lines up with SegmentedToggles.
// `locked` options show a lock icon and cannot be picked (same rule as SegmentedToggle).
export function ToggleSelect<T extends string>({ options, value, onChange, ariaLabel, align = "left" }: {
  options: { key: T; label: string; locked?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
  /** Menu edge aligned to the button: "right" for selects near the card's right edge */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", esc); };
  }, [open]);

  const current = options.find((o) => o.key === value)?.label ?? value;

  return (
    <div ref={ref} className="relative shrink-0 w-fit">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(FIELD, FIELD_ON, "justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4076]/40")}
      >
        <span className="whitespace-nowrap">{current}</span>
        <ChevronDown size={11} className={cn("text-slate-400 shrink-0 transition-transform duration-150", open && "rotate-180")} />
      </button>
      {open && (
        <div role="listbox" aria-label={ariaLabel} className={cn(MENU, "min-w-full w-max max-h-72 overflow-y-auto", align === "right" && "left-auto right-0")}>
          {options.map((o) => {
            const on = o.key === value;
            return (
              <button
                key={o.key}
                type="button"
                role="option"
                aria-selected={on}
                disabled={o.locked}
                title={o.locked ? "Coming soon — data not connected yet" : undefined}
                onClick={() => { if (!o.locked) { onChange(o.key); setOpen(false); } }}
                className={cn(MENU_ITEM, o.locked ? "text-slate-300 cursor-not-allowed" : on ? MENU_ITEM_ON : MENU_ITEM_OFF)}
              >
                <span className="flex items-center gap-1.5">
                  {o.locked && <Lock size={9} strokeWidth={2} />}
                  {o.label}
                </span>
                {on && <Check size={11} className="text-[#1E4076]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
