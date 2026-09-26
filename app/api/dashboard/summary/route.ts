import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GROQ_MODEL_PRIORITY, isAIModelUnavailable, getClientForModel } from "@/lib/ai-provider";
import type Groq from "groq-sdk";
import type OpenAI from "openai";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a senior Manufacturing Intelligence analyst at a large pharmaceutical company.

Task: write an executive summary of EXACTLY 3 sentences from the dashboard KPI data.

Strict rules:
- EXACTLY 3 sentences, each at most 40 words
- Every sentence ends with a period (.)
- Focus on the 3-4 most critical KPIs — you may cite several numbers per sentence but do not list them all
- Sentence 1: the most notable condition (positive or negative)
- Sentence 2: supporting context or trend
- Sentence 3: implication or one recommended action
- Professional English, no bullet points, no headings

Targets: OEE ≥ 65%, Bulk Loss < 3%, Pack Loss < 1%, RFT ≥ 95%.
Analyze only the data provided.`;

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
  throw lastErr ?? new Error("No AI model available for summary");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
  const hasGroq = !!process.env.GROQ_API_KEY;
  if (!hasDeepSeek && !hasGroq) {
    return NextResponse.json({ error: "No AI API key configured" }, { status: 503 });
  }

  const body = await req.json();
  const { kpi, filters } = body;

  const trendText = [
    kpi.leadTime?.grossTrend   != null ? `Lead Time MoM: ${kpi.leadTime.grossTrend > 0 ? "+" : ""}${kpi.leadTime.grossTrend}%`         : null,
    kpi.rightFirstTime?.trend  != null ? `RFT MoM: ${kpi.rightFirstTime.trend > 0 ? "+" : ""}${kpi.rightFirstTime.trend}%`             : null,
    kpi.oee?.trend             != null ? `OEE MoM: ${kpi.oee.trend > 0 ? "+" : ""}${kpi.oee.trend}%`                                   : null,
    kpi.yield?.bulkLossTrend   != null ? `Bulk Loss MoM: ${kpi.yield.bulkLossTrend > 0 ? "+" : ""}${kpi.yield.bulkLossTrend}%`         : null,
  ].filter(Boolean).join(", ");

  const userMessage = `KPI data for ${filters.startDate} to ${filters.endDate}, Plant: ${filters.plant || "All Plant"}:

Lead Time Gross: ${kpi.leadTime?.grossDays ?? "—"} days | Nett: ${kpi.leadTime?.nettDays ?? "—"} days
Bulk Loss: ${kpi.yield?.bulkLossPct ?? "—"}% (~${(kpi.yield?.bulkLossKg ?? 0).toLocaleString()} kg)
Pack Loss: ${kpi.yield?.packLossPct ?? "—"}%
Right First Time: ${kpi.rightFirstTime?.value ?? "—"}%
Output Bulk: ${(kpi.output?.bulkQty ?? 0).toLocaleString()} kg | Released FG: ${(kpi.output?.fgQty ?? 0).toLocaleString()} pcs
OEE: ${kpi.oee?.value ?? "—"}%
E2E Productivity: ${kpi.productivity?.e2e ?? "—"} pcs/manhour${trendText ? `\nChange vs prior period: ${trendText}` : ""}

Write a short executive summary:`;

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
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
