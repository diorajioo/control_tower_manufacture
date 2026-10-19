"use client";

import { useState } from "react";
import { KpiOneLiner } from "@/components/ui/KpiOneLiner";
import { Fade } from "@/components/ui/Fade";
import { KpiLabel, KpiTargetLine, StatusPill, KpiPriorLine, KpiSparkline, KpiFooter } from "@/components/ui/KpiCardParts";
import { LEAD_TIME_TARGET_DAYS } from "@/lib/leadTimeDefinition";
import { useT } from "@/lib/i18n";

const TARGET = LEAD_TIME_TARGET_DAYS;

type ToneKey = "on" | "risk" | "off" | "neutral";
type ToneLabelKey = "status_on_track" | "status_at_risk" | "status_off_track" | "status_no_data";

const TONES: Record<ToneKey, { color: string; bg: string; border: string; labelKey: ToneLabelKey }> = {
  on:      { color: "#067647", bg: "#f0fdf6", border: "#bbf0d2", labelKey: "status_on_track"  },
  risk:    { color: "#b45309", bg: "#fffaeb", border: "#f0d58a", labelKey: "status_at_risk"   },
  off:     { color: "#d92d20", bg: "#fef4f3", border: "#fbd5d1", labelKey: "status_off_track" },
  neutral: { color: "#667085", bg: "#f8f9fb", border: "#e4e7ec", labelKey: "status_no_data"   },
};

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
  /** KPI id whose AI one-liner (KpiOneLiner) shows as a bar below the status rows */
  insightId?:      string;
  /** Click on the sparkline → switch the trend chart to Lead Time */
  onSparkClick?:   () => void;
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
  onSparkClick,
}: LeadTimeKPICardProps) {
  const { t } = useT();
  const [unit, setUnit] = useState<"days" | "hours">("days");
  const [type, setType] = useState<"gross" | "nett">("gross");

  const z = (n: number) => (compact ? Math.round(n * 0.8 * 2) / 2 : n);

  const target = TARGET;

  const primaryDays    = type === "gross" ? grossDays  : nettDays;
  const primaryTrend   = type === "gross" ? grossTrend : nettTrend;

  const toDisp    = (d: number) => unit === "hours" ? d * 24 : d;
  const fmtVal    = (d: number) => unit === "hours"
    ? Math.round(toDisp(d)).toLocaleString("en-US")
    : toDisp(d).toFixed(2);
  const unitLabel = unit === "hours" ? t("toggle_hours").toLowerCase() : t("toggle_days").toLowerCase();

  // Delta vs target — always gross-based (target is defined on gross)
  const delta        = grossDays - target;
  const deltaPct     = target > 0 ? (delta / target) * 100 : 0;
  const deltaOver    = delta > 0;
  const deltaDisplay = unit === "hours" ? Math.round(Math.abs(delta) * 24).toString() : Math.abs(delta).toFixed(2);
  const targetDisp   = unit === "hours" ? (target * 24).toString() : target.toFixed(2);

  const tone = TONES[toneFromDays(grossDays, target)];

  const positions = byPositionGross ?? [];
  const maxHours  = positions[0]?.avgHours || 1;

  return (
    <div style={{ background: "white", border: hasAlert ? "1px solid #fbd5d1" : "1px solid #EBEBEB", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden", width: "100%", fontFamily: "Lato, sans-serif", height: "100%" }}>
      <div style={{ display: "flex", flex: 1 }}>
        <div style={{ flex: 1, padding: `${z(14)}px ${z(16)}px 0`, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* ── Label ⓘ · toggles ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: z(12), minHeight: 24 }}>
            <KpiLabel
              label="Lead Time"
              info={`${type === "gross" ? "Gross" : "Nett"} lead time per PO, ${basisOverride === "released" ? "PO Released" : "PO Created"} → Receive NDC. Target ≤ ${target} days is defined on gross.`}
            />
            <div style={{ display: "flex", gap: z(6) }}>
              <SegToggle
                options={[{ label: t("toggle_days"), value: "days" }, { label: t("toggle_hours"), value: "hours" }]}
                value={unit}
                onChange={setUnit}
                z={z}
              />
              <SegToggle
                options={[{ label: t("toggle_gross"), value: "gross" }, { label: t("toggle_nett"), value: "nett" }]}
                value={type}
                onChange={setType}
                z={z}
              />
            </div>
          </div>

          {/* ── Value · target · status · prior period | sparkline ── */}
          <div style={{ display: "flex", gap: z(16), alignItems: "flex-end", marginTop: z(8) }}>
            <Fade depKey={`${type}-${unit}`} className="flex-1 min-w-0">
              <div style={{ display: "flex", flexDirection: "column", gap: z(7), minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: z(6) }}>
                  <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.015em", color: "#101828", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                    {fmtVal(primaryDays)}
                  </span>
                  <span style={{ fontSize: 12, color: "#98a2b3" }}>{unitLabel}</span>
                </div>
                {type === "gross" ? (
                  <KpiTargetLine
                    delta={`${deltaOver ? "+" : "−"}${deltaDisplay} ${unitLabel}`}
                    color={deltaOver ? "#d92d20" : "#067647"}
                    text={`vs target ${targetDisp} ${unitLabel} (${deltaOver ? "+" : ""}${deltaPct.toFixed(1)}%)`}
                  />
                ) : (
                  <KpiTargetLine
                    delta={`−${unit === "hours" ? Math.round((grossDays - nettDays) * 24).toString() : (grossDays - nettDays).toFixed(2)} ${unitLabel}`}
                    color="#667085"
                    text={`vs gross ${fmtVal(grossDays)} ${unitLabel} (non-process time)`}
                  />
                )}
                <StatusPill color={tone.color} bg={tone.bg} border={tone.border} label={t(tone.labelKey)} />
                <KpiPriorLine pct={primaryTrend} color={trendColor(primaryTrend)} />
              </div>
            </Fade>
            <KpiSparkline
              data={sparkline.map((y) => (unit === "hours" ? y * 24 : y))}
              caption={type === "nett" ? `Gross · ${sparkline.length} wks` : `${sparkline.length} weeks · ${unitLabel}`}
              z={z}
              onClick={onSparkClick}
              label="Lead Time"
            />
          </div>

          <KpiOneLiner id={insightId} z={z} />
          <div style={{ height: z(12) }} />

          {/* Breakdown bars */}
          {showBreakdown && positions.length > 0 && (
            <div style={{ marginBottom: z(12), maxHeight: 63, overflowY: "auto", display: "flex", flexDirection: "column", gap: z(5) }}>
              {positions.map((p) => (
                <div key={p.position} style={{ display: "flex", alignItems: "center", gap: z(8) }}>
                  <span style={{ fontSize: 10, color: "#475569", width: z(90), flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.position}>
                    {p.position}
                  </span>
                  <div style={{ flex: 1, position: "relative" }}>
                    <div style={{ background: "#EEF4FB", borderRadius: 999, height: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: "#1E4076", borderRadius: 999, width: `${(p.avgHours / maxHours) * 100}%` }} />
                    </div>
                    <div
                      title={unit === "hours" ? `${Math.round(p.avgHours)}h` : `${(p.avgHours / 24).toFixed(2)}d`}
                      style={{ position: "absolute", top: "100%", left: `${(p.avgHours / maxHours) * 100}%`, transform: "translateX(-50%)", marginTop: 1, width: 0, height: 0, borderLeft: "3px solid transparent", borderRight: "3px solid transparent", borderTop: "4px solid #1E4076" }}
                    />
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

      <KpiFooter href="/lead-time" right={`${t("label_target")} ≤ ${target.toFixed(2)} ${t("toggle_days").toLowerCase()}`} z={z} />
    </div>
  );
}
