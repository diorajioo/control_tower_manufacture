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
- RISK desc: exactly 2 sentences. Sentence 1 = the fact with a number. Sentence 2 = the implication or mechanism. Each sentence must add new information — never restate sentence 1.
- ACTION desc: 1–2 sentences. Sentence 1 = the concrete action. Sentence 2 = why it addresses the root cause (optional, only if it adds something).
- No clause-chaining within a sentence ("which", "and ... which", "that ... and"). One idea per sentence.
- Only list a risk the data supports; never list one the Signals contradict.
- TITLE = Title Case, max 4 words, no brackets.

Good RISK example:
  Bulk Output Drop: Bulk output declined 3.1% despite an 11.7% rise in Released FG. The productivity gap (7.6 kg vs. 333.3 pcs/manhour) suggests inconsistent bulk release timing is disrupting packing flow.

Bad RISK example (one sentence, clause-chained, repetitive — do not do this):
  WIP Stage Delay: WIP waiting of 7.69 days is 41% of the 15.71-day gross lead time and the WIP stage averages 9.07 days (58% of gross), which likely holds back Released FG by tying up work-in-process that Little's law says should be flowing to output.

Respond in English, EXACTLY in this format (no other text):
RISK:
1. [TITLE]: [2-sentence risk]
2. [TITLE]: [2-sentence risk]
3. [TITLE]: [2-sentence risk]

ACTION:
1. [TITLE]: [1–2-sentence action]
2. [TITLE]: [1–2-sentence action]
3. [TITLE]: [1–2-sentence action]`;

  try {
    const client = getDeepSeekClient();
    const stream = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
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
