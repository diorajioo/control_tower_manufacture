import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Groq from "groq-sdk";
import { GROQ_MODEL_PRIORITY, isGroqModelUnavailable } from "@/lib/ai-provider";

export const maxDuration = 60;

const SYSTEM_PROMPT = `Kamu adalah analis senior Manufacturing Intelligence perusahaan farmasi berskala besar.

Tugas: tulis ringkasan eksekutif TEPAT 3 kalimat dari data KPI dashboard.

Aturan ketat:
- TEPAT 3 kalimat, masing-masing maksimal 20 kata
- Setiap kalimat diakhiri tanda titik (.)
- Pilih hanya 2-3 KPI paling kritis atau anomali — JANGAN sebut semua KPI
- Sebut satu angka kunci per kalimat, bukan daftar panjang
- Kalimat 1: kondisi paling menonjol (positif atau negatif)
- Kalimat 2: konteks atau tren pendukung
- Kalimat 3: implikasi atau satu rekomendasi aksi
- Bahasa Indonesia profesional, tanpa bullet point, tanpa heading

Target ≥ OEE 65%, Bulk Loss < 3%, Pack Loss < 1%, RFT ≥ 95%.
Analisis hanya dari data yang diberikan.`;

async function createStreamWithFallback(
  groq: Groq,
  messages: Groq.Chat.ChatCompletionMessageParam[]
) {
  let lastErr: unknown;
  for (const model of GROQ_MODEL_PRIORITY) {
    try {
      return await groq.chat.completions.create({
        model,
        max_tokens: 600,
        stream: true as const,
        messages,
      });
    } catch (err) {
      if (isGroqModelUnavailable(err)) { lastErr = err; continue; }
      throw err;
    }
  }
  throw lastErr ?? new Error("Tidak ada Groq model yang tersedia");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 503 });
  }

  const body = await req.json();
  const { kpi, filters } = body;

  const trendText = [
    kpi.leadTime?.grossTrend   != null ? `Lead Time MoM: ${kpi.leadTime.grossTrend > 0 ? "+" : ""}${kpi.leadTime.grossTrend}%`           : null,
    kpi.rightFirstTime?.trend  != null ? `RFT MoM: ${kpi.rightFirstTime.trend > 0 ? "+" : ""}${kpi.rightFirstTime.trend}%`               : null,
    kpi.oee?.trend             != null ? `OEE MoM: ${kpi.oee.trend > 0 ? "+" : ""}${kpi.oee.trend}%`                                     : null,
    kpi.yield?.bulkLossTrend   != null ? `Bulk Loss MoM: ${kpi.yield.bulkLossTrend > 0 ? "+" : ""}${kpi.yield.bulkLossTrend}%`           : null,
  ].filter(Boolean).join(", ");

  const userMessage = `Data KPI periode ${filters.startDate} s/d ${filters.endDate}, Plant: ${filters.plant || "Semua Plant"}:

Lead Time Gross: ${kpi.leadTime?.grossDays ?? "—"} hari | Nett: ${kpi.leadTime?.nettDays ?? "—"} hari
Bulk Loss: ${kpi.yield?.bulkLossPct ?? "—"}% (~${(kpi.yield?.bulkLossKg ?? 0).toLocaleString()} kg)
Pack Loss: ${kpi.yield?.packLossPct ?? "—"}%
Right First Time: ${kpi.rightFirstTime?.value ?? "—"}%
Output Bulk: ${(kpi.output?.bulkQty ?? 0).toLocaleString()} kg | Released FG: ${(kpi.output?.fgQty ?? 0).toLocaleString()} pcs
OEE: ${kpi.oee?.value ?? "—"}%
Produktivitas E2E: ${kpi.productivity?.e2e ?? "—"} pcs/manhour${trendText ? `\nPerubahan vs periode sebelumnya: ${trendText}` : ""}

Buat ringkasan eksekutif singkat:`;

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ];

    const stream = await createStreamWithFallback(groq, messages);

    const encoder = new TextEncoder();
    // Plain-text sentinel — appended only when the model finishes cleanly.
    // The client strips this before display and uses it to detect truncation.
    // Must not contain null bytes (filtered by some HTTP proxies/edges).
    const DONE_SENTINEL = "\n​[DONE]​";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.enqueue(encoder.encode(DONE_SENTINEL));
        } catch {
          // Stream error — omit sentinel so client knows it was cut
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[summary] AI summary error:", err);
    return NextResponse.json({ error: "Gagal menghasilkan ringkasan" }, { status: 500 });
  }
}
