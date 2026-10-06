"use client";

import { useState } from "react";
import { ResponsiveLine } from "@nivo/line";
import { StatusDot } from "@/components/ui/StatusDot";
import { KpiOneLiner } from "@/components/ui/KpiOneLiner";
import { LEAD_TIME_TARGET_DAYS } from "@/lib/leadTimeDefinition";

const TARGET = LEAD_TIME_TARGET_DAYS;

const TONES = {
  on:      { color: "#067647", label: "On Track"    },
  risk:    { color: "#b45309", label: "At Risk"      },
  off:     { color: "#d92d20", label: "Above Target" },
  neutral: { color: "#667085", label: "No Data"      },
};

type ToneKey = "on" | "risk" | "off" | "neutral";

function toneFromDays(days: number, tgt = TARGET): ToneKey {
  if (days === 0) return "neutral";
  if (days <= tgt) return "on";
  if (days <= tgt * 1.15) return "risk";
  return "off";
}

function trendColor(trend: number | null): string {
  if (trend === null) return "#98a2b3";
  return trend <= 0 ? "#067647" : "#d92d20";
}
function trendArrow(trend: number | null): string {
  if (trend === null) return "→";
  return trend < 0 ? "↘" : trend > 0 ? "↗" : "→";
}
function trendLabel(trend: number | null): string {
  if (trend === null) return "—";
  return (trend > 0 ? "+" : "") + trend.toFixed(1) + "%";
}

function SegToggle<T extends string>({
  options, value, onChange, z,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  z: (n: number) => number;
}) {
  return (
    <div style={{ background: "#f2f3f6", borderRadius: 7, padding: z(3), display: "flex", gap: z(2) }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: `${z(4)}px ${z(10)}px`,
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
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export interface LeadTimeKPICardProps {
  compact?:        boolean;
  grossDays:       number;
  nettDays:        number;
  grossTrend:      number | null;
  nettTrend:       number | null;
  byPositionGross: { position: string; avgHours: number }[];
  sparkline:       number[];
  hasAlert?:       boolean;
  showBreakdown?:  boolean;
  basisOverride?:  "created" | "released";
  /** KPI id whose AI one-liner (KpiOneLiner) shows as a bar below the status row */
  insightId?:      string;
  /** KPI card standard: off — a card shows only its toggled value; true only for a documented exception */
  showSecondary?:  boolean;
}

export function LeadTimeKPICard({
  grossDays,
  nettDays,
  grossTrend,
  nettTrend,
  byPositionGross,
  sparkline,
  hasAlert,
  compact       = false,
  showBreakdown = true,
  basisOverride = "created",
  insightId,
  showSecondary = false,
}: LeadTimeKPICardProps) {
  const [unit, setUnit] = useState<"days" | "hours">("days");
  const [type, setType] = useState<"gross" | "nett">("gross");

  const z = (n: number) => (compact ? Math.round(n * 0.8 * 2) / 2 : n);

  const target = TARGET;

  const primaryDays    = type === "gross" ? grossDays  : nettDays;
  const primaryTrend   = type === "gross" ? grossTrend : nettTrend;
  const secondaryDays  = type === "gross" ? nettDays   : grossDays;
  const secondaryTrend = type === "gross" ? nettTrend  : grossTrend;

  const toDisp    = (d: number) => unit === "hours" ? d * 24 : d;
  const fmtVal    = (d: number) => unit === "hours"
    ? Math.round(toDisp(d)).toLocaleString("en-US")
    : toDisp(d).toFixed(2);
  const unitLabel = unit === "hours" ? "hours" : "days";

  // Delta vs target — always gross-based (target is defined on gross)
  const delta        = grossDays - target;
  const deltaPct     = target > 0 ? (delta / target) * 100 : 0;
  const deltaOver    = delta > 0;
  const deltaDisplay = unit === "hours" ? Math.round(Math.abs(delta) * 24).toString() : Math.abs(delta).toFixed(2);
  const targetDisp   = unit === "hours" ? (target * 24).toString() : target.toFixed(2);

  const tone = TONES[toneFromDays(grossDays, target)];

  const positions = byPositionGross ?? [];
  const maxHours  = positions[0]?.avgHours || 1;

  const hasSparkline = sparkline.length >= 2;
  const sparkData = hasSparkline
    ? [{ id: "leadtime", data: sparkline.map((y, i) => ({ x: i, y: unit === "hours" ? y * 24 : y })) }]
    : [];

  return (
    <div
      style={{
        background: "white",
        border: hasAlert ? "1px solid #fbd5d1" : "1px solid #EBEBEB",
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
              <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", color: "#64748b" }}>
                LEAD TIME
              </span>

              <div style={{ display: "flex", alignItems: "baseline", gap: z(6), flexWrap: "wrap" }}>
                <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.015em", color: "#101828", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                  {fmtVal(primaryDays)}
                </span>
                <span style={{ fontSize: 12, color: "#98a2b3" }}>{unitLabel}</span>
                {type === "gross" ? (
                  /* Delta vs target — always computable, shows ↗/↘ above/below */
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: deltaOver ? "#d92d20" : "#067647", fontVariantNumeric: "tabular-nums" }}>
                    {deltaOver ? "↗" : "↘"} {deltaOver ? "+" : "−"}{deltaDisplay} {unitLabel}
                  </span>
                ) : (
                  /* Nett has no target — show trend % vs prior period */
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: trendColor(primaryTrend), fontVariantNumeric: "tabular-nums" }}>
                    {trendArrow(primaryTrend)} {trendLabel(primaryTrend)}
                  </span>
                )}
              </div>

              {type === "gross" ? (
                <div style={{ fontSize: 11, color: "#98a2b3" }}>
                  vs target {targetDisp} {unitLabel} ({deltaOver ? "+" : ""}{deltaPct.toFixed(1)}%)
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "#98a2b3" }}>vs prior period</div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: z(8) }}>
                <StatusDot color={tone.color} label={tone.label} />
              </div>
            </div>

            {/* RIGHT column: toggles + sparkline */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: z(8) }}>
              <div style={{ display: "flex", gap: z(6) }}>
                <SegToggle
                  options={[{ label: "Days", value: "days" }, { label: "Hours", value: "hours" }]}
                  value={unit}
                  onChange={setUnit}
                  z={z}
                />
                <SegToggle
                  options={[{ label: "Gross", value: "gross" }, { label: "Nett", value: "nett" }]}
                  value={type}
                  onChange={setType}
                  z={z}
                />
              </div>

              {hasSparkline ? (
                <div style={{ width: z(150), height: z(42) }}>
                  <ResponsiveLine
                    data={sparkData}
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
                {hasSparkline ? `${sparkline.length} weeks · ${unitLabel}` : ""}
              </div>
            </div>
          </div>

          <KpiOneLiner id={insightId} z={z} />

          {/* ── Secondary metric row (the other toggle value — off by default, KPI card standard) ── */}
          {showSecondary ? (
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
                  <span style={{ fontSize: 20, fontWeight: 700, color: "#101828", fontVariantNumeric: "tabular-nums" }}>
                    {fmtVal(secondaryDays)}
                  </span>
                  <span style={{ fontSize: 11, color: "#98a2b3" }}>{unitLabel}</span>
                </div>
                <div style={{ fontSize: 10.5, color: "#a3a8b5" }}>
                  {type === "gross" ? "Nett" : "Gross"} lead time this period
                </div>
              </div>

              {secondaryTrend !== null && (
                <div style={{ fontSize: 11, fontWeight: 700, color: trendColor(secondaryTrend), borderRadius: 5, padding: `${z(3)}px ${z(9)}px`, fontVariantNumeric: "tabular-nums" }}>
                  {trendArrow(secondaryTrend)} {trendLabel(secondaryTrend)}
                </div>
              )}
            </div>
          ) : <div style={{ height: z(12) }} />}

          {/* Breakdown bars */}
          {showBreakdown && positions.length > 0 && (
            <div style={{ marginBottom: z(12), maxHeight: 63, overflowY: "auto", display: "flex", flexDirection: "column", gap: z(5) }}>
              {positions.map((p) => (
                <div key={p.position} style={{ display: "flex", alignItems: "center", gap: z(8) }}>
                  <span style={{ fontSize: 10, color: "#475569", width: z(90), flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.position}>
                    {p.position}
                  </span>
                  <div style={{ flex: 1, background: "#EEF4FB", borderRadius: 999, height: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "#1E4076", borderRadius: 999, width: `${(p.avgHours / maxHours) * 100}%` }} />
                  </div>
                  <span style={{ fontSize: 10, color: "#64748b", width: z(40), textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    {unit === "hours" ? `${Math.round(p.avgHours)}h` : `${(p.avgHours / 24).toFixed(2)}d`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          background: "white",
          borderTop: "1px solid #eceef2",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${z(7)}px ${z(16)}px`,
          borderRadius: "0 0 7px 7px",
        }}
      >
        <span style={{ fontSize: 11, color: "#667085" }}>
          {basisOverride === "released" ? "PO Released → Receive NDC" : "PO Created → Receive NDC"}
        </span>
        <span style={{ fontSize: 10, color: "#a3a8b5", fontVariantNumeric: "tabular-nums" }}>
          Target ≤ {target.toFixed(2)} days
        </span>
      </div>
    </div>
  );
}
