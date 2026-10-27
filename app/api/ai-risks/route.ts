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

Each RISK description is one sentence that names the cause → effect chain with numbers from the data
(e.g. "WIP waiting of X days is most of the gross lead time, which likely holds back Released FG").
Each ACTION targets the cause in that chain, not the symptom.
Only list a risk the data supports; never list one the Signals contradict (fewer, solid risks beat speculative ones).
TITLE = short Title Case label, max 5 words, no brackets.

Respond in English, EXACTLY in this format (no other text):
RISK:
1. [TITLE]: [cause → effect, one sentence]
2. [TITLE]: [cause → effect, one sentence]
3. [TITLE]: [cause → effect, one sentence]

ACTION:
1. [TITLE]: [concrete action on the cause]
2. [TITLE]: [concrete action on the cause]
3. [TITLE]: [concrete action on the cause]`;

  try {
    const client = getDeepSeekClient();
    const stream = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
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
