"use client";

import React from "react";
import { ResponsiveLine } from "@nivo/line";
import { Info } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Lead Time category card — VA / NNVA / Waste / Potential Saving (/lead-time).
// Color is fixed per category (no status rules). Main number stays #101828.
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORY_TONES = {
  va:     { color: "#067647" },
  nnva:   { color: "#d97706" },
  waste:  { color: "#d92d20" },
  saving: { color: "#067647" },
} as const;

export type CategoryKey = keyof typeof CATEGORY_TONES;

export interface LeadTimeCategoryCardProps {
  category: CategoryKey;
  label: string;
  value: string;
  unit: string;
  /** Primary context line, e.g. "18% of total" */
  context: string;
  /** Secondary description line */
  description: string;
  /** Tooltip for the info icon — formula / definition */
  info: string;
  /** % change vs previous period; null = no prior data */
  trend?: number | null;
  /** Monthly series for the sparkline */
  series?: number[];
  noData?: boolean;
}

export function LeadTimeCategoryCard({
  category,
  label,
  value,
  unit,
  context,
  description,
  info,
  trend = null,
  series = [],
  noData = false,
}: LeadTimeCategoryCardProps) {
  const color = noData ? "#d0d5dd" : CATEGORY_TONES[category].color;

  const hasTrend  = trend !== null && trend !== undefined;
  const trendStr  = hasTrend ? `${trend! > 0 ? "↗" : trend! < 0 ? "↘" : "→"} ${trend! > 0 ? "+" : ""}${trend!.toFixed(1)}%` : "—";

  const nivoData = !noData && series.length >= 2
    ? [{ id: label, data: series.map((y, x) => ({ x, y })) }]
    : [];

  return (
    <div
      style={{
        height: "100%",
        background: "white",
        border: "1px solid #e9eaee",
        borderRadius: 8,
        display: "flex",
        overflow: "hidden",
        fontFamily: "Lato, sans-serif",
      }}
    >
      {/* Left accent bar */}
      <div style={{ width: 6, background: color, flexShrink: 0 }} />

      <div style={{ flex: 1, padding: "14px 16px 10px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>

        {/* Label + info */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: "0.11em", color: "#667085",
            textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {label}
          </span>
          <span title={info} style={{ display: "flex", flexShrink: 0, cursor: "help" }}>
            <Info size={12} color="#c0c5d0" strokeWidth={1.75} />
          </span>
        </div>

        {/* Value row */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" }}>
          <span style={{
            fontSize: 30, fontWeight: 700, letterSpacing: "-0.015em", lineHeight: 1,
            color: noData ? "#d0d5dd" : "#101828", fontVariantNumeric: "tabular-nums",
          }}>
            {noData ? "—" : value}
          </span>
          <span style={{ fontSize: 12, color: "#98a2b3" }}>{unit}</span>
          {!noData && (
            <span
              title="vs previous period"
              style={{ fontSize: 11, fontWeight: 700, color: hasTrend ? color : "#98a2b3", fontVariantNumeric: "tabular-nums" }}
            >
              {trendStr}
            </span>
          )}
        </div>

        {/* Context + description */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11.5, color: noData ? "#d0d5dd" : "#475467", fontVariantNumeric: "tabular-nums" }}>
            {noData ? "Data not available" : context}
          </span>
          <span style={{ fontSize: 11, color: "#98a2b3", lineHeight: 1.45 }}>{description}</span>
        </div>

        {/* Monthly sparkline */}
        {nivoData.length > 0 && (
          <div style={{ marginTop: "auto" }}>
            <div style={{ height: 30, borderTop: "1px solid #f2f3f6", paddingTop: 4 }}>
              <ResponsiveLine
                data={nivoData}
                margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
                curve="linear"
                enableArea
                areaOpacity={0.08}
                colors={[color]}
                lineWidth={1.4}
                enablePoints={false}
                enableGridX={false}
                enableGridY={false}
                axisLeft={null}
                axisBottom={null}
                yScale={{ type: "linear", min: "auto", max: "auto" }}
                isInteractive={false}
                animate={false}
              />
            </div>
            <div style={{ fontSize: 10, color: "#a3a8b5", textAlign: "right", marginTop: 2 }}>
              {series.length} months · monthly average
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
