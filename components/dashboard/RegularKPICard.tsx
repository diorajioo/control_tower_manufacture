"use client";

import type { ReactNode } from "react";
import { ResponsiveLine } from "@nivo/line";
import { StatusDot } from "@/components/ui/StatusDot";
import { KpiOneLiner } from "@/components/ui/KpiOneLiner";

// ─────────────────────────────────────────────────────────────────────────────
// Regular KPI card — generic version of the OutputKPICard / LeadTimeKPICard style
// (accent bar · value + trend · status pill · sparkline · secondary metric · footer).
// Styles are copied 1:1 from OutputKPICard; `compact` shrinks padding/gaps/sparkline to ≈80% (fonts stay regular).
// ─────────────────────────────────────────────────────────────────────────────

const TONES = {
  on:      { color: "#067647", bg: "#f0fdf6", border: "#bbf0d2", icon: "↑", label: "Up"        },
  risk:    { color: "#b45309", bg: "#fffaeb", border: "#f0d58a", icon: "!", label: "Declining" },
  off:     { color: "#d92d20", bg: "#fef4f3", border: "#fbd5d1", icon: "↓", label: "Down"      },
  neutral: { color: "#667085", bg: "#f8f9fb", border: "#e4e7ec", icon: "—", label: "No Data"   },
};

type ToneKey = keyof typeof TONES;

/** Same rule as OutputKPICard: up = on, down ≤ 5% = risk, worse = off. Pass `inverse` when lower is better. */
function toneFromTrend(trend: number | null, inverse = false): ToneKey {
  if (trend === null) return "neutral";
  const t = inverse ? -trend : trend;
  if (t > 0)   return "on";
  if (t >= -5) return "risk";
  return "off";
}

function fmtTrend(n: number | null): string {
  if (n === null) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

function trendArrow(n: number | null): string {
  if (n === null) return "→";
  if (n > 0) return "↗";
  if (n < 0) return "↘";
  return "→";
}

export interface RegularKPICardProps {
  icon: ReactNode;
  label: string;
  value: string;
  unit: string;
  /** % change vs prior period; null = no prior data */
  trend?: number | null;
  /** Lower is better (e.g. Yield Loss) — flips the trend tone */
  inverse?: boolean;
  /** Line under the value, e.g. "vs prior period" or "target ≥ 65%" */
  subLabel: string;
  sparkline?: number[];
  sparkUnit?: string;
  secondary?: { value: string; unit?: string; label: string; trend?: number | null };
  footerLeft: string;
  footerRight?: string;
  noData?: boolean;
  compact?: boolean;
  /** Optional control above the sparkline (e.g. a SegmentedToggle), same spot as the Lead Time card toggles */
  toggle?: ReactNode;
  /** KPI id whose AI one-liner (KpiOneLiner) shows as a bar below the status row */
  insightId?: string;
}

export function RegularKPICard({
  icon,
  label,
  value,
  unit,
  trend = null,
  inverse = false,
  subLabel,
  sparkline = [],
  sparkUnit,
  secondary,
  footerLeft,
  footerRight,
  noData = false,
  compact = false,
  toggle,
  insightId,
}: RegularKPICardProps) {
  // Size scale for spacing/sparkline: 1 = regular, 0.8 = compact. Font sizes are always regular.
  const z = (n: number) => (compact ? Math.round(n * 0.8 * 2) / 2 : n);

  const tone = TONES[noData ? "neutral" : toneFromTrend(trend, inverse)];
  // Value exists but the prior period is empty (trend = null) → not "No Data"
  const statusLabel = !noData && trend === null ? "No Prior Data" : tone.label;
  const hasSparkline = !noData && sparkline.length >= 2;
  const nivoData = hasSparkline ? [{ id: label, data: sparkline.map((y, i) => ({ x: i, y })) }] : [];
  const secondaryTone = secondary?.trend != null ? TONES[toneFromTrend(secondary.trend, inverse)] : null;

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #EBEBEB",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        width: "100%",
        fontFamily: "Lato, sans-serif",
        height: "100%",
      }}
    >
      <div style={{ display: "flex", flex: 1 }}>

        <div style={{ flex: 1, padding: `${z(14)}px ${z(16)}px 0`, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* ── Header row ── */}
          <div style={{ display: "flex", gap: z(16), alignItems: "flex-start" }}>
            {/* LEFT column */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: z(8), minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: z(6) }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", color: "#64748b", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {label}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: z(6), flexWrap: "wrap" }}>
                <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.015em", color: noData ? "#d0d5dd" : "#101828", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                  {noData ? "—" : value}
                </span>
                <span style={{ fontSize: 12, color: "#98a2b3" }}>{unit}</span>
                {!noData && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: trend === null ? "#98a2b3" : tone.color, fontVariantNumeric: "tabular-nums" }}>
                    {trend === null ? "—" : `${trendArrow(trend)} ${fmtTrend(trend)}`}
                  </span>
                )}
              </div>

              <div style={{ fontSize: 11, color: "#98a2b3" }}>{subLabel}</div>

              <div style={{ display: "flex", alignItems: "center", gap: z(8) }}>
                <StatusDot color={tone.color} label={statusLabel} />
              </div>
            </div>

            {/* RIGHT column — sparkline */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: z(8) }}>
              {toggle}
              {hasSparkline ? (
                <div style={{ width: z(150), height: z(42) }}>
                  <ResponsiveLine
                    data={nivoData}
                    margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
                    xScale={{ type: "point" }}
                    yScale={{ type: "linear", min: "auto", max: "auto" }}
                    enableArea={false}
                    colors={["#1E4076"]}
                    lineWidth={1.6}
                    enablePoints={false}
                    enableGridX={false}
                    enableGridY={false}
                    axisLeft={null}
                    axisBottom={null}
                    isInteractive={false}
                    animate={false}
                  />
                </div>
              ) : (
                <div style={{ width: z(150), height: z(42), display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 10, color: "#c5cad8" }}>no sparkline data</span>
                </div>
              )}
              <div style={{ fontSize: 10, color: "#a3a8b5", marginTop: z(-4), textAlign: "right" }}>
                {hasSparkline ? `${sparkline.length} weeks · ${sparkUnit ?? unit}` : ""}
              </div>
            </div>
          </div>

          <KpiOneLiner id={insightId} z={z} />

          {/* ── Secondary metric row ── */}
          {secondary && (
            <div style={{ marginTop: z(10), paddingTop: z(10), borderTop: "1px solid #eceef2", display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: z(12) }}>
              <div style={{ display: "flex", flexDirection: "column", gap: z(2) }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: z(4) }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: noData ? "#d0d5dd" : "#101828", fontVariantNumeric: "tabular-nums" }}>
                    {noData ? "—" : secondary.value}
                  </span>
                  {secondary.unit && <span style={{ fontSize: 11, color: "#98a2b3" }}>{secondary.unit}</span>}
                </div>
                <div style={{ fontSize: 10.5, color: "#a3a8b5" }}>{secondary.label}</div>
              </div>
              {!noData && secondaryTone && (
                <div style={{ fontSize: 11, fontWeight: 700, color: secondaryTone.color, borderRadius: 5, padding: `${z(3)}px ${z(9)}px`, fontVariantNumeric: "tabular-nums" }}>
                  {trendArrow(secondary.trend ?? null)} {fmtTrend(secondary.trend ?? null)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer bar */}
      <div style={{ background: "white", borderTop: "1px solid #eceef2", display: "flex", alignItems: "center", justifyContent: "space-between", gap: z(8), padding: `${z(7)}px ${z(16)}px ${z(7)}px ${z(16)}px`, borderRadius: "0 0 7px 7px" }}>
        <span style={{ fontSize: 11, color: "#667085", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{footerLeft}</span>
        {footerRight && (
          <span style={{ fontSize: 10, color: "#a3a8b5", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{footerRight}</span>
        )}
      </div>
    </div>
  );
}
