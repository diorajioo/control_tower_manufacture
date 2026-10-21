"use client";

import Link from "next/link";
import { ResponsiveLine } from "@nivo/line";
import { LineDraw } from "@/components/charts/LineDraw";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { useT } from "@/lib/i18n";

// Shared blocks for every KPI card (KPI Card standard, docs/UI_UX.md):
// label + ⓘ · value · target line · status pill · prior-period line · clickable sparkline · "Open page →" footer.
// LeadTimeKPICard, OutputKPICard and RegularKPICard all render these, so the anatomy stays identical.

export type Z = (n: number) => number;

const GRAY = "#98a2b3";

/** Card label (11.5 bold uppercase) with the ⓘ definition tooltip. */
export function KpiLabel({ label, info }: { label: string; info?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", color: "#64748b", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      {info && <InfoTooltip text={info} size={12} />}
    </div>
  );
}

/**
 * Gap to target on its own line: "−16.20 M pcs vs target 301.00 M pcs" (tone color),
 * or a gray "Target ≥ 65%" / "Target not defined" when there is no value or no target.
 */
export function KpiTargetLine({ delta, color, text }: { delta?: string; color?: string; text: string }) {
  return (
    <div style={{ fontSize: 11.5, color: GRAY, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {delta && <span style={{ fontWeight: 700, color }}>{delta} </span>}
      {text}
    </div>
  );
}

/** Status as a pill badge in the tone color. */
export function StatusPill({ color, bg, border, label }: { color: string; bg: string; border: string; label: string }) {
  return (
    <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700, color, background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: "2px 7px", lineHeight: "14px", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

/** "↑ 3.9% vs prior period" — tone color; gray "No prior period data" when there is no comparison. */
export function KpiPriorLine({ pct, color, suffix }: { pct: number | null; color: string; suffix?: string }) {
  const { t } = useT();
  if (pct === null) return <div style={{ fontSize: 11, color: GRAY }}>{t("empty_no_data")}</div>;
  const arrow = pct > 0 ? "↑" : pct < 0 ? "↓" : "→";
  return (
    <div style={{ fontSize: 11, color: GRAY, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      <span style={{ fontWeight: 700, color }}>{arrow} {Math.abs(pct).toFixed(1)}%</span> {t("label_vs_prior")}{suffix ? ` ${suffix}` : ""}
    </div>
  );
}

/**
 * Navy sparkline (150×42, ×0.8 compact). With `onClick` it is a button: clicking it switches the
 * Overview / Monitor trend chart to this KPI.
 */
export function KpiSparkline({ data, caption, z, onClick, label }: {
  data: number[];
  caption: string;
  z: Z;
  onClick?: () => void;
  label: string;
}) {
  const has = data.length >= 2;
  const nivoData = has ? [{ id: label, data: data.map((y, i) => ({ x: i, y })) }] : [];
  const body = (
    <>
      <div style={{ width: z(150), height: z(42), display: "flex", alignItems: "center", justifyContent: "center" }}>
        {has ? (
          <div style={{ width: "100%", height: "100%" }}>
            <LineDraw drawKey={JSON.stringify(nivoData)} duration={600}>
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
            </LineDraw>
          </div>
        ) : (
          <span style={{ fontSize: 10, color: "#c5cad8" }}>no sparkline data</span>
        )}
      </div>
      <div style={{ fontSize: 10, color: "#a3a8b5", textAlign: "right", minHeight: 12 }}>{has ? caption : ""}</div>
    </>
  );
  if (!onClick || !has) return <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      title="Show in trend chart"
      aria-label={`Show ${label} in the trend chart`}
      className="kpi-spark"
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, background: "transparent", border: "none", borderRadius: 6, padding: 3, margin: -3, cursor: "pointer", fontFamily: "inherit" }}
    >
      {body}
    </button>
  );
}

/** Footer: "Open page →" link to the KPI's detail page, or a muted note when the page does not exist yet. */
export function KpiFooter({ href, right, z }: { href?: string; right?: string; z: Z }) {
  const { t } = useT();
  return (
    <div style={{ background: "white", borderTop: "1px solid #eceef2", display: "flex", alignItems: "center", justifyContent: "space-between", gap: z(8), padding: `${z(7)}px ${z(16)}px`, borderRadius: "0 0 7px 7px" }}>
      {href ? (
        <Link href={href} className="kpi-open-link" style={{ fontSize: 11.5, fontWeight: 700, color: "#1E4076", textDecoration: "none", whiteSpace: "nowrap" }}>
          {t("action_open_page")} →
        </Link>
      ) : (
        <span style={{ fontSize: 11, color: "#a3a8b5", whiteSpace: "nowrap" }}>—</span>
      )}
      {right && <span style={{ fontSize: 10, color: "#a3a8b5", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{right}</span>}
    </div>
  );
}
