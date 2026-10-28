import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidateTag } from "next/cache";
import { authOptions } from "@/lib/auth";
import { isServerAdmin } from "@/lib/serverAdmin";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isServerAdmin(session.user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  revalidateTag("kpi", { expire: 0 });
  revalidateTag("trends", { expire: 0 });

  return NextResponse.json({ ok: true, revalidated: ["kpi", "trends"] });
}