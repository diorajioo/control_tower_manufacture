"use client";

/**
 * Linear gauge: shows where the current avg gross lead time sits relative to the
 * 13-day target and the period max. Three zones:
 *   · Blue solid  — 0 → target (good zone)
 *   · Amber hatch — target → current (over-target, only when value > target)
 *   · Red hatch   — current → max (remaining range)
 */
export function LeadTimeLinearGauge({
  valueDays,
  targetDays,
  maxDays,
  unit = "days",
}: {
  valueDays:  number;
  targetDays: number;
  maxDays:    number;
  unit?:      "days" | "hours";
}) {
  if (valueDays <= 0 || maxDays <= 0) return null;

  const f          = unit === "hours" ? 24 : 1;
  const fmt        = (d: number) => unit === "hours" ? `${Math.round(d * f)}h` : `${(d * f).toFixed(2)} days`;
  const safeMax    = Math.max(maxDays, valueDays * 1.05, targetDays * 1.1);
  const targetPct  = Math.min((targetDays / safeMax) * 100, 100);
  const valuePct   = Math.min((valueDays  / safeMax) * 100, 100);
  const overTarget = valueDays > targetDays;
  const nowClr     = overTarget ? "#b91c1c" : "#067647";

  const blueW  = targetPct;
  const amberW = overTarget ? valuePct - targetPct : 0;
  const redW   = 100 - Math.max(valuePct, targetPct);

  return (
    <div style={{ marginTop: 10, marginBottom: 4, fontFamily: "Lato, sans-serif" }}>
      {/* Labels + triangles above bar */}
      <div style={{ position: "relative", height: 26 }}>
        <div style={{ position: "absolute", left: `${targetPct}%`, transform: "translateX(-50%)", bottom: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "#475569", fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.03em" }}>Target</span>
          <div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "5px solid #475569" }} />
        </div>
        <div style={{ position: "absolute", left: `${valuePct}%`, transform: "translateX(-50%)", bottom: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontSize: 9, color: nowClr, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.03em" }}>Now</span>
          <div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: `5px solid ${nowClr}` }} />
        </div>
        <div style={{ position: "absolute", right: 0, bottom: 0 }}>
          <span style={{ fontSize: 9, color: "#98a2b3", fontWeight: 700, letterSpacing: "0.03em" }}>Max</span>
        </div>
      </div>

      {/* Bar */}
      <div style={{ height: 8, borderRadius: 3, overflow: "hidden", display: "flex" }}>
        <div style={{ width: `${blueW}%`, background: "#1E4076", height: "100%", flexShrink: 0 }} />
        {amberW > 0 && (
          <div style={{
            width: `${amberW}%`, height: "100%", flexShrink: 0,
            background: "repeating-linear-gradient(45deg, #f59e0b 0px, #f59e0b 3px, #fef3c7 3px, #fef3c7 8px)",
          }} />
        )}
        {redW > 0 && (
          <div style={{
            width: `${redW}%`, height: "100%", flexShrink: 0,
            background: "repeating-linear-gradient(45deg, #f97316 0px, #f97316 3px, #fee2e2 3px, #fee2e2 8px)",
          }} />
        )}
      </div>

      {/* Value labels below bar */}
      <div style={{ position: "relative", height: 14, marginTop: 3 }}>
        <div style={{ position: "absolute", left: `${targetPct}%`, transform: "translateX(-50%)", fontSize: 9, color: "#475569", fontWeight: 700, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
          {fmt(targetDays)}
        </div>
        <div style={{ position: "absolute", left: `${valuePct}%`, transform: "translateX(-50%)", fontSize: 9, color: nowClr, fontWeight: 700, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
          {fmt(valueDays)}
        </div>
        <div style={{ position: "absolute", right: 0, fontSize: 9, color: "#98a2b3", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
          {fmt(safeMax)}
        </div>
      </div>
    </div>
  );
}
