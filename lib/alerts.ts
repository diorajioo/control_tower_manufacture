import { ALERT_KPIS } from "@/lib/aiScope";
import { LEAD_TIME_TARGET_DAYS } from "@/lib/leadTimeDefinition";

export type AlertSeverity = "critical" | "warning" | "info";

export interface KPIAlert {
  id: string;
  kpi: string;
  message: string;
  severity: AlertSeverity;
  value: number | null;
  trend: number | null;
  threshold: string;
  dismissedAt?: number;
}

interface KPISnapshot {
  leadTime: { value: number; trend: number | null };
  yield: { bulkLossPct: number; packLossPct: number; bulkLossTrend: number | null; packLossTrend: number | null };
  rightFirstTime: { value: number; trend: number | null };
  oee: { value: number; trend: number | null };
}

const THRESHOLDS = {
  leadTime: {
    warning: 5,    // +5% MoM increase
    critical: 15,  // +15% MoM increase
    // Absolute vs target — fires even when trend is null (e.g. YTD with no prior period)
    absWarningMult: 1.0,   // > 13d = warning
    absCriticalMult: 1.3,  // > 16.9d = critical
  },
  bulkLoss: {
    absWarning: 3,    // > 3% bulk loss absolute
    absCritical: 5,
    trendWarning: 10, // +10% MoM worsening
  },
  packLoss: {
    absWarning: 1,    // > 1% pack loss
    absCritical: 2,
  },
  rft: {
    warning: 95,      // below 95%
    critical: 90,
  },
  oee: {
    warning: 65,      // below 65%
    critical: 55,
  },
};

export function computeAlerts(kpi: KPISnapshot): KPIAlert[] {
  const alerts: KPIAlert[] = [];

  // Lead Time alert — absolute value vs target (fires regardless of trend/period)
  const ltAbsCritical = LEAD_TIME_TARGET_DAYS * THRESHOLDS.leadTime.absCriticalMult;
  const ltAbsWarning  = LEAD_TIME_TARGET_DAYS * THRESHOLDS.leadTime.absWarningMult;
  const trendSuffix = kpi.leadTime.trend != null ? `, up ${Math.abs(kpi.leadTime.trend).toFixed(1)}% vs prior` : "";
  if (kpi.leadTime.value > ltAbsCritical) {
    alerts.push({
      id: "leadtime-critical",
      kpi: "Lead Time",
      severity: "critical",
      message: `Lead time ${kpi.leadTime.value.toFixed(1)}d — ${((kpi.leadTime.value / LEAD_TIME_TARGET_DAYS - 1) * 100).toFixed(0)}% above ${LEAD_TIME_TARGET_DAYS}-day target${trendSuffix}`,
      value: kpi.leadTime.value,
      trend: kpi.leadTime.trend,
      threshold: `>${ltAbsCritical.toFixed(0)}d`,
    });
  } else if (kpi.leadTime.value > ltAbsWarning) {
    alerts.push({
      id: "leadtime-warning",
      kpi: "Lead Time",
      severity: "warning",
      message: `Lead time ${kpi.leadTime.value.toFixed(1)}d — above ${LEAD_TIME_TARGET_DAYS}-day target${trendSuffix}`,
      value: kpi.leadTime.value,
      trend: kpi.leadTime.trend,
      threshold: `>${LEAD_TIME_TARGET_DAYS}d`,
    });
  }

  // Bulk Loss alerts
  if (kpi.yield.bulkLossPct > THRESHOLDS.bulkLoss.absCritical) {
    alerts.push({
      id: "bulkloss-critical",
      kpi: "Bulk Loss",
      severity: "critical",
      message: `Bulk loss ${kpi.yield.bulkLossPct.toFixed(1)}% — well above 3% target`,
      value: kpi.yield.bulkLossPct,
      trend: kpi.yield.bulkLossTrend,
      threshold: `>${THRESHOLDS.bulkLoss.absCritical}%`,
    });
  } else if (kpi.yield.bulkLossPct > THRESHOLDS.bulkLoss.absWarning) {
    alerts.push({
      id: "bulkloss-warning",
      kpi: "Bulk Loss",
      severity: "warning",
      message: `Bulk loss ${kpi.yield.bulkLossPct.toFixed(1)}% — above 3% target`,
      value: kpi.yield.bulkLossPct,
      trend: kpi.yield.bulkLossTrend,
      threshold: `>${THRESHOLDS.bulkLoss.absWarning}%`,
    });
  }

  // Pack Loss alerts
  if (kpi.yield.packLossPct > THRESHOLDS.packLoss.absCritical) {
    alerts.push({
      id: "packloss-critical",
      kpi: "Pack Loss",
      severity: "critical",
      message: `Pack loss ${kpi.yield.packLossPct.toFixed(1)}% — well above 1% target`,
      value: kpi.yield.packLossPct,
      trend: kpi.yield.packLossTrend,
      threshold: `>${THRESHOLDS.packLoss.absCritical}%`,
    });
  } else if (kpi.yield.packLossPct > THRESHOLDS.packLoss.absWarning) {
    alerts.push({
      id: "packloss-warning",
      kpi: "Pack Loss",
      severity: "warning",
      message: `Pack loss ${kpi.yield.packLossPct.toFixed(1)}% — above 1% target`,
      value: kpi.yield.packLossPct,
      trend: kpi.yield.packLossTrend,
      threshold: `>${THRESHOLDS.packLoss.absWarning}%`,
    });
  }

  // RFT alerts
  if (kpi.rightFirstTime.value < THRESHOLDS.rft.critical) {
    alerts.push({
      id: "rft-critical",
      kpi: "Right First Time",
      severity: "critical",
      message: `RFT ${kpi.rightFirstTime.value.toFixed(1)}% — well below 95% target`,
      value: kpi.rightFirstTime.value,
      trend: kpi.rightFirstTime.trend,
      threshold: `<${THRESHOLDS.rft.critical}%`,
    });
  } else if (kpi.rightFirstTime.value < THRESHOLDS.rft.warning) {
    alerts.push({
      id: "rft-warning",
      kpi: "Right First Time",
      severity: "warning",
      message: `RFT ${kpi.rightFirstTime.value.toFixed(1)}% — below 95% target`,
      value: kpi.rightFirstTime.value,
      trend: kpi.rightFirstTime.trend,
      threshold: `<${THRESHOLDS.rft.warning}%`,
    });
  }

  // OEE alerts
  if (kpi.oee.value < THRESHOLDS.oee.critical) {
    alerts.push({
      id: "oee-critical",
      kpi: "OEE",
      severity: "critical",
      message: `OEE ${kpi.oee.value.toFixed(1)}% — well below 65% target`,
      value: kpi.oee.value,
      trend: kpi.oee.trend,
      threshold: `<${THRESHOLDS.oee.critical}%`,
    });
  } else if (kpi.oee.value < THRESHOLDS.oee.warning) {
    alerts.push({
      id: "oee-warning",
      kpi: "OEE",
      severity: "warning",
      message: `OEE ${kpi.oee.value.toFixed(1)}% — below 65% target`,
      value: kpi.oee.value,
      trend: kpi.oee.trend,
      threshold: `<${THRESHOLDS.oee.warning}%`,
    });
  }

  // Only KPIs with data on a page raise alerts (see lib/aiScope.ts)
  return alerts.filter((a) => ALERT_KPIS.has(a.kpi));
}

/** Alerts from a /api/dashboard/kpi snapshot — the dashboard and the scheduled Teams runner use the same mapping. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function alertsFromKpi(kpi: any): KPIAlert[] {
  return computeAlerts({
    leadTime:       { value: kpi.leadTime?.grossDays ?? 0, trend: kpi.leadTime?.grossTrend ?? null },
    yield:          { bulkLossPct: kpi.yield?.bulkLossPct ?? 0, packLossPct: kpi.yield?.packLossPct ?? 0, bulkLossTrend: kpi.yield?.bulkLossTrend ?? null, packLossTrend: kpi.yield?.packLossTrend ?? null },
    rightFirstTime: { value: kpi.rightFirstTime?.value ?? 100, trend: kpi.rightFirstTime?.trend ?? null },
    oee:            { value: kpi.oee?.value ?? 100, trend: kpi.oee?.trend ?? null },
  });
}
