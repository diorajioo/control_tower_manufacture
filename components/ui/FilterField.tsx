"use client";

// Filter field standard: label above, 28px box (same height as the Strategic / Tactical toggle).
// Used by the Header filter bar and the Lead Time page filter card. Spec: docs/UI_UX.md → Header → Filter bar.

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const FIELD_LABEL = "block mb-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-slate-500";
export const FIELD = "h-7 flex items-center gap-1.5 px-2.5 rounded-md border text-[11px] font-semibold transition-colors";
export const FIELD_ON = "border-slate-200 bg-white text-slate-800 hover:border-slate-300";
export const FIELD_OFF = "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed";
// Segmented toggle in a field box; selected option = menu-selected tint
export const SEG = "h-7 inline-flex items-center gap-0.5 p-0.5 rounded-md border border-slate-200 bg-white";
export const SEG_ITEM = "relative z-10 h-full px-2.5 rounded text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4076]/40";
export const SEG_PILL = "absolute inset-0 rounded bg-[#EEF4FB]";
export const MENU = "absolute top-full mt-1 left-0 z-50 bg-white rounded-lg shadow-[0_8px_24px_rgba(16,24,40,0.12)] border border-slate-200 py-1";
export const MENU_ITEM = "w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] text-left transition-colors";
export const MENU_ITEM_ON = "bg-[#EEF4FB] text-[#16305C] font-semibold";
export const MENU_ITEM_OFF = "text-slate-700 hover:bg-slate-50";

export interface FieldOption { value: string; label: string; group?: string }

const SHOW_MAX = 200; // long lists (20k POs) are searched, not scrolled

/**
 * Labelled dropdown. `value` "" = all. Searchable when the list is long; only the first 200 matches render.
 */
export function SelectField({ label, value, options, onChange, allLabel, width = 140, loading = false }: {
  label: string;
  value: string;
  options: FieldOption[];
  onChange: (v: string) => void;
  /** Label of the "all" option; omit for a plain choice list (no "all") */
  allLabel?: string;
  width?: number;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchable = options.length > 12;

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => { if (!open) setQ(""); }, [open]);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
    return { shown: list.slice(0, SHOW_MAX), total: list.length };
  }, [options, q]);

  const current = options.find((o) => o.value === value)?.label ?? (value || allLabel || "");
  const pick = (v: string) => { onChange(v); setOpen(false); };

  return (
    <div className="relative shrink-0" ref={ref} style={{ width }}>
      <span className={FIELD_LABEL}>{label}</span>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        className={cn(FIELD, FIELD_ON, "w-full justify-between", allLabel && value && "border-[#C3CEE3] bg-[#EEF4FB] text-[#16305C]")}>
        <span className="truncate">{loading && options.length === 0 ? "Loading…" : current}</span>
        <ChevronDown size={11} className={cn("text-slate-400 shrink-0 transition-transform duration-150", open && "rotate-180")} />
      </button>
      {open && (
        <div className={cn(MENU, "w-[max(100%,240px)] max-h-80 flex flex-col")} role="listbox">
          {searchable && (
            <div className="px-2 pb-1 pt-0.5 border-b border-slate-100">
              <div className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-slate-200 focus-within:ring-2 focus-within:ring-[#1E4076]/30">
                <Search size={11} className="text-slate-400 shrink-0" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label.toLowerCase()}`}
                  className="flex-1 min-w-0 text-[11px] bg-transparent focus:outline-none" />
              </div>
            </div>
          )}
          <div className="overflow-y-auto py-0.5">
            {allLabel && (
              <button onClick={() => pick("")} role="option" aria-selected={!value}
                className={cn(MENU_ITEM, !value ? MENU_ITEM_ON : MENU_ITEM_OFF)}>
                <span>{allLabel}</span>
                {!value && <Check size={10} className="text-[#1E4076] shrink-0" />}
              </button>
            )}
            {matches.shown.map((o) => (
              <button key={o.value} onClick={() => pick(o.value)} role="option" aria-selected={value === o.value}
                className={cn(MENU_ITEM, value === o.value ? MENU_ITEM_ON : MENU_ITEM_OFF)}>
                <span className="truncate">{o.label}</span>
                {value === o.value && <Check size={10} className="text-[#1E4076] shrink-0" />}
              </button>
            ))}
            {matches.total === 0 && <p className="px-3 py-2 text-[11px] text-slate-400">No match</p>}
            {matches.total > SHOW_MAX && (
              <p className="px-3 py-1.5 text-[10.5px] text-slate-400">{matches.total - SHOW_MAX} more — type to narrow</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function MultiSelectField({ label, value, options, onChange, allLabel, width = 140, loading = false }: {
  label: string;
  value: string[];
  options: FieldOption[];
  onChange: (v: string[]) => void;
  allLabel?: string;
  width?: number;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchable = options.length > 12;

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => { if (!open) setQ(""); }, [open]);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
    return { shown: list.slice(0, SHOW_MAX), total: list.length };
  }, [options, q]);

  const hasValue = value.length > 0;
  const buttonLabel = !hasValue
    ? (allLabel ?? "")
    : value.length === 1
      ? (options.find((o) => o.value === value[0])?.label ?? value[0])
      : `${value.length} selected`;

  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  const grouped = useMemo(() => {
    if (!matches.shown.some((o) => o.group)) return null;
    const map = new Map<string, FieldOption[]>();
    for (const o of matches.shown) {
      const g = o.group ?? "";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(o);
    }
    return Array.from(map.entries()).filter(([, opts]) => opts.length > 0).map(([group, opts]) => ({ group, opts }));
  }, [matches.shown]);

  const renderItem = (o: FieldOption) => {
    const on = value.includes(o.value);
    return (
      <button key={o.value} onClick={() => toggle(o.value)} role="option" aria-selected={on}
        className={cn(MENU_ITEM, on ? MENU_ITEM_ON : MENU_ITEM_OFF)}>
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("w-3 h-3 rounded-[3px] border shrink-0 flex items-center justify-center transition-colors", on ? "bg-[#1E4076] border-[#1E4076]" : "border-slate-300 bg-white")}>
            {on && <Check size={8} className="text-white" strokeWidth={3} />}
          </div>
          <span className="truncate">{o.label}</span>
        </div>
      </button>
    );
  };

  return (
    <div className="relative shrink-0" ref={ref} style={{ width }}>
      <span className={FIELD_LABEL}>{label}</span>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        className={cn(FIELD, FIELD_ON, "w-full justify-between", hasValue && "border-[#C3CEE3] bg-[#EEF4FB] text-[#16305C]")}>
        <span className="truncate">{loading && options.length === 0 ? "Loading…" : buttonLabel}</span>
        <ChevronDown size={11} className={cn("text-slate-400 shrink-0 transition-transform duration-150", open && "rotate-180")} />
      </button>
      {open && (
        <div className={cn(MENU, "w-[max(100%,240px)] max-h-80 flex flex-col")} role="listbox">
          {searchable && (
            <div className="px-2 pb-1 pt-0.5 border-b border-slate-100">
              <div className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-slate-200 focus-within:ring-2 focus-within:ring-[#1E4076]/30">
                <Search size={11} className="text-slate-400 shrink-0" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label.toLowerCase()}`}
                  className="flex-1 min-w-0 text-[11px] bg-transparent focus:outline-none" />
              </div>
            </div>
          )}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100">
            <button onClick={() => onChange(options.map((o) => o.value))}
              className="text-[11px] font-semibold text-[#1E4076] hover:underline focus:outline-none">
              Select all
            </button>
            {hasValue && (
              <button onClick={() => onChange([])}
                className="text-[11px] font-semibold text-slate-500 hover:underline focus:outline-none">
                Clear
              </button>
            )}
          </div>
          <div className="overflow-y-auto py-0.5">
            {grouped ? (
              grouped.map(({ group, opts }) => (
                <div key={group}>
                  <p className="px-3 pt-2 pb-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-slate-400">{group}</p>
                  {opts.map(renderItem)}
                </div>
              ))
            ) : (
              matches.shown.map(renderItem)
            )}
            {matches.total === 0 && <p className="px-3 py-2 text-[11px] text-slate-400">No match</p>}
            {matches.total > SHOW_MAX && (
              <p className="px-3 py-1.5 text-[10.5px] text-slate-400">{matches.total - SHOW_MAX} more — type to narrow</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
