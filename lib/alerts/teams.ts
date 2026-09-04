/**
 * lib/alerts/teams.ts — Microsoft Teams alert framework
 *
 * Sends KPI alerts to a Teams channel via Incoming Webhook using the
 * Adaptive Cards format (same rich-card format ChatGPT/Copilot uses).
 *
 * Setup (when ready to deploy):
 *   1. In Teams: channel → Connectors → Incoming Webhook → Create → copy URL
 *   2. Add to .env: TEAMS_WEBHOOK_URL=https://xxx.webhook.office.com/...
 *   3. Call sendTeamsAlerts(alerts) from any server-side route or cron job
 *
 * To add LLM-based recommendations: set GROQ_API_KEY and pass
 * { withRecommendation: true } to sendTeamsAlerts — it will call Groq to
 * generate a 2-sentence action recommendation and embed it in the card.
 */

import type { KPIAlert } from "@/lib/alerts";

// ── Adaptive Card payload types (minimal subset) ──────────────────────────────

interface ACTextBlock {
  type: "TextBlock";
  text: string;
  weight?: "Bolder" | "Default" | "Lighter";
  size?: "Small" | "Default" | "Medium" | "Large" | "ExtraLarge";
  color?: "Default" | "Dark" | "Light" | "Accent" | "Good" | "Warning" | "Attention";
  wrap?: boolean;
  spacing?: "None" | "Small" | "Default" | "Medium" | "Large" | "ExtraLarge" | "Padding";
}

interface ACFactSet {
  type: "FactSet";
  facts: { title: string; value: string }[];
  spacing?: string;
}

interface ACColumnSet {
  type: "ColumnSet";
  columns: {
    type: "Column";
    width: string;
    items: (ACTextBlock | ACFactSet)[];
  }[];
  spacing?: string;
}

type ACElement = ACTextBlock | ACFactSet | ACColumnSet;

interface AdaptiveCard {
  type: "AdaptiveCard";
  version: "1.4";
  body: ACElement[];
  actions?: {
    type: "Action.OpenUrl";
    title: string;
    url: string;
  }[];
}

interface TeamsWebhookPayload {
  type: "message";
  attachments: {
    contentType: "application/vnd.microsoft.card.adaptive";
    content: AdaptiveCard;
  }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<KPIAlert["severity"], ACTextBlock["color"]> = {
  critical: "Attention",
  warning:  "Warning",
  info:     "Accent",
};

const SEVERITY_ICON: Record<KPIAlert["severity"], string> = {
  critical: "🔴",
  warning:  "🟡",
  info:     "🔵",
};

function formatTrend(trend: number | null | undefined): string {
  if (trend == null) return "—";
  return trend > 0 ? `+${trend.toFixed(1)}%` : `${trend.toFixed(1)}%`;
}

// ── Card builder ──────────────────────────────────────────────────────────────

/**
 * Build an Adaptive Card payload for a batch of KPI alerts.
 * Pass an optional `recommendation` string (from LLM) to add an action block.
 */
export function buildTeamsAlertCard(
  alerts: KPIAlert[],
  options: {
    dashboardUrl?: string;
    recommendation?: string;
    plant?: string;
    period?: string;
  } = {}
): TeamsWebhookPayload {
  const critical = alerts.filter((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning");
  const infos    = alerts.filter((a) => a.severity === "info");

  const summaryText = [
    critical.length > 0 ? `${critical.length} Critical` : null,
    warnings.length > 0 ? `${warnings.length} Warning` : null,
    infos.length    > 0 ? `${infos.length} Info`       : null,
  ].filter(Boolean).join(" · ") || "No alerts";

  const now = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const body: ACElement[] = [
    // Title row
    {
      type: "TextBlock",
      text: "⚠️ Control Tower — KPI Alert",
      weight: "Bolder",
      size: "Large",
    },
    {
      type: "TextBlock",
      text: `${options.plant ? `Plant: **${options.plant}**  ·  ` : ""}${options.period ?? ""}  ·  ${now} WIB`,
      size: "Small",
      color: "Light",
      wrap: true,
      spacing: "None",
    },
    {
      type: "TextBlock",
      text: summaryText,
      weight: "Bolder",
      color: critical.length > 0 ? "Attention" : warnings.length > 0 ? "Warning" : "Accent",
      spacing: "Medium",
    },
  ];

  // Individual alert rows
  for (const alert of alerts) {
    const icon = SEVERITY_ICON[alert.severity];
    const color = SEVERITY_COLOR[alert.severity];

    body.push({
      type: "ColumnSet",
      spacing: "Small",
      columns: [
        {
          type: "Column",
          width: "auto",
          items: [{ type: "TextBlock", text: icon, size: "Default" }],
        },
        {
          type: "Column",
          width: "stretch",
          items: [
            { type: "TextBlock", text: `**${alert.kpi}**`, color, wrap: true },
            { type: "TextBlock", text: alert.message, size: "Small", wrap: true, spacing: "None" },
          ],
        },
        {
          type: "Column",
          width: "auto",
          items: [
            {
              type: "TextBlock",
              text: alert.trend != null ? formatTrend(alert.trend) : "—",
              size: "Small",
              color: alert.trend != null && alert.trend < 0 ? "Attention" : "Default",
            },
          ],
        },
      ],
    });
  }

  // LLM recommendation block
  if (options.recommendation) {
    body.push({
      type: "TextBlock",
      text: "---",
      spacing: "Medium",
    } as ACTextBlock);
    body.push({
      type: "TextBlock",
      text: `💡 **Rekomendasi AI:** ${options.recommendation}`,
      wrap: true,
      size: "Small",
      spacing: "None",
    });
  }

  const card: AdaptiveCard = {
    type: "AdaptiveCard",
    version: "1.4",
    body,
    actions: options.dashboardUrl
      ? [{ type: "Action.OpenUrl", title: "Buka Dashboard", url: options.dashboardUrl }]
      : undefined,
  };

  return {
    type: "message",
    attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", content: card }],
  };
}

// ── LLM recommendation (optional) ────────────────────────────────────────────

/**
 * Call Groq to generate a 2-sentence action recommendation for the alerts.
 * Returns undefined if GROQ_API_KEY is not set or the call fails.
 */
async function fetchLLMRecommendation(alerts: KPIAlert[]): Promise<string | undefined> {
  if (!process.env.GROQ_API_KEY) return undefined;

  try {
    const { default: Groq } = await import("groq-sdk");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const alertSummary = alerts
      .map((a) => `${a.severity.toUpperCase()} — ${a.kpi}: ${a.message}`)
      .join("\n");

    const resp = await groq.chat.completions.create({
      model: "qwen/qwen3.6-27b",
      max_tokens: 120,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "Kamu adalah analis manufacturing. Buat 1-2 kalimat rekomendasi tindakan spesifik berdasarkan daftar KPI alert ini. Ringkas dan actionable.",
        },
        { role: "user", content: alertSummary },
      ],
    });

    return resp.choices[0]?.message?.content?.trim();
  } catch {
    return undefined;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface SendTeamsAlertsOptions {
  /** Override the webhook URL (falls back to TEAMS_WEBHOOK_URL env var) */
  webhookUrl?: string;
  /** Public URL of the dashboard for the card's CTA button */
  dashboardUrl?: string;
  /** Active plant filter label shown in the card header */
  plant?: string;
  /** Active period label shown in the card header */
  period?: string;
  /** If true, calls Groq to generate a 2-sentence recommendation (costs 1 req) */
  withRecommendation?: boolean;
}

// ── Power Automate payload ────────────────────────────────────────────────────
// PA HTTP trigger accepts any JSON via triggerBody(). We send a flat object
// so the PA flow can use individual fields directly in its "Post to Teams" action
// without needing to parse a nested Adaptive Card structure.

function buildPowerAutomatePayload(
  alerts: KPIAlert[],
  options: { plant?: string; period?: string; dashboardUrl?: string; recommendation?: string }
) {
  const critical = alerts.filter((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning");

  const now = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short",
  });

  // Pre-formatted text block — PA can paste this straight into a Teams message
  const alertsText = alerts
    .map((a) => {
      const icon = a.severity === "critical" ? "🔴" : a.severity === "warning" ? "🟡" : "🔵";
      const trend = a.trend != null ? ` (${a.trend > 0 ? "+" : ""}${a.trend.toFixed(1)}% MoM)` : "";
      return `${icon} **${a.kpi}**: ${a.message}${trend}`;
    })
    .join("\n\n");

  return {
    title:          "⚠️ Control Tower Manufacturing — KPI Alert",
    plant:          options.plant ?? "All Plant",
    period:         options.period ?? "",
    timestamp:      `${now} WIB`,
    criticalCount:  critical.length,
    warningCount:   warnings.length,
    dashboardUrl:   options.dashboardUrl ?? "",
    recommendation: options.recommendation ?? "",
    alertsText,
    alerts: alerts.map((a) => ({
      severity:  a.severity,
      kpi:       a.kpi,
      message:   a.message,
      trend:     a.trend,
      threshold: a.threshold,
    })),
  };
}

/**
 * Send a Teams alert card for a list of KPI alerts.
 *
 * Auto-detects webhook type:
 *   - powerplatform.com URL → Power Automate HTTP trigger (flat JSON)
 *   - everything else       → Teams Incoming Webhook (Adaptive Card)
 *
 * Returns { ok: true } on success, { ok: false, error } on failure.
 * Never throws — safe to call from background jobs and cron routes.
 */
export async function sendTeamsAlerts(
  alerts: KPIAlert[],
  options: SendTeamsAlertsOptions = {}
): Promise<{ ok: boolean; error?: string }> {
  const webhookUrl = options.webhookUrl ?? process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) {
    return { ok: false, error: "TEAMS_WEBHOOK_URL not configured" };
  }
  if (alerts.length === 0) {
    return { ok: true };
  }

  const recommendation = options.withRecommendation
    ? await fetchLLMRecommendation(alerts)
    : undefined;

  const isPowerAutomate = webhookUrl.includes("powerplatform.com") ||
                          webhookUrl.includes("logic.azure.com");

  const payload = isPowerAutomate
    ? buildPowerAutomatePayload(alerts, {
        plant:          options.plant,
        period:         options.period,
        dashboardUrl:   options.dashboardUrl,
        recommendation,
      })
    : buildTeamsAlertCard(alerts, {
        dashboardUrl:   options.dashboardUrl,
        recommendation,
        plant:          options.plant,
        period:         options.period,
      });

  try {
    const res = await fetch(webhookUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    // Power Automate returns 202 Accepted; Teams Incoming Webhook returns 200
    if (!res.ok && res.status !== 202) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Webhook returned ${res.status}: ${text}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}