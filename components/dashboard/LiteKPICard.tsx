"use client";

import React from "react";
import { ResponsiveLine } from "@nivo/line";

// ─────────────────────────────────────────────────────────────────────────────
// Tone system
// ─────────────────────────────────────────────────────────────────────────────

type ToneKey = "on" | "risk" | "off";

const TONES: Record<ToneKey, {
  color: string; bg: string; border: string; fill: string;
  icon: string; label: string; trend: string;
}> = {
  on:   { color: "#067647", bg: "#f0fdf6", border: "#bbf0d2", fill: "rgba(6,118,71,.08)",   icon: "↑", label: "On Track",  trend: "↗" },
  risk: { color: "#b45309", bg: "#fffaeb", border: "#f0d58a", fill: "rgba(180,83,9,.08)",   icon: "!", label: "At Risk",   trend: "→" },
  off:  { color: "#d92d20", bg: "#fef4f3", border: "#fbd5d1", fill: "rgba(217,45,32,.08)", icon: "↓", label: "Off Track", trend: "↘" },
};

export type StatusOverride = "Auto" | "On Track" | "At Risk" | "Off Track";

function toneFromAttainment(attainment: number, override?: StatusOverride): ToneKey {
  if (override === "On Track")  return "on";
  if (override === "At Risk")   return "risk";
  if (override === "Off Track") return "off";
  if (attainment >= 100) return "on";
  if (attainment >= 95)  return "risk";
  return "off";
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface LiteKPICardProps {
  label: string;
  value: string;
  unit: string;
  target: string;
  attainment: number;
  trend?: number | null;
  series?: number[];
  status?: StatusOverride;
  noData?: boolean;
  icon?: React.ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function LiteKPICard({
  label,
  value,
  unit,
  target,
  attainment,
  trend,
  series = [],
  status,
  noData = false,
  icon,
}: LiteKPICardProps) {
  const toneKey  = toneFromAttainment(attainment, status);
  const tone     = TONES[toneKey];

  // trend prop overrides attainment-derived delta for display only
  const hasTrend  = trend !== undefined && trend !== null;
  const delta     = hasTrend ? trend! : attainment - 100;
  const deltaStr  = hasTrend && trend === null ? "—" : (delta >= 0 ? "+" : "") + delta.toFixed(1) + "%";
  const deltaColor = hasTrend && trend === null ? "#98a2b3" : tone.color;
  const deltaArrow = hasTrend && trend === null ? "" : tone.trend + " ";

  const barPct   = Math.min(100, Math.max(0, attainment));
  const pctStr   = attainment.toFixed(1) + "% of target";

  const tooltip  = `${label} · ${value} ${unit} · target ${target} · attainment ${attainment.toFixed(1)}% · ${tone.label}`;

  const nivoData = !noData && series.length >= 2
    ? [{ id: label, data: series.map((y, x) => ({ x, y })) }]
    : [];

  const accentColor = noData ? "#d0d5dd" : tone.color;

  return (
    <div
      title={noData ? label : tooltip}
      style={{
        maxWidth: "100%",
        background: "white",
        border: "1px solid #e9eaee",
        borderRadius: 8,
        display: "flex",
        overflow: "hidden",
        fontFamily: "Lato, sans-serif",
      }}
    >
      {/* Left accent bar */}
      <div style={{ width: 6, background: accentColor, flexShrink: 0 }} />

      {/* Content */}
      <div style={{
        flex: 1,
        padding: "11px 12px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 7,
        minWidth: 0,
      }}>

        {/* 1. Label */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          overflow: "hidden",
        }}>
          {icon && <span style={{ flexShrink: 0, display: "flex" }}>{icon}</span>}
          <span style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.1em",
            color: "#8a90a0",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>{label}</span>
        </div>

        {noData ? (
          /* No-data state */
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" }}>
              <span style={{
                fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em",
                lineHeight: 1, color: "#d0d5dd", fontVariantNumeric: "tabular-nums",
              }}>
                —
              </span>
              <span style={{ fontSize: 11, color: "#d0d5dd" }}>{unit}</span>
            </div>
            <div style={{ fontSize: 11, color: "#d0d5dd" }}>Data not available</div>
            <div>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                border: "1px solid #e4e7ec", background: "#f8f9fb",
                color: "#98a2b3", borderRadius: 4, padding: "2px 7px",
                fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
              }}>
                — No Data
              </span>
            </div>
          </>
        ) : (
          <>
            {/* 2. Value row */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" }}>
              <span style={{
                fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em",
                lineHeight: 1, color: "#101828", fontVariantNumeric: "tabular-nums",
              }}>
                {value}
              </span>
              <span style={{ fontSize: 11, color: "#98a2b3" }}>{unit}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, color: deltaColor,
                fontVariantNumeric: "tabular-nums",
              }}>
                {deltaArrow}{deltaStr}
              </span>
            </div>

            {/* 3. vs target */}
            <div style={{
              fontSize: 11, color: "#667085",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              vs target {target}
            </div>

            {/* 4. Status pill */}
            <div>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                border: `1px solid ${tone.border}`,
                background: tone.bg,
                color: tone.color,
                borderRadius: 4,
                padding: "2px 7px",
                fontSize: 10,
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}>
                {tone.icon} {tone.label}
              </span>
            </div>

            {/* 5. Attainment bar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ height: 5, background: "#eef0f3", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  width: `${barPct}%`, height: "100%",
                  background: tone.color, borderRadius: 3,
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 9.5, color: "#98a2b3", fontFamily: "monospace" }}>{pctStr}</span>
                <span style={{ fontSize: 9.5, color: "#98a2b3", fontFamily: "monospace" }}>100%</span>
              </div>
            </div>

            {/* 6. Sparkline */}
            {nivoData.length > 0 && (
              <div style={{ height: 28, borderTop: "1px solid #f2f3f6", paddingTop: 4 }}>
                <ResponsiveLine
                  data={nivoData}
                  margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
                  curve="linear"
                  enableArea
                  areaOpacity={0.08}
                  colors={[tone.color]}
                  lineWidth={1.4}
                  enablePoints={false}
                  enableGridX={false}
                  enableGridY={false}
                  axisLeft={null}
                  axisBottom={null}
                  yScale={{ type: "linear", min: "auto", max: "auto" }}
                  isInteractive={false}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
