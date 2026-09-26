"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { ResponsiveLine } from "@nivo/line";

// ---------------------------------------------------------------------------
// Status tone system
// ---------------------------------------------------------------------------

const TONES = {
  on:      { color: "#067647", bg: "#f0fdf6", border: "#bbf0d2", fill: "rgba(6,118,71,.07)",   icon: "↑", label: "Up"       },
  risk:    { color: "#b45309", bg: "#fffaeb", border: "#f0d58a", fill: "rgba(180,83,9,.07)",   icon: "!", label: "Declining" },
  off:     { color: "#d92d20", bg: "#fef4f3", border: "#fbd5d1", fill: "rgba(217,45,32,.07)",  icon: "↓", label: "Down"     },
  neutral: { color: "#667085", bg: "#f8f9fb", border: "#e4e7ec", fill: "rgba(102,112,133,.05)", icon: "—", label: "No Data"  },
};

type ToneKey = "on" | "risk" | "off" | "neutral";

function toneFromTrend(trend: number | null): ToneKey {
  if (trend === null) return "neutral";
  if (trend > 0)  return "on";
  if (trend >= -5) return "risk";
  return "off";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  return n.toLocaleString("en-US");
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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OutputKPICardProps {
  /** Compact spacing (≈80% padding/gaps/sparkline, regular fonts) for 3-per-row grids */
  compact?:       boolean;
  fgQty:        number;
  bulkQty:      number;
  fgTrend:      number | null;
  bulkTrend:    number | null;
  sparkline:    number[];
  bulkSparkline: number[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OutputKPICard({
  fgQty,
  bulkQty,
  fgTrend,
  bulkTrend,
  sparkline,
  bulkSparkline,
  compact = false,
}: OutputKPICardProps) {
  // Size scale for spacing/sparkline: 1 = regular, 0.8 = compact. Font sizes are always regular.
  const z = (n: number) => (compact ? Math.round(n * 0.8 * 2) / 2 : n);
  const [mode, setMode] = useState<"fg" | "bulk">("fg");

  const primaryValue = mode === "fg" ? fgQty     : bulkQty;
  const primaryUnit  = mode === "fg" ? "pcs"     : "kg";
  const primaryTrend = mode === "fg" ? fgTrend   : bulkTrend;
  const secondaryValue = mode === "fg" ? bulkQty  : fgQty;
  const secondaryUnit  = mode === "fg" ? "kg"     : "pcs";
  const secondaryTrend = mode === "fg" ? bulkTrend : fgTrend;
  const secondaryLabel = mode === "fg"
    ? "Bulk output accepted this period"
    : "Finished goods released this period";

  const tone = TONES[toneFromTrend(primaryTrend)];

  const activeSparkline = mode === "fg" ? sparkline : bulkSparkline;
  const hasSparkline = activeSparkline.length >= 2;
  const nivoData = hasSparkline
    ? [{ id: "output", data: activeSparkline.map((y, i) => ({ x: i, y })) }]
    : [];

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e9eaee",
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
        <div style={{ width: 6, background: tone.color, flexShrink: 0 }} />

        {/* Main content */}
        <div
          style={{
            flex: 1,
            padding: `${z(14)}px ${z(16)}px 0`,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* ── Header row ── */}
          <div style={{ display: "flex", gap: z(16), alignItems: "flex-start" }}>

            {/* LEFT column */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: z(8) }}>

              {/* Eyebrow */}
              <div style={{ display: "flex", alignItems: "center", gap: z(6) }}>
                <Package size={13} color="#6366f1" strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: "0.11em",
                    color: "#8a90a0",
                    fontFamily: "Lato, sans-serif",
                  }}
                >
                  OUTPUT
                </span>
              </div>

              {/* Primary value + trend */}
              <div style={{ display: "flex", alignItems: "baseline", gap: z(6), flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 30,
                    fontWeight: 700,
                    letterSpacing: "-0.015em",
                    color: "#101828",
                    fontFamily: "Lato, sans-serif",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}
                >
                  {fmt(primaryValue)}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "#98a2b3",
                    fontFamily: "Lato, sans-serif",
                  }}
                >
                  {primaryUnit}
                </span>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: tone.color,
                    fontFamily: "Lato, sans-serif",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {trendArrow(primaryTrend)} {fmtTrend(primaryTrend)}
                </span>
              </div>

              {/* vs prior period label */}
              <div
                style={{
                  fontSize: 11,
                  color: "#98a2b3",
                  fontFamily: "Lato, sans-serif",
                }}
              >
                vs prior period
              </div>

              {/* Status pill */}
              <div style={{ display: "flex", alignItems: "center", gap: z(8) }}>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    background: tone.bg,
                    border: `1px solid ${tone.border}`,
                    color: tone.color,
                    borderRadius: 5,
                    padding: `${z(2)}px ${z(8)}px`,
                    fontFamily: "Lato, sans-serif",
                  }}
                >
                  {tone.icon} {tone.label}
                </span>
              </div>
            </div>

            {/* RIGHT column */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: z(8) }}>

              {/* Segmented toggle */}
              <div
                style={{
                  background: "#f2f3f6",
                  borderRadius: 7,
                  padding: z(3),
                  display: "flex",
                  gap: z(2),
                }}
              >
                {(["fg", "bulk"] as const).map((m) => {
                  const active = mode === m;
                  return (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: `${z(4)}px ${z(12)}px`,
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
                      {m === "fg" ? "Finished Goods" : "Bulk"}
                    </button>
                  );
                })}
              </div>

              {/* Sparkline (FG only) */}
              {hasSparkline ? (
                <div style={{ width: z(150), height: z(42) }}>
                  <ResponsiveLine
                    data={nivoData}
                    margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
                    xScale={{ type: "point" }}
                    yScale={{ type: "linear", min: "auto", max: "auto" }}
                    enableArea={true}
                    areaOpacity={0.07}
                    colors={[tone.color]}
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
                <div
                  style={{
                    width: 150,
                    height: 42,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ fontSize: 10, color: "#c5cad8", fontFamily: "Lato, sans-serif" }}>
                    no sparkline data
                  </span>
                </div>
              )}

              {/* Sparkline caption */}
              <div
                style={{
                  fontSize: 10,
                  color: "#a3a8b5",
                  fontFamily: "Lato, sans-serif",
                  marginTop: z(-4),
                  textAlign: "right",
                }}
              >
                {hasSparkline ? `${activeSparkline.length} weeks · ${primaryUnit}` : ""}
              </div>
            </div>
          </div>

          {/* ── Secondary metric row ── */}
          <div
            style={{
              marginTop: z(10),
              paddingTop: z(10),
              borderTop: "1px solid #eceef2",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: z(12),
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: z(2) }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: z(4) }}>
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#101828",
                    fontFamily: "Lato, sans-serif",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmt(secondaryValue)}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "#98a2b3",
                    fontFamily: "Lato, sans-serif",
                  }}
                >
                  {secondaryUnit}
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: "#a3a8b5", fontFamily: "Lato, sans-serif" }}>
                {secondaryLabel}
              </div>
            </div>

            {/* Secondary trend chip */}
            {secondaryTrend !== null && (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: TONES[toneFromTrend(secondaryTrend)].bg,
                  border: `1px solid ${TONES[toneFromTrend(secondaryTrend)].border}`,
                  color: TONES[toneFromTrend(secondaryTrend)].color,
                  borderRadius: 5,
                  padding: `${z(3)}px ${z(9)}px`,
                  fontFamily: "Lato, sans-serif",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {trendArrow(secondaryTrend)} {fmtTrend(secondaryTrend)}
              </div>
            )}
          </div>
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
          padding: `${z(7)}px ${z(16)}px ${z(7)}px ${z(22)}px`,
          borderRadius: "0 0 9px 9px",
        }}
      >
        <span style={{ fontSize: 11, color: "#667085", fontFamily: "Lato, sans-serif" }}>
          {mode === "fg"
            ? "Finished goods released to warehouse · pcs"
            : "Bulk output accepted this period · kg"}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "#a3a8b5",
            fontFamily: "Lato, sans-serif",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {mode === "fg"
            ? `Bulk: ${fmt(bulkQty)} kg`
            : `FG: ${fmt(fgQty)} pcs`}
        </span>
      </div>
    </div>
  );
}
