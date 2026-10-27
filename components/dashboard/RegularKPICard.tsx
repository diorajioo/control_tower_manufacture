"use client";

import type { ReactNode } from "react";
import { KpiOneLiner } from "@/components/ui/KpiOneLiner";
import { Fade } from "@/components/ui/Fade";
import { KpiLabel, KpiTargetLine, StatusPill, KpiPriorLine, KpiSparkline, KpiFooter } from "@/components/ui/KpiCardParts";
import { useT } from "@/lib/i18n";

// ─────────────────────────────────────────────────────────────────────────────
// Regular KPI card — generic version of the KPI Card standard (docs/UI_UX.md):
// label ⓘ + toggle · value · target line · status pill · prior-period line · sparkline (click → trend chart)
// · AI one-liner · "Open page →" footer. Same blocks as OutputKPICard / LeadTimeKPICard (KpiCardParts).
// `compact` shrinks padding/gaps/sparkline to ≈80% (fonts stay regular).
// ─────────────────────────────────────────────────────────────────────────────

type ToneLabelKey = "status_on_track" | "status_at_risk" | "status_off_track" | "status_no_data";

const TONES = {
  on:      { color: "#067647", bg: "#f0fdf6", border: "#bbf0d2", labelKey: "status_on_track"  as ToneLabelKey },
  risk:    { color: "#b45309", bg: "#fffaeb", border: "#f0d58a", labelKey: "status_at_risk"   as ToneLabelKey },
  off:     { color: "#d92d20", bg: "#fef4f3", border: "#fbd5d1", labelKey: "status_off_track" as ToneLabelKey },
  neutral: { color: "#667085", bg: "#f8f9fb", border: "#e4e7ec", labelKey: "status_no_data"   as ToneLabelKey },
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

export interface RegularKPICardProps {
  /** Not rendered (KPI card standard: no icon next to the label); kept so callers need no change */
  icon?: ReactNode;
  label: string;
  /** Definition / basis / data source, shown in the ⓘ tooltip next to the label */
  info?: string;
  value: string;
  unit: string;
  /** % change vs prior period; null = no prior data */
  trend?: number | null;
  /** Lower is better (e.g. Yield Loss) — flips the trend tone */
  inverse?: boolean;
  /** Target line, e.g. "Target ≥ 65%" or "Target not defined" */
  targetText: string;
  /** Text after "vs prior period", e.g. the prior value "(12.3)" */
  priorSuffix?: string;
  sparkline?: number[];
  sparkUnit?: string;
  /** Click on the sparkline → switch the trend chart to this KPI */
  onSparkClick?: () => void;
  /** Detail page for the footer "Open page →" link */
  href?: string;
  footerRight?: string;
  noData?: boolean;
  compact?: boolean;
  /** Optional control top right (e.g. a SegmentedToggle) */
  toggle?: ReactNode;
  /** KPI id whose AI one-liner (KpiOneLiner) shows as a bar below the status rows */
  insightId?: string;
}

export function RegularKPICard({
  label,
  info,
  value,
  unit,
  trend = null,
  inverse = false,
  targetText,
  priorSuffix,
  sparkline = [],
  sparkUnit,
  onSparkClick,
  href,
  footerRight,
  noData = false,
  compact = false,
  toggle,
  insightId,
}: RegularKPICardProps) {
  const { t } = useT();
  // Size scale for spacing/sparkline: 1 = regular, 0.8 = compact. Font sizes are always regular.
  const z = (n: number) => (compact ? Math.round(n * 0.8 * 2) / 2 : n);

  const tone = TONES[noData ? "neutral" : toneFromTrend(trend, inverse)];
  // Value exists but the prior period is empty (trend = null) → not "No Data"
  const statusLabel = !noData && trend === null ? t("status_no_data") : t(tone.labelKey);
  const spark = noData ? [] : sparkline;

  return (
    <div style={{ background: "white", border: "1px solid #EBEBEB", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden", width: "100%", fontFamily: "Lato, sans-serif", height: "100%" }}>
      <div style={{ flex: 1, padding: `${z(14)}px ${z(16)}px 0`, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* ── Label ⓘ · toggle ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: z(12), minHeight: 24 }}>
          <KpiLabel label={label} info={info} />
          {toggle}
        </div>

        {/* ── Value · target · status · prior period | sparkline ── */}
        <div style={{ display: "flex", gap: z(16), alignItems: "flex-end", marginTop: z(8) }}>
          <Fade depKey={value} className="flex-1 min-w-0">
            <div style={{ display: "flex", flexDirection: "column", gap: z(7), minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: z(6) }}>
                <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.015em", color: noData ? "#d0d5dd" : "#101828", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                  {noData ? "—" : value}
                </span>
                <span style={{ fontSize: 12, color: "#98a2b3" }}>{unit}</span>
              </div>
              <KpiTargetLine text={targetText} />
              <StatusPill color={tone.color} bg={tone.bg} border={tone.border} label={statusLabel} />
              {/* No-data cards keep every row (same format as data cards) */}
              <KpiPriorLine pct={noData ? null : trend} color={tone.color} suffix={priorSuffix} />
            </div>
          </Fade>
          <KpiSparkline data={spark} caption={`${spark.length} weeks · ${sparkUnit ?? unit}`} z={z} onClick={onSparkClick} label={label} />
        </div>

        <KpiOneLiner id={insightId} z={z} />
        <div style={{ height: z(12) }} />
      </div>

      <KpiFooter href={href} right={footerRight} z={z} />
    </div>
  );
}
