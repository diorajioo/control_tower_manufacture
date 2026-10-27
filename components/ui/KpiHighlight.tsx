"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// KPI highlight — clicking a KPI number in AI Summary or a [kpi:ID] chip in the chat
// focuses the matching card: it gets a Paragon Blue ring and scrolls into view,
// every other KPI card drops to low opacity. Clicking the same KPI again, clicking
// anywhere else or pressing Esc clears it.
//
// Contract (keep it when cards change):
//   • Senders call highlightKpi(id) from an element with the `data-kpi-trigger` attribute.
//   • EVERY KPI card on the page sits inside <KpiHighlightTarget id="…"> — cards with data use an
//     ID from KPI_HIGHLIGHT_IDS; cards without data (OEE, Yield, Energy…) use any other ID so they dim too.
//   • Senders only make IDs from KPI_HIGHLIGHT_IDS clickable.
// In development a warning is logged when no target on the page answers an ID.
// ─────────────────────────────────────────────────────────────────────────────

/** Clickable KPIs = metrics with data on a page (same scope as lib/aiScope.ts). */
export const KPI_HIGHLIGHT_IDS = ["leadtime", "output", "productivity"] as const;
export type KpiHighlightId = (typeof KPI_HIGHLIGHT_IDS)[number];

export const isKpiHighlightId = (id: string): id is KpiHighlightId =>
  (KPI_HIGHLIGHT_IDS as readonly string[]).includes(id);

/** Spread on every element that calls highlightKpi, so its click does not clear the highlight. */
export const KPI_TRIGGER_ATTR = { "data-kpi-trigger": "" } as const;

// ── Shared store: the one highlighted KPI on the page ────────────────────────
let current: string | null = null;
const listeners = new Set<() => void>();
const targets = new Map<string, number>(); // id → mounted target count

function setCurrent(next: string | null) {
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onKeyDown);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onKeyDown);
    }
  };
}

function onDocumentClick(e: MouseEvent) {
  if ((e.target as Element | null)?.closest?.("[data-kpi-trigger]")) return;
  setCurrent(null);
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape") setCurrent(null);
}

/** Toggle the highlight for a KPI (same ID again = clear). */
export function highlightKpi(kpi: string) {
  if (!targets.get(kpi) && process.env.NODE_ENV !== "production") {
    console.warn(`[kpi-highlight] no <KpiHighlightTarget id="${kpi}"> on this page`);
  }
  setCurrent(current === kpi ? null : kpi);
}

export function clearKpiHighlight() {
  setCurrent(null);
}

// ── Target wrapper ────────────────────────────────────────────────────────────
export function KpiHighlightTarget({ id, children }: { id: string; children: ReactNode }) {
  const highlighted = useSyncExternalStore(subscribe, () => current, () => null);
  const ref = useRef<HTMLDivElement>(null);
  const active = highlighted === id;
  const dimmed = highlighted !== null && !active;

  useEffect(() => {
    targets.set(id, (targets.get(id) ?? 0) + 1);
    return () => {
      const n = (targets.get(id) ?? 1) - 1;
      if (n > 0) targets.set(id, n); else targets.delete(id);
    };
  }, [id]);

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [active]);

  return (
    <div
      ref={ref}
      data-kpi-highlight={id}
      className="h-full min-w-0 rounded-lg transition-[opacity,box-shadow] duration-200 ease-out"
      style={{
        opacity: dimmed ? 0.35 : 1,
        // Subtle: the dimming of the other cards does most of the work; the focused card only
        // gets a thin translucent Paragon Blue outline and a soft lift.
        boxShadow: active ? "0 0 0 1px rgba(30,64,118,0.35), 0 6px 16px -8px rgba(30,64,118,0.25)" : "none",
      }}
    >
      {children}
    </div>
  );
}
