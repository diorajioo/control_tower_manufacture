// One non-streamed AI completion with model fallback (GROQ_MODEL_PRIORITY) — shared by Teams cards and the
// Lead Time note draft. Returns undefined on any failure; callers always have a non-AI fallback.

import { GROQ_MODEL_PRIORITY, isAIModelUnavailable, getClientForModel } from "@/lib/ai-provider";

/** One non-streamed completion with model fallback; undefined on failure (the card goes out without it). */
export async function complete(system: string, user: string): Promise<string | undefined> {
  if (!process.env.DEEPSEEK_API_KEY && !process.env.GROQ_API_KEY) return undefined;
  for (const modelId of GROQ_MODEL_PRIORITY) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (getClientForModel(modelId) as any).chat.completions.create({
        model: modelId,
        max_tokens: 500,
        temperature: 0.3,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      });
      const text = String(res.choices?.[0]?.message?.content ?? "")
        .replace(/<think>[\s\S]*?<\/think>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      return text || undefined;
    } catch (err) {
      if (isAIModelUnavailable(err)) continue;
      console.error("[ai] completion failed:", err);
      return undefined;
    }
  }
  return undefined;
}
