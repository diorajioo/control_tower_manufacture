import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getResend, FROM_EMAIL, REPLY_TO, testEmailHtml } from "@/lib/email";

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured. Add it to .env.local to enable email." },
      { status: 503 }
    );
  }

  const to = session.user?.email;
  if (!to) return NextResponse.json({ error: "No email in session" }, { status: 400 });

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: [to],
    replyTo: REPLY_TO,
    subject: "Test Notification — Control Tower Manufacture",
    html: testEmailHtml(session.user?.name ?? "User"),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data?.id });
}
