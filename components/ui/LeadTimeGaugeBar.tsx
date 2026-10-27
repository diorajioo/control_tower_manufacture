"use client";

import { useState } from "react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { TOOLTIP_COLORS } from "@/components/charts/StandardLine";
import { LEAD_TIME_TARGET_DAYS } from "@/lib/leadTimeDefinition";

export interface GaugeCounts {
  onTime: number;
  atRisk: number;
  late: number;
}

/**
 * Stacked PO gauge bar: On-time · At risk · Late.
 * `compact` = smaller bar height + tighter legend (for LiteKPICard);
 * default = full-size (for TacticalView TKpiCard).
 */
export function LeadTimeGaugeBar({
  counts,
  compact = false,
}: {
  counts: GaugeCounts;
  compact?: boolean;
}) {
  const [hovered, setHovered] = useState<{ key: "onTime" | "atRisk" | "late"; clientX: number; clientY: number } | null>(null);
  const total = counts.onTime + counts.atRisk + counts.late;
  if (total === 0) return null;

  const segments = [
    { key: "onTime" as const, color: "#1E4076", bg: "#1E4076",                                                                                                     label: "On-time", detail: `≤ ${LEAD_TIME_TARGET_DAYS}d`,                                          count: counts.onTime },
    { key: "atRisk" as const, color: "#f59e0b", bg: "repeating-linear-gradient(45deg, #f59e0b 0px, #f59e0b 3px, #fef3c7 3px, #fef3c7 8px)",                       label: "At risk", detail: `${LEAD_TIME_TARGET_DAYS}–${(LEAD_TIME_TARGET_DAYS * 1.15).toFixed(1)}d`, count: counts.atRisk },
    { key: "late"   as const, color: "#f97316", bg: "repeating-linear-gradient(45deg, #f97316 0px, #f97316 3px, #fee2e2 3px, #fee2e2 8px)",                       label: "Late",    detail: `> ${(LEAD_TIME_TARGET_DAYS * 1.15).toFixed(1)}d`,                       count: counts.late  },
  ];

  const barHeight = compact ? 7 : 12;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: compact ? 4 : 5, position: "relative" }}
      onMouseLeave={() => setHovered(null)}
    >
      {/* Label row */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{
          fontSize: 9.5, color: "#98a2b3", fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          PO count vs {LEAD_TIME_TARGET_DAYS}-day target
        </span>
        <InfoTooltip
          text={`Completed POs only (PO FG Done Date is set) within the selected period, categorised by actual gross lead time vs the ${LEAD_TIME_TARGET_DAYS}-day target — not the predictive risk score shown in the alerts bar.`}
          size={11}
          width={240}
        />
      </div>

      {/* Stacked bar + boundary triangles */}
      <div style={{ position: "relative", paddingBottom: compact ? 10 : 12 }}>
        <div style={{ height: barHeight, borderRadius: 4, overflow: "hidden", display: "flex", cursor: "default" }}>
          {segments.map((seg) => {
            const pct = (seg.count / total) * 100;
            if (pct <= 0) return null;
            return (
              <div
                key={seg.key}
                style={{
                  height: "100%", width: `${pct}%`, background: seg.bg,
                  transition: "opacity 0.12s",
                  opacity: hovered?.key && hovered.key !== seg.key ? 0.35 : 1,
                }}
                onMouseEnter={(e) => setHovered({ key: seg.key, clientX: e.clientX, clientY: e.clientY })}
                onMouseMove={(e) => setHovered((h) => h ? { ...h, clientX: e.clientX, clientY: e.clientY } : null)}
              />
            );
          })}
        </div>
        {/* Boundary triangles at the on-time/at-risk and at-risk/late thresholds */}
        {[
          { pct: (counts.onTime / total) * 100, label: `${LEAD_TIME_TARGET_DAYS}d` },
          { pct: ((counts.onTime + counts.atRisk) / total) * 100, label: `${(LEAD_TIME_TARGET_DAYS * 1.15).toFixed(1)}d` },
        ].filter(({ pct }) => pct > 0 && pct < 100).map(({ pct, label }) => (
          <div key={label} style={{ position: "absolute", top: barHeight, left: `${pct}%`, transform: "translateX(-50%)" }}>
            <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: "7px solid #101828", margin: "0 auto" }} />
            <div style={{ fontSize: 9, color: "#344054", fontWeight: 700, whiteSpace: "nowrap", textAlign: "center", marginTop: 2, fontFamily: "Lato, sans-serif", fontVariantNumeric: "tabular-nums" }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Floating tooltip */}
      {hovered && (() => {
        const seg = segments.find((s) => s.key === hovered.key)!;
        const pct = (seg.count / total) * 100;
        return (
          <div style={{
            position: "fixed", left: hovered.clientX + 12, top: hovered.clientY + 12, zIndex: 9999,
            background: TOOLTIP_COLORS.bg,
            border: `1px solid ${TOOLTIP_COLORS.border}`,
            backdropFilter: "blur(4px)",
            borderRadius: 8, padding: "6px 10px",
            fontSize: 11, lineHeight: 1.35,
            fontVariantNumeric: "tabular-nums",
            display: "flex", alignItems: "center", gap: 6,
            pointerEvents: "none",
            boxShadow: "0 6px 20px -6px rgba(16,24,40,0.28)",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: seg.color, flexShrink: 0 }} />
            <span style={{ fontWeight: 700, color: TOOLTIP_COLORS.title }}>{seg.label}</span>
            <span style={{ color: TOOLTIP_COLORS.muted, fontSize: 10.5 }}>{seg.detail}</span>
            <span style={{ marginLeft: "auto", fontWeight: 700, color: TOOLTIP_COLORS.value }}>
              {seg.count.toLocaleString()} PO · {pct.toFixed(1)}%
            </span>
          </div>
        );
      })()}

      {/* Legend */}
      <div style={{ display: "flex", gap: compact ? 6 : 8, fontSize: compact ? 9.5 : 10.5, flexWrap: "wrap" }}>
        {segments.map((seg) => (
          <span
            key={seg.key}
            style={{
              display: "flex", alignItems: "center", gap: 3,
              transition: "opacity 0.12s",
              opacity: hovered?.key && hovered.key !== seg.key ? 0.35 : 1,
            }}
          >
            <span style={{ width: compact ? 6 : 7, height: compact ? 6 : 7, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#101828" }}>
              {seg.count.toLocaleString()}
            </span>
            <span style={{ color: "#667085" }}>{seg.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
