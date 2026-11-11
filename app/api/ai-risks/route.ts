import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDeepSeekClient, isDeepSeekConfigured } from "@/lib/deepseek";
import { OUT_OF_SCOPE_NOTE } from "@/lib/aiScope";
import { KPI_RELATIONSHIPS, NARRATIVE_RULES, buildKpiContext } from "@/lib/kpiNarrative";

// Allow up to 60 s on Vercel — the default limit cut the streamed answer short (fewer risks/actions than local).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isDeepSeekConfigured()) {
    return NextResponse.json({ error: "DeepSeek not configured" }, { status: 503 });
  }

  const { kpi, filters } = await req.json() as {
    kpi: unknown;
    filters: { plant: string; period: string };
  };

  const prompt = `You are a senior manufacturing analyst. Identify the top 3 risks and the 3 actions that address their root cause.
Use only Lead Time, Output and Productivity; ${OUT_OF_SCOPE_NOTE} Do not mention them.

KPI data — Plant: ${filters.plant}, Period: ${filters.period}
${buildKpiContext(kpi)}

${KPI_RELATIONSHIPS}

${NARRATIVE_RULES}

Rules:
- RISK desc: one tight phrase, cause + one number. Hard limit: 10 words. Stop there.
- ACTION desc: one verb phrase on the root cause. Hard limit: 10 words. Stop there.
- Only list a risk the data supports; never list one the Signals contradict.
- TITLE = Title Case, max 4 words, no brackets.
- Never use "which", "and", "because", "that" to chain clauses — one clause only.

Good example:
  WIP Stage Delay: WIP averaging 9.1d drives 58% of gross lead time.
  Reduce WIP Backlog: Cap batch sizes at Mixing to cut WIP queue.

Bad example (too long — do not do this):
  WIP Stage Delay: WIP waiting of 7.69 days is 41% of the 15.71-day gross lead time and the WIP stage averages 9.07 days which likely holds back output.

Respond in English, EXACTLY in this format (no other text):
RISK:
1. [TITLE]: [≤10-word cause + number]
2. [TITLE]: [≤10-word cause + number]
3. [TITLE]: [≤10-word cause + number]

ACTION:
1. [TITLE]: [≤10-word verb phrase]
2. [TITLE]: [≤10-word verb phrase]
3. [TITLE]: [≤10-word verb phrase]`;

  try {
    const client = getDeepSeekClient();
    const stream = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 350,
      temperature: 0.3,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = (chunk as unknown as { choices?: { delta?: { content?: string } }[] })
              .choices?.[0]?.delta?.content ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[ai-risks] DeepSeek error:", err);
    return NextResponse.json({ error: "AI analysis failed" }, { status: 500 });
  }
}
