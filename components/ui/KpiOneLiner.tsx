"use client";

import { useSyncExternalStore } from "react";

// One-line AI insight per KPI card, written by the same model call as the AI Summary
// (`[[CARDS]]` block in /api/dashboard/summary). AISummary publishes the lines with setKpiOneLiners();
// each card renders <KpiOneLiner id> as its own bar below the status row. No line → nothing rendered
// (loading, error, or a KPI the model did not cover).

type Lines = Record<string, string>;
let lines: Lines = {};
const listeners = new Set<() => void>();

export function setKpiOneLiners(next: Lines | null) {
  lines = next ?? {};
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function KpiOneLiner({ id, z = (n: number) => n }: { id?: string; z?: (n: number) => number }) {
  const text = useSyncExternalStore(subscribe, () => (id ? lines[id] : undefined), () => undefined);
  if (!text) return null;
  return (
    <div
      title={text}
      style={{
        marginTop: z(10),
        display: "flex",
        alignItems: "center",
        gap: z(6),
        background: "#EEF4FB",
        borderRadius: 6,
        padding: `${z(5)}px ${z(8)}px`,
        minWidth: 0,
      }}
    >
      <AiTag />
      <span style={{ fontSize: 11, color: "#16305C", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{text}</span>
    </div>
  );
}

/** "AI" label for AI-written text on cards: white on Paragon Blue box. One look everywhere (KPI one-liners, Lead Time note). */
export function AiTag() {
  return (
    <span style={{
      display: "inline-block", flexShrink: 0, background: "#1E4076", color: "#fff", borderRadius: 3,
      padding: "1px 4px", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em", lineHeight: "12px", verticalAlign: "1px",
    }}>
      AI
    </span>
  );
}
