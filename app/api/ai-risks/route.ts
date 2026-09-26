import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDeepSeekClient, isDeepSeekConfigured } from "@/lib/deepseek";

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

  const prompt = `Analyze the following manufacturing KPI data and identify the top risks and required actions:\n${JSON.stringify(kpi, null, 2)}\n\nPlant: ${filters.plant}, Period: ${filters.period}\n\nRespond in English, EXACTLY in this format (no other text):\nRISK:\n1. [TITLE]: [brief description]\n2. [TITLE]: [brief description]\n3. [TITLE]: [brief description]\n\nACTION:\n1. [TITLE]: [concrete action]\n2. [TITLE]: [concrete action]\n3. [TITLE]: [concrete action]`;

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
