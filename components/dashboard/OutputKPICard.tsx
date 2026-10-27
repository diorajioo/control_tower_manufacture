"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { KpiOneLiner } from "@/components/ui/KpiOneLiner";
import { Fade } from "@/components/ui/Fade";
import { KpiLabel, KpiTargetLine, StatusPill, KpiPriorLine, KpiSparkline, KpiFooter } from "@/components/ui/KpiCardParts";

// ---------------------------------------------------------------------------
// Status tone system
// ---------------------------------------------------------------------------

type ToneKey = "on" | "risk" | "off" | "neutral";
type ToneLabelKey = "status_on_track" | "status_at_risk" | "status_off_track" | "status_no_data";

const TONES: Record<ToneKey, { color: string; bg: string; border: string; labelKey: ToneLabelKey }> = {
  on:      { color: "#067647", bg: "#f0fdf6", border: "#bbf0d2", labelKey: "status_on_track"  },
  risk:    { color: "#b45309", bg: "#fffaeb", border: "#f0d58a", labelKey: "status_at_risk"   },
  off:     { color: "#d92d20", bg: "#fef4f3", border: "#fbd5d1", labelKey: "status_off_track" },
  neutral: { color: "#667085", bg: "#f8f9fb", border: "#e4e7ec", labelKey: "status_no_data"   },
};

function toneFromTrend(trend: number | null): ToneKey {
  if (trend === null) return "neutral";
  if (trend > 0)  return "on";
  if (trend >= -5) return "risk";
  return "off";
}

/** Output value in millions, 2 decimals (284,801,234 → "284.80"); the unit reads "million pcs" / "million kg"
 *  (word from i18n `unit_million` — "juta" in Indonesian; never abbreviated). */
function fmtMillions(n: number): string {
  return (n / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  /** KPI id whose AI one-liner (KpiOneLiner) shows as a bar below the status rows */
  insightId?:   string;
  /** Click on the sparkline → switch the trend chart to Output */
  onSparkClick?: () => void;
}

// ---------------------------------------------------------------------------
// Component — KPI Card standard (docs/UI_UX.md), blocks from KpiCardParts
// ---------------------------------------------------------------------------

export function OutputKPICard({
  fgQty,
  bulkQty,
  fgTrend,
  bulkTrend,
  sparkline,
  bulkSparkline,
  compact = false,
  insightId,
  onSparkClick,
}: OutputKPICardProps) {
  // Size scale for spacing/sparkline: 1 = regular, 0.8 = compact. Font sizes are always regular.
  const z = (n: number) => (compact ? Math.round(n * 0.8 * 2) / 2 : n);
  const [mode, setMode] = useState<"fg" | "bulk">("fg");
  const { t } = useI18n();

  const primaryValue = mode === "fg" ? fgQty     : bulkQty;
  const primaryUnit  = mode === "fg" ? "pcs"     : "kg";
  const primaryTrend = mode === "fg" ? fgTrend   : bulkTrend;
  const activeSparkline = mode === "fg" ? sparkline : bulkSparkline;

  const toneKey = toneFromTrend(primaryTrend);
  const tone = TONES[toneKey];
  const statusLabel = primaryTrend === null ? t("status_no_data") : t(tone.labelKey);

  return (
    <div style={{ background: "white", border: "1px solid #EBEBEB", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden", width: "100%", fontFamily: "Lato, sans-serif", height: "100%" }}>
      <div style={{ flex: 1, padding: `${z(14)}px ${z(16)}px 0`, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* ── Label ⓘ · toggle ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: z(12), minHeight: 24 }}>
          <KpiLabel
            label="Output"
            info={mode === "fg" ? "Finished goods released to warehouse, in pcs." : "Bulk output accepted this period, in kg. Plant filter does not apply (source has no plant column)."}
          />
          <div style={{ background: "#f2f3f6", borderRadius: 7, padding: z(3), display: "flex", gap: z(2) }}>
            {(["fg", "bulk"] as const).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  aria-pressed={active}
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
        </div>

        {/* ── Value · target · status · prior period | sparkline ── */}
        <div style={{ display: "flex", gap: z(16), alignItems: "flex-end", marginTop: z(8) }}>
          <Fade depKey={mode} className="flex-1 min-w-0">
            <div style={{ display: "flex", flexDirection: "column", gap: z(7), minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: z(6) }}>
                <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.015em", color: "#101828", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                  {fmtMillions(primaryValue)}
                </span>
                <span style={{ fontSize: 12, color: "#98a2b3" }} title={`${primaryValue.toLocaleString("en-US")} ${primaryUnit}`}>{t("unit_million")} {primaryUnit}</span>
              </div>
              {/* No output target in the data yet (theoretical output) — the line stays so the anatomy matches */}
              <KpiTargetLine text={t("label_target_undefined")} />
              <StatusPill color={tone.color} bg={tone.bg} border={tone.border} label={statusLabel} />
              <KpiPriorLine pct={primaryTrend} color={tone.color} />
            </div>
          </Fade>
          <KpiSparkline data={activeSparkline} caption={`${activeSparkline.length} weeks · ${primaryUnit}`} z={z} onClick={onSparkClick} label="Output" />
        </div>

        <KpiOneLiner id={insightId} z={z} />
        <div style={{ height: z(12) }} />
      </div>

      <KpiFooter z={z} />
    </div>
  );
}
