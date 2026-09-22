"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { ResponsiveLine } from "@nivo/line";

// ---------------------------------------------------------------------------
// Status tone — lead time: lower is better, target = 13 days
// ---------------------------------------------------------------------------

const TARGET = 13;

const TONES = {
  on:      { color: "#067647", bg: "#f0fdf6", border: "#bbf0d2", icon: "✓", label: "On Track"      },
  risk:    { color: "#b45309", bg: "#fffaeb", border: "#f0d58a", icon: "!", label: "At Risk"        },
  off:     { color: "#d92d20", bg: "#fef4f3", border: "#fbd5d1", icon: "↑", label: "Above Target"  },
  neutral: { color: "#667085", bg: "#f8f9fb", border: "#e4e7ec", icon: "—", label: "No Data"       },
};

type ToneKey = "on" | "risk" | "off" | "neutral";

function toneFromDays(days: number): ToneKey {
  if (days === 0) return "neutral";
  if (days <= TARGET) return "on";
  if (days <= TARGET * 1.15) return "risk";   // up to ~15% over = 14.95d
  return "off";
}

// Trend is inverted for lead time: negative % = time went down = good
function trendColor(trend: number | null): string {
  if (trend === null) return "#98a2b3";
  return trend <= 0 ? "#067647" : "#d92d20";
}
function trendArrow(trend: number | null): string {
  if (trend === null) return "→";
  if (trend < 0) return "↘"; // lead time fell = good (arrow down-right)
  if (trend > 0) return "↗"; // lead time rose = bad
  return "→";
}
function trendLabel(trend: number | null): string {
  if (trend === null) return "—";
  return (trend > 0 ? "+" : "") + trend.toFixed(1) + "%";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDays(days: number, unit: "days" | "hours"): string {
  const val = unit === "hours" ? days * 24 : days;
  return val.toFixed(unit === "hours" ? 1 : 2);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LeadTimeKPICardProps {
  grossDays:       number;
  nettDays:        number;
  grossTrend:      number | null;
  nettTrend:       number | null;
  byPositionGross: { position: string; avgHours: number }[];
  byPositionNett:  { position: string; avgHours: number }[];
  sparkline:       number[];
  hasAlert?:       boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeadTimeKPICard({
  grossDays,
  nettDays,
  grossTrend,
  nettTrend,
  byPositionGross,
  byPositionNett,
  sparkline,
  hasAlert,
}: LeadTimeKPICardProps) {
  const [type, setType] = useState<"gross" | "nett">("gross");
  const [unit, setUnit] = useState<"days" | "hours">("days");

  const primaryDays  = type === "gross" ? grossDays  : nettDays;
  const primaryTrend = type === "gross" ? grossTrend : nettTrend;
  const secondaryDays  = type === "gross" ? nettDays   : grossDays;
  const secondaryTrend = type === "gross" ? nettTrend  : grossTrend;
  const secondaryLabel = type === "gross" ? "Nett lead time this period" : "Gross lead time this period";

  const tone      = TONES[toneFromDays(primaryDays)];
  const accentColor = hasAlert ? "#ef4444" : tone.color;

  const delta    = primaryDays - TARGET;
  const deltaPct = TARGET > 0 ? (delta / TARGET) * 100 : 0;
  const deltaOver = delta > 0;

  const positions = (type === "gross" ? byPositionGross : byPositionNett) ?? [];
  const maxHours  = positions[0]?.avgHours || 1;

  const hasSparkline = sparkline.length >= 2;
  const nivoData = hasSparkline
    ? [{ id: "leadtime", data: sparkline.map((y, i) => ({ x: i, y })) }]
    : [];

  const unitLabel = unit === "days" ? "days" : "hours";

  return (
    <div
      style={{
        background: "white",
        border: hasAlert ? "1px solid #ffd6d9" : "1px solid #e9eaee",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        width: "100%",
        fontFamily: "Lato, sans-serif",
        height: "100%",
      }}
    >
      {/* Inner layout: accent bar + main content */}
      <div style={{ display: "flex", flex: 1 }}>
        {/* Left accent bar */}
        <div style={{ width: 6, background: accentColor, flexShrink: 0 }} />

        {/* Main content */}
        <div
          style={{
            flex: 1,
            padding: "14px 16px 0",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* ── Header row ── */}
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

            {/* LEFT column */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>

              {/* Eyebrow */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Clock size={13} color="#3b82f6" strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: "0.11em",
                    color: "#8a90a0",
                    fontFamily: "Lato, sans-serif",
                  }}
                >
                  LEAD TIME
                </span>
              </div>

              {/* Primary value + unit + trend */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 30,
                    fontWeight: 700,
                    letterSpacing: "-0.015em",
                    color: deltaOver ? "#d92d20" : "#101828",
                    fontFamily: "Lato, sans-serif",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}
                >
                  {fmtDays(primaryDays, unit)}
                </span>
                <span style={{ fontSize: 12, color: "#98a2b3", fontFamily: "Lato, sans-serif" }}>
                  {unitLabel}
                </span>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: trendColor(primaryTrend),
                    fontFamily: "Lato, sans-serif",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {trendArrow(primaryTrend)} {trendLabel(primaryTrend)}
                </span>
              </div>

              {/* vs target line */}
              <div
                style={{
                  fontSize: 11.5,
                  color: "#667085",
                  display: "flex",
                  alignItems: "baseline",
                  gap: 4,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    color: deltaOver ? "#d92d20" : "#067647",
                    fontWeight: 700,
                    fontFamily: "Lato, sans-serif",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {deltaOver ? "+" : ""}{delta.toFixed(2)} {unit === "hours" ? "hrs" : "days"}
                </span>
                <span>vs target</span>
                <span style={{ fontFamily: "Lato, sans-serif", fontVariantNumeric: "tabular-nums" }}>
                  {TARGET}.00 days ({deltaOver ? "+" : ""}{deltaPct.toFixed(1)}%)
                </span>
              </div>

              {/* Status pill */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    background: tone.bg,
                    border: `1px solid ${tone.border}`,
                    color: tone.color,
                    borderRadius: 5,
                    padding: "2px 8px",
                    fontFamily: "Lato, sans-serif",
                  }}
                >
                  {tone.icon} {tone.label}
                </span>
              </div>
            </div>

            {/* RIGHT column */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>

              {/* Toggles */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                {/* Gross / Nett */}
                <div
                  style={{
                    background: "#f2f3f6",
                    borderRadius: 7,
                    padding: 3,
                    display: "flex",
                    gap: 2,
                  }}
                >
                  {(["gross", "nett"] as const).map((t) => {
                    const active = type === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setType(t)}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: 5,
                          border: "none",
                          cursor: "pointer",
                          background: active ? "white" : "transparent",
                          color: active ? "#101828" : "#667085",
                          boxShadow: active ? "0 1px 2px rgba(16,24,40,.08)" : "none",
                          fontFamily: "Lato, sans-serif",
                          transition: "background 0.15s, color 0.15s",
                        }}
                      >
                        {t === "gross" ? "Gross" : "Nett"}
                      </button>
                    );
                  })}
                </div>
                {/* Days / Hours */}
                <div
                  style={{
                    background: "#f2f3f6",
                    borderRadius: 7,
                    padding: 3,
                    display: "flex",
                    gap: 2,
                  }}
                >
                  {(["days", "hours"] as const).map((u) => {
                    const active = unit === u;
                    return (
                      <button
                        key={u}
                        onClick={() => setUnit(u)}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: 5,
                          border: "none",
                          cursor: "pointer",
                          background: active ? "white" : "transparent",
                          color: active ? "#101828" : "#667085",
                          boxShadow: active ? "0 1px 2px rgba(16,24,40,.08)" : "none",
                          fontFamily: "Lato, sans-serif",
                          transition: "background 0.15s, color 0.15s",
                        }}
                      >
                        {u === "days" ? "Days" : "Hours"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sparkline */}
              {hasSparkline ? (
                <div style={{ width: 150, height: 42 }}>
                  <ResponsiveLine
                    data={nivoData}
                    margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
                    xScale={{ type: "point" }}
                    yScale={{ type: "linear", min: "auto", max: "auto" }}
                    enableArea={true}
                    areaOpacity={0.07}
                    colors={[accentColor]}
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
                <div style={{ width: 150, height: 42, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 10, color: "#c5cad8", fontFamily: "Lato, sans-serif" }}>
                    no sparkline data
                  </span>
                </div>
              )}

              <div
                style={{
                  fontSize: 10,
                  color: "#a3a8b5",
                  fontFamily: "Lato, sans-serif",
                  marginTop: -4,
                  textAlign: "right",
                }}
              >
                {hasSparkline ? `${sparkline.length} weeks · days` : ""}
              </div>
            </div>
          </div>

          {/* ── Secondary metric row ── */}
          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid #eceef2",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 10,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#101828",
                    fontFamily: "Lato, sans-serif",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmtDays(secondaryDays, unit)}
                </span>
                <span style={{ fontSize: 11, color: "#98a2b3", fontFamily: "Lato, sans-serif" }}>
                  {unitLabel}
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: "#a3a8b5", fontFamily: "Lato, sans-serif" }}>
                {secondaryLabel}
              </div>
            </div>

            {secondaryTrend !== null && (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: secondaryTrend <= 0 ? "#f0fdf6" : "#fef4f3",
                  border: `1px solid ${secondaryTrend <= 0 ? "#bbf0d2" : "#fbd5d1"}`,
                  color: trendColor(secondaryTrend),
                  borderRadius: 5,
                  padding: "3px 9px",
                  fontFamily: "Lato, sans-serif",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {trendArrow(secondaryTrend)} {trendLabel(secondaryTrend)}
              </div>
            )}
          </div>

          {/* ── Position breakdown ── */}
          {positions.length > 0 && (
            <div
              style={{
                marginBottom: 12,
                maxHeight: 63,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 5,
              }}
            >
              {positions.map((p) => (
                <div key={p.position} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 10,
                      color: "#475569",
                      width: 90,
                      flexShrink: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontFamily: "Lato, sans-serif",
                    }}
                    title={p.position}
                  >
                    {p.position}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      background: "#dbeafe",
                      borderRadius: 999,
                      height: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        background: "#3b82f6",
                        borderRadius: 999,
                        width: `${(p.avgHours / maxHours) * 100}%`,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      color: "#64748b",
                      width: 36,
                      textAlign: "right",
                      flexShrink: 0,
                      fontFamily: "Lato, sans-serif",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {unit === "hours" ? p.avgHours.toFixed(1) + "h" : (p.avgHours / 24).toFixed(2) + "d"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer bar */}
      <div
        style={{
          background: "#f6f7f9",
          borderTop: "1px solid #eceef2",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "7px 16px 7px 22px",
          borderRadius: "0 0 9px 9px",
        }}
      >
        <span style={{ fontSize: 11, color: "#667085", fontFamily: "Lato, sans-serif" }}>
          {type === "gross" ? "Total process PO → NDC receiving" : "Actual production time"}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "#a3a8b5",
            fontFamily: "Lato, sans-serif",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          Target ≤ {TARGET} days
        </span>
      </div>
    </div>
  );
}
