import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPlantList } from "@/lib/queries";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const plants = await getPlantList();
    return NextResponse.json({ plants: ["All Plant", ...plants] });
  } catch (err) {
    console.error("Plant list error:", err);
    return NextResponse.json({ plants: ["All Plant"] });
  }
}
