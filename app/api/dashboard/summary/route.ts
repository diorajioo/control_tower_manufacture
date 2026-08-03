import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Groq from "groq-sdk";

const SYSTEM_PROMPT = `Kamu adalah analis senior di divisi Manufacturing Intelligence untuk perusahaan farmasi berskala besar.
Tugasmu adalah membuat ringkasan eksekutif yang tajam, ringkas, dan berbasis data dari dashboard Control Tower Manufaktur.

Panduan penulisan:
- Gunakan Bahasa Indonesia yang profesional dan mudah dipahami
- Maksimal 4 kalimat pendek yang padat
- Soroti angka paling kritis (baik maupun buruk) dengan konteks yang jelas
- Jika ada tren naik/turun, sebutkan arahnya dan implikasinya
- Akhiri dengan satu rekomendasi aksi prioritas jika ada anomali
- Format output: paragraf biasa, bukan bullet points, tanpa heading

Konteks sistem:
Control Tower Manufaktur memantau KPI utama:
Lead Time (hari, lebih rendah = lebih baik), Bulk Loss % (target < 3%), Pack Loss % (target < 1%),
Right First Time/RFT % (target >= 95%), Output Bulk kg & FG Release pcs,
OEE % (target >= 65%), Productivity pcs/manhour.

Berikan analisis berdasarkan data yang diberikan saja. Jangan menambahkan data yang tidak ada.`;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 503 });
  }

  const body = await req.json();
  const { kpi, filters } = body;

  const trendText = [
    kpi.leadTime?.trend != null ? `Lead Time MoM: ${kpi.leadTime.trend > 0 ? "+" : ""}${kpi.leadTime.trend}%` : null,
    kpi.rightFirstTime?.trend != null ? `RFT MoM: ${kpi.rightFirstTime.trend > 0 ? "+" : ""}${kpi.rightFirstTime.trend}%` : null,
    kpi.oee?.trend != null ? `OEE MoM: ${kpi.oee.trend > 0 ? "+" : ""}${kpi.oee.trend}%` : null,
    kpi.yield?.bulkLossTrend != null ? `Bulk Loss MoM: ${kpi.yield.bulkLossTrend > 0 ? "+" : ""}${kpi.yield.bulkLossTrend}%` : null,
  ].filter(Boolean).join(", ");

  const userMessage = `Data KPI periode ${filters.startDate} s/d ${filters.endDate}, Plant: ${filters.plant || "Semua Plant"}:

Lead Time: ${kpi.leadTime?.value} hari (upstream: ${kpi.leadTime?.upstream}d, downstream: ${kpi.leadTime?.downstream}d)
Bulk Loss: ${kpi.yield?.bulkLossPct}% (~${(kpi.yield?.bulkLossKg ?? 0).toLocaleString()} kg)
Pack Loss: ${kpi.yield?.packLossPct}%
Right First Time: ${kpi.rightFirstTime?.value}%
Output Bulk Accepted: ${(kpi.output?.acceptedBulkKg ?? 0).toLocaleString()} kg
Released FG: ${(kpi.output?.releasedFgPcs ?? 0).toLocaleString()} pcs
OEE: ${kpi.oee?.value}%
Productivity: ${kpi.productivity?.value} pcs/manhour${trendText ? `\nPerubahan vs periode sebelumnya: ${trendText}` : ""}

Buat ringkasan eksekutif singkat:`;

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 400,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("AI summary error:", err);
    return NextResponse.json({ error: "AI summary failed" }, { status: 500 });
  }
}
