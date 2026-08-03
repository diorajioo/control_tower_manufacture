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
    // trend is inverted (positive = got worse = lead time increased)
    warning: 5,   // +5% increase in lead time
    critical: 15,
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

  // Lead Time alert (positive trend = got worse because lead time went up)
  const leadTimeTrendWorse = kpi.leadTime.trend != null ? -kpi.leadTime.trend : null;
  if (leadTimeTrendWorse != null && leadTimeTrendWorse < -THRESHOLDS.leadTime.critical) {
    alerts.push({
      id: "leadtime-critical",
      kpi: "Lead Time",
      severity: "critical",
      message: `Lead time naik ${Math.abs(leadTimeTrendWorse).toFixed(1)}% vs periode sebelumnya`,
      value: kpi.leadTime.value,
      trend: kpi.leadTime.trend,
      threshold: `>${THRESHOLDS.leadTime.critical}% increase`,
    });
  } else if (leadTimeTrendWorse != null && leadTimeTrendWorse < -THRESHOLDS.leadTime.warning) {
    alerts.push({
      id: "leadtime-warning",
      kpi: "Lead Time",
      severity: "warning",
      message: `Lead time naik ${Math.abs(leadTimeTrendWorse).toFixed(1)}% vs periode sebelumnya`,
      value: kpi.leadTime.value,
      trend: kpi.leadTime.trend,
      threshold: `>${THRESHOLDS.leadTime.warning}% increase`,
    });
  }

  // Bulk Loss alerts
  if (kpi.yield.bulkLossPct > THRESHOLDS.bulkLoss.absCritical) {
    alerts.push({
      id: "bulkloss-critical",
      kpi: "Bulk Loss",
      severity: "critical",
      message: `Bulk loss ${kpi.yield.bulkLossPct.toFixed(1)}% — jauh di atas target 3%`,
      value: kpi.yield.bulkLossPct,
      trend: kpi.yield.bulkLossTrend,
      threshold: `>${THRESHOLDS.bulkLoss.absCritical}%`,
    });
  } else if (kpi.yield.bulkLossPct > THRESHOLDS.bulkLoss.absWarning) {
    alerts.push({
      id: "bulkloss-warning",
      kpi: "Bulk Loss",
      severity: "warning",
      message: `Bulk loss ${kpi.yield.bulkLossPct.toFixed(1)}% — di atas target 3%`,
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
      message: `Pack loss ${kpi.yield.packLossPct.toFixed(1)}% — jauh di atas target 1%`,
      value: kpi.yield.packLossPct,
      trend: kpi.yield.packLossTrend,
      threshold: `>${THRESHOLDS.packLoss.absCritical}%`,
    });
  } else if (kpi.yield.packLossPct > THRESHOLDS.packLoss.absWarning) {
    alerts.push({
      id: "packloss-warning",
      kpi: "Pack Loss",
      severity: "warning",
      message: `Pack loss ${kpi.yield.packLossPct.toFixed(1)}% — di atas target 1%`,
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
      message: `RFT ${kpi.rightFirstTime.value.toFixed(1)}% — jauh di bawah target 95%`,
      value: kpi.rightFirstTime.value,
      trend: kpi.rightFirstTime.trend,
      threshold: `<${THRESHOLDS.rft.critical}%`,
    });
  } else if (kpi.rightFirstTime.value < THRESHOLDS.rft.warning) {
    alerts.push({
      id: "rft-warning",
      kpi: "Right First Time",
      severity: "warning",
      message: `RFT ${kpi.rightFirstTime.value.toFixed(1)}% — di bawah target 95%`,
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
      message: `OEE ${kpi.oee.value.toFixed(1)}% — jauh di bawah target 65%`,
      value: kpi.oee.value,
      trend: kpi.oee.trend,
      threshold: `<${THRESHOLDS.oee.critical}%`,
    });
  } else if (kpi.oee.value < THRESHOLDS.oee.warning) {
    alerts.push({
      id: "oee-warning",
      kpi: "OEE",
      severity: "warning",
      message: `OEE ${kpi.oee.value.toFixed(1)}% — di bawah target 65%`,
      value: kpi.oee.value,
      trend: kpi.oee.trend,
      threshold: `<${THRESHOLDS.oee.warning}%`,
    });
  }

  return alerts;
}
