import { Resend } from "resend";

// Lazy instantiation so missing RESEND_API_KEY at build time doesn't throw.
// The API route checks for the key before calling getResend().
let _resend: Resend | null = null;
export function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

export const FROM_EMAIL = `Control Tower <${process.env.FROM_EMAIL ?? "onboarding@resend.dev"}>`;
export const REPLY_TO = process.env.REPLY_TO ?? undefined;

export function testEmailHtml(userName: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f7ff;font-family:sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:linear-gradient(135deg,#3730a3,#4f46e5);padding:20px 24px;">
      <p style="color:white;font-size:18px;font-weight:700;margin:0;">Control Tower Manufacture</p>
      <p style="color:#c7d2fe;font-size:13px;margin:4px 0 0;">PT Paracorp Group — Notifikasi Sistem</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#374151;font-size:15px;margin:0 0 12px;">Halo ${userName},</p>
      <p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Email ini adalah konfirmasi bahwa notifikasi Control Tower sudah berhasil dikonfigurasi.
        Anda akan menerima email seperti ini saat ada alert atau metrik yang perlu perhatian.
      </p>
      <div style="background:#f8f7ff;border-radius:8px;padding:16px;border-left:3px solid #4f46e5;">
        <p style="color:#374151;font-size:13px;font-weight:600;margin:0 0 4px;">KPI yang dimonitor:</p>
        <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.6;">
          Lead Time &nbsp;·&nbsp; Bulk Loss &nbsp;·&nbsp; Pack Loss &nbsp;·&nbsp; Right First Time &nbsp;·&nbsp; OEE
        </p>
      </div>
    </div>
    <div style="padding:14px 24px;border-top:1px solid #e5e7eb;background:#f9fafb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        Dikirim otomatis oleh Control Tower Manufacture · PT Paracorp Group
      </p>
    </div>
  </div>
</body>
</html>`;
}