import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GROQ_MODEL_PRIORITY, isAIModelUnavailable, getClientForModel } from "@/lib/ai-provider";
import type Groq from "groq-sdk";
import type OpenAI from "openai";
import { KPI_RELATIONSHIPS, NARRATIVE_RULES, buildKpiContext } from "@/lib/kpiNarrative";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a senior Manufacturing Intelligence analyst at a large pharmaceutical company.

Task: write an executive summary of EXACTLY 3 sentences that tells the story behind the dashboard KPIs —
not a list of numbers, but how one KPI drives another.

Strict rules:
- EXACTLY 3 sentences in one paragraph (no line breaks), each ending with a period (.)
- Hard limit: 40 words per sentence — prefer one clear link over several; cut, do not chain clauses
- Sentence 1 — what happened: the most important condition, with its number vs target or prior period
- Sentence 2 — why / the link: the other KPI or lead time stage in the data that explains it, and the effect it has
  (e.g. waiting time → gross lead time → fewer POs releasing FG)
- Sentence 3 — so what: the business impact and one concrete action on the root cause
- Professional English, no bullet points, no headings
- Right after each KPI value you cite, add its tag with no other text in between: [kpi:leadtime] for lead time,
  [kpi:output] for output / released FG / bulk, [kpi:productivity] for productivity.
  Tag only actual values, not targets or percentage changes.
  Example: "Gross lead time averaged 16.98 days [kpi:leadtime], above the 13-day target."

${KPI_RELATIONSHIPS}

${NARRATIVE_RULES}

Analyze only Lead Time, Output and Productivity. Do not mention OEE, OPE, yield/bulk/pack loss, RFT or energy.`;

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

  // Only metrics shown on a page are sent (see lib/aiScope.ts).

  const userMessage = `KPI data for ${filters.startDate} to ${filters.endDate}, Plant: ${filters.plant || "All Plant"}:

${buildKpiContext(kpi)}

Write the 3-sentence executive summary:`;

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
