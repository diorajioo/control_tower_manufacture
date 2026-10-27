// Teams delivery: the scheduled runner (/api/cron/notifications), interactive alert sends
// (/api/notifications/teams) and test sends all go through here, so routing, dedup and cards stay identical.

import { getKpiSnapshot } from "@/lib/kpiData";
import { alertsFromKpi, type KPIAlert } from "@/lib/alerts";
import {
  buildAlertCard, alertSummary, generateAlertNarrative,
  buildSummaryCard, summaryPreview, generateSummaryStory,
} from "@/lib/alerts/teams";
import { resolveToken, sendCardTo } from "@/lib/graph/teams";
import { readNotifState, type RecipientConfig, type SummaryRange } from "@/lib/notifications/store";
import { alertKey, filterUnsentKeys, markSent } from "@/lib/settings";
import { isDue, wibDate } from "@/lib/notifications/schedule";

/** Scheduled alert checks compare the last 30 days with the 30 days before (YTD has no prior CT data). */
const ALERT_RANGE: SummaryRange = "30D";

/** Alert KPI label → recipient subscription key (Settings chips). */
export const ALERT_KPI_KEYS: Record<string, string> = {
  "Lead Time": "leadTime", "Bulk Loss": "bulkLoss", "Pack Loss": "packLoss", "Right First Time": "rft", "OEE": "oee",
};

export const RANGE_LABEL: Record<SummaryRange, string> = { "7D": "Last 7 days", "30D": "Last 30 days", "YTD": "Year to date" };

export function dashboardUrl(): string | undefined {
  return process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL.replace(/\/$/, "")}/dashboard` : undefined;
}

/** KPI snapshot for a plant and summary range (same cache as /api/dashboard/kpi). */
function snapshot(plant: string, range: SummaryRange, now: number) {
  return range === "7D"
    ? getKpiSnapshot(plant, "", wibDate(now, 7), wibDate(now))
    : getKpiSnapshot(plant, range, "", "");
}

/** Summary card for one recipient: their plant (vs the network when it is a single plant) over their range. */
async function summaryFor(r: RecipientConfig, snap: (key: string) => Promise<unknown>) {
  const cadence = r.summary.mode === "weekly" ? "Weekly" as const : "Daily" as const;
  const rangeLabel = RANGE_LABEL[r.summary.range];
  const [kpi, network] = await Promise.all([
    snap(`${r.plant}|${r.summary.range}`),
    r.plant === "All Plant" ? undefined : snap(`All Plant|${r.summary.range}`),
  ]);
  const ctx = { plant: r.plant, rangeLabel, cadence, kpi, network, dashboardUrl: dashboardUrl() };
  const story = await generateSummaryStory(ctx);
  return { card: buildSummaryCard({ ...ctx, story }), preview: summaryPreview(ctx) };
}

const subscribed = (alerts: KPIAlert[], r: RecipientConfig) =>
  alerts.filter((a) => r.kpis[ALERT_KPI_KEYS[a.kpi] ?? ""] !== false);

const summaryKey = (r: RecipientConfig) => `${r.plant}|${r.summary.range}|${r.summary.mode}`;

function memo<T>(fn: (key: string) => Promise<T>) {
  const cache = new Map<string, Promise<T>>();
  return (key: string) => {
    if (!cache.has(key)) cache.set(key, fn(key));
    return cache.get(key)!;
  };
}

export interface RunReport { sent: string[]; errors: string[]; skipped?: string }

// ── Scheduled runner ──────────────────────────────────────────────────────────

/**
 * Send everything due now: instant alerts (deduped per recipient), daily alert digests and
 * daily / weekly summaries. Safe to call often — a schedule is marked sent only after it went out.
 */
export async function runScheduledNotifications(now = Date.now()): Promise<RunReport> {
  const state = await readNotifState();
  if (!state.enabled) return { sent: [], errors: [], skipped: "Teams notifications are off" };
  if (state.recipients.length === 0) return { sent: [], errors: [], skipped: "No recipients" };

  const token = await resolveToken();
  if (!token) return { sent: [], errors: ["No sender connected — Settings → Microsoft Teams → Sender"] };

  const snap = memo((k) => { const [plant, range] = k.split("|"); return snapshot(plant, range as SummaryRange, now); });
  // Recipients with the same plant, range and cadence get the same summary — built once
  const summaries = memo(async (k) => summaryFor(state.recipients.find((r) => summaryKey(r) === k)!, snap));
  const report: RunReport = { sent: [], errors: [] };
  const alertKeys: string[] = [], scheduleKeys: string[] = [];

  for (const r of state.recipients) {
    try {
      // Alerts: instant on every run (deduped), digest once a day at its time
      const digestDue = r.alerts.mode === "digest" && isDue(now, state.lastSent[`${r.email}|digest`], r.alerts.time);
      if (r.alerts.mode === "instant" || digestDue) {
        const kpi = await snap(`${r.plant}|${ALERT_RANGE}`);
        let alerts = subscribed(alertsFromKpi(kpi), r);
        let keys = alerts.map((a) => alertKey(r.email, r.plant, a.id));
        if (r.alerts.mode === "instant") {
          const fresh = new Set(await filterUnsentKeys(keys));
          alerts = alerts.filter((_, i) => fresh.has(keys[i]));
          keys = keys.filter((k) => fresh.has(k));
        }
        if (alerts.length > 0) {
          const narrative = await generateAlertNarrative(alerts, kpi, { plant: r.plant, period: RANGE_LABEL[ALERT_RANGE] });
          const card = buildAlertCard(alerts, { plant: r.plant, period: RANGE_LABEL[ALERT_RANGE], kpi, narrative, dashboardUrl: dashboardUrl() });
          const err = await sendCardTo(token, r.email, card, alertSummary(alerts));
          if (err) report.errors.push(err);
          else { alertKeys.push(...keys); report.sent.push(`${r.email}: ${r.alerts.mode} alert (${alerts.length})`); }
        }
        if (digestDue) scheduleKeys.push(`${r.email}|digest`); // no alerts that day → nothing to send
      }

      // Summary
      const weekday = r.summary.mode === "weekly" ? r.summary.weekday : undefined;
      if (r.summary.mode !== "off" && isDue(now, state.lastSent[`${r.email}|summary`], r.summary.time, weekday)) {
        const { card, preview } = await summaries(summaryKey(r));
        const err = await sendCardTo(token, r.email, card, preview);
        if (err) report.errors.push(err);
        else { scheduleKeys.push(`${r.email}|summary`); report.sent.push(`${r.email}: ${r.summary.mode} summary`); }
      }
    } catch (err) {
      report.errors.push(`${r.email}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await markSent(alertKeys, scheduleKeys, now);
  return report;
}

// ── Interactive alert send (dashboard, alert panel, header button) ─────────────

/**
 * Alerts computed in the browser for `plant`. Goes to recipients of that plant whose alerts are
 * `instant` (auto-send) or not `off` (manual send, `force`); auto-sends are deduped per recipient.
 */
export async function sendAlertsToRecipients(
  alerts: KPIAlert[],
  recipients: RecipientConfig[],
  opts: { plant: string; period?: string; startDate?: string; endDate?: string; force?: boolean; sessionAccessToken?: string },
): Promise<RunReport> {
  const targets = recipients.filter((r) => r.plant === opts.plant && (opts.force ? r.alerts.mode !== "off" : r.alerts.mode === "instant"));
  if (targets.length === 0) return { sent: [], errors: [], skipped: `No recipient gets ${opts.plant} alerts ${opts.force ? "" : "as they happen"}`.trim() };

  const token = await resolveToken(opts.sessionAccessToken);
  if (!token) return { sent: [], errors: ["No token available — connect a sender in Settings, or sign out and back in"] };

  const kpi = await getKpiSnapshot(opts.plant, opts.period ?? "", opts.startDate ?? "", opts.endDate ?? "")
    .catch((err) => { console.error("[teams] KPI snapshot failed:", err); return undefined; });
  const narratives = memo(async (ids) => generateAlertNarrative(alerts.filter((a) => ids.split(",").includes(a.id)), kpi, { plant: opts.plant, period: opts.period }));

  const report: RunReport = { sent: [], errors: [] };
  const sentKeys: string[] = [];
  for (const r of targets) {
    let mine = subscribed(alerts, r);
    let keys = mine.map((a) => alertKey(r.email, r.plant, a.id));
    if (!opts.force) {
      const fresh = new Set(await filterUnsentKeys(keys));
      mine = mine.filter((_, i) => fresh.has(keys[i]));
      keys = keys.filter((k) => fresh.has(k));
    }
    if (mine.length === 0) continue;
    const narrative = kpi ? await narratives(mine.map((a) => a.id).join(",")) : undefined;
    const card = buildAlertCard(mine, { plant: opts.plant, period: opts.period, kpi, narrative, dashboardUrl: dashboardUrl() });
    const err = await sendCardTo(token, r.email, card, alertSummary(mine));
    if (err) report.errors.push(err);
    else { sentKeys.push(...keys); report.sent.push(r.email); }
  }
  await markSent(sentKeys);
  return report;
}

// ── Test send (Settings) ─────────────────────────────────────────────────────

/** Send one summary now to each recipient (their plant and range), ignoring schedules. */
export async function sendTestSummaries(recipients: RecipientConfig[], sessionAccessToken?: string, now = Date.now()): Promise<RunReport> {
  const token = await resolveToken(sessionAccessToken);
  if (!token) return { sent: [], errors: ["No token available — connect a sender, or sign out and back in"] };
  const snap = memo((k) => { const [plant, range] = k.split("|"); return snapshot(plant, range as SummaryRange, now); });
  const summaries = memo(async (k) => summaryFor(recipients.find((r) => summaryKey(r) === k)!, snap));
  const report: RunReport = { sent: [], errors: [] };
  for (const r of recipients) {
    try {
      const { card, preview } = await summaries(summaryKey(r));
      const err = await sendCardTo(token, r.email, card, preview);
      if (err) report.errors.push(err); else report.sent.push(r.email);
    } catch (err) {
      report.errors.push(`${r.email}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return report;
}
