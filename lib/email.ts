import { Resend } from "resend";
import type { KPIAlert } from "@/lib/alerts";

// Lazy instantiation so missing RESEND_API_KEY at build time doesn't throw.
// The API route checks for the key before calling getResend().
let _resend: Resend | null = null;
export function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

export const FROM_EMAIL = `Control Tower <${process.env.FROM_EMAIL ?? "onboarding@resend.dev"}>`;
export const REPLY_TO = process.env.REPLY_TO ?? undefined;

// ── Shared layout shell ───────────────────────────────────────────────────────

function shell(body: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Control Tower Manufacture</title>
</head>
<body style="margin:0;padding:0;background:#f0f0f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f8;padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#3730a3 0%,#4f46e5 100%);border-radius:12px 12px 0 0;padding:20px 28px;">
            <p style="color:white;font-size:17px;font-weight:700;margin:0;letter-spacing:-0.3px;">Control Tower Manufacture</p>
            <p style="color:#c7d2fe;font-size:12px;margin:3px 0 0;">PT Paracorp Group &nbsp;·&nbsp; Notifikasi Otomatis</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:white;padding:28px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:14px 28px;">
            <p style="color:#9ca3af;font-size:11px;margin:0;">
              Dikirim otomatis oleh Control Tower Manufacture &nbsp;·&nbsp; PT Paracorp Group
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Alert email (the real notification) ───────────────────────────────────────

const SEVERITY_STYLE: Record<KPIAlert["severity"], { bg: string; text: string; label: string }> = {
  critical: { bg: "#fef2f2", text: "#b91c1c", label: "Kritis"    },
  warning:  { bg: "#fffbeb", text: "#92400e", label: "Peringatan" },
  info:     { bg: "#eff6ff", text: "#1d4ed8", label: "Info"       },
};

function alertCard(alert: KPIAlert): string {
  const s = SEVERITY_STYLE[alert.severity];
  const trendBadge =
    alert.trend != null
      ? `<span style="color:${alert.trend < 0 ? "#16a34a" : "#dc2626"};font-size:12px;font-weight:600;margin-left:8px;">${alert.trend > 0 ? "▲" : "▼"} ${Math.abs(alert.trend).toFixed(1)}%</span>`
      : "";

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;background:${s.bg};border-radius:8px;border:1px solid ${s.text}22;overflow:hidden;">
    <tr>
      <td style="padding:14px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <span style="display:inline-block;background:${s.text}22;color:${s.text};font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;letter-spacing:0.3px;">${s.label.toUpperCase()}</span>
              <span style="font-size:13px;font-weight:600;color:#1f2937;margin-left:8px;">${alert.kpi}</span>
              ${trendBadge}
            </td>
          </tr>
          <tr>
            <td style="padding-top:6px;">
              <p style="color:#374151;font-size:13px;margin:0;line-height:1.5;">${alert.message}</p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:4px;">
              <p style="color:#6b7280;font-size:11px;margin:0;">Threshold: ${alert.threshold}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

export function alertEmailHtml(
  alerts: KPIAlert[],
  userName: string,
  period: string,
  dashboardUrl?: string
): string {
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount  = alerts.filter((a) => a.severity === "warning").length;

  const summaryColor = criticalCount > 0 ? "#dc2626" : "#d97706";
  const summaryLabel = criticalCount > 0
    ? `${criticalCount} alert kritis${warningCount > 0 ? ` + ${warningCount} peringatan` : ""}`
    : `${warningCount} peringatan`;

  const alertCards = alerts.map(alertCard).join("");

  const ctaButton = dashboardUrl
    ? `<table cellpadding="0" cellspacing="0" style="margin-top:24px;">
        <tr>
          <td style="background:#4f46e5;border-radius:8px;">
            <a href="${dashboardUrl}" style="display:inline-block;color:white;font-size:13px;font-weight:600;padding:10px 20px;text-decoration:none;">
              Buka Dashboard →
            </a>
          </td>
        </tr>
      </table>`
    : "";

  const body = `
    <p style="color:#374151;font-size:14px;margin:0 0 4px;">Halo ${userName},</p>
    <p style="color:#6b7280;font-size:13px;margin:0 0 20px;">Periode: ${period}</p>

    <div style="background:#fafafa;border-radius:8px;padding:12px 16px;margin-bottom:20px;border-left:3px solid ${summaryColor};">
      <p style="color:${summaryColor};font-size:13px;font-weight:700;margin:0;">
        Ditemukan ${summaryLabel} yang memerlukan perhatian.
      </p>
    </div>

    ${alertCards}
    ${ctaButton}
  `;

  return shell(body);
}

// ── Test / preview email ───────────────────────────────────────────────────────
// Uses real alert format with sample data so recipients see exactly
// what a live alert email will look like.

const SAMPLE_ALERTS: KPIAlert[] = [
  {
    id: "oee-critical",
    kpi: "OEE",
    severity: "critical",
    message: "OEE 51.3% — jauh di bawah target 65%",
    value: 51.3,
    trend: -8.2,
    threshold: "<55%",
  },
  {
    id: "bulkloss-warning",
    kpi: "Bulk Loss",
    severity: "warning",
    message: "Bulk loss 3.8% — di atas target 3%",
    value: 3.8,
    trend: 12.4,
    threshold: ">3%",
  },
  {
    id: "rft-warning",
    kpi: "Right First Time",
    severity: "warning",
    message: "RFT 92.1% — di bawah target 95%",
    value: 92.1,
    trend: -2.9,
    threshold: "<95%",
  },
];

export function testEmailHtml(userName: string): string {
  return alertEmailHtml(
    SAMPLE_ALERTS,
    userName,
    "Preview — data sampel (bukan data aktual)",
  );
}