import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resend, FROM_EMAIL, REPLY_TO, testEmailHtml } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      {
        error:
          "RESEND_API_KEY belum dikonfigurasi. Tambahkan ke .env.local untuk mengaktifkan email.",
      },
      { status: 503 }
    );
  }

  const body = (await req.json()) as { recipients?: string[] };
  const recipients = body.recipients;

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json(
      { error: "Tidak ada penerima yang ditentukan" },
      { status: 400 }
    );
  }

  const userName = session.user?.name ?? "Pengguna";

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: recipients,
    replyTo: REPLY_TO,
    subject: "Test Notifikasi — Control Tower Manufacture",
    html: testEmailHtml(userName),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id });
}