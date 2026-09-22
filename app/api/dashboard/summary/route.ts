import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GROQ_MODEL_PRIORITY, isAIModelUnavailable, getClientForModel } from "@/lib/ai-provider";
import type Groq from "groq-sdk";
import type OpenAI from "openai";

export const maxDuration = 60;

const SYSTEM_PROMPT = `Kamu adalah analis senior Manufacturing Intelligence perusahaan farmasi berskala besar.

Tugas: tulis ringkasan eksekutif TEPAT 3 kalimat dari data KPI dashboard.

Aturan ketat:
- TEPAT 3 kalimat, masing-masing maksimal 40 kata
- Setiap kalimat diakhiri tanda titik (.)
- Fokus pada 3-4 KPI paling kritis — boleh sebut beberapa angka per kalimat tapi jangan daftar semua
- Kalimat 1: kondisi paling menonjol (positif atau negatif)
- Kalimat 2: konteks atau tren pendukung
- Kalimat 3: implikasi atau satu rekomendasi aksi
- Bahasa Indonesia profesional, tanpa bullet point, tanpa heading

Target ≥ OEE 65%, Bulk Loss < 3%, Pack Loss < 1%, RFT ≥ 95%.
Analisis hanya dari data yang diberikan.`;

type AnyMessage = Groq.Chat.ChatCompletionMessageParam | OpenAI.Chat.ChatCompletionMessageParam;

async function createStreamWithFallback(messages: AnyMessage[]) {
  let lastErr: unknown;
  for (const modelId of GROQ_MODEL_PRIORITY) {
    try {
      const client = getClientForModel(modelId);
      // Both Groq and OpenAI SDK share the same create() signature
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (client as any).chat.completions.create({
        model: modelId,
        max_tokens: 600,
        stream: true,
        messages,
      });
    } catch (err) {
      if (isAIModelUnavailable(err)) { lastErr = err; continue; }
      throw err;
    }
  }
  throw lastErr ?? new Error("Tidak ada AI model yang tersedia untuk summary");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
  const hasGroq = !!process.env.GROQ_API_KEY;
  if (!hasDeepSeek && !hasGroq) {
    return NextResponse.json({ error: "Tidak ada API key AI yang dikonfigurasi" }, { status: 503 });
  }

  const body = await req.json();
  const { kpi, filters } = body;

  const trendText = [
    kpi.leadTime?.grossTrend   != null ? `Lead Time MoM: ${kpi.leadTime.grossTrend > 0 ? "+" : ""}${kpi.leadTime.grossTrend}%`         : null,
    kpi.rightFirstTime?.trend  != null ? `RFT MoM: ${kpi.rightFirstTime.trend > 0 ? "+" : ""}${kpi.rightFirstTime.trend}%`             : null,
    kpi.oee?.trend             != null ? `OEE MoM: ${kpi.oee.trend > 0 ? "+" : ""}${kpi.oee.trend}%`                                   : null,
    kpi.yield?.bulkLossTrend   != null ? `Bulk Loss MoM: ${kpi.yield.bulkLossTrend > 0 ? "+" : ""}${kpi.yield.bulkLossTrend}%`         : null,
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
    const messages: AnyMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: userMessage },
    ];

    const stream = await createStreamWithFallback(messages);

    const encoder = new TextEncoder();
    // Sentinel appended when model finishes cleanly; client strips it to detect truncation.
    const DONE_SENTINEL = "\n​[DONE]​";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = (chunk as { choices?: [{ delta?: { content?: string } }] })
              .choices?.[0]?.delta?.content ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.enqueue(encoder.encode(DONE_SENTINEL));
        } catch {
          // Stream error — omit sentinel so client detects truncation
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
