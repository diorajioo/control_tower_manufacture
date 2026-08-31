import Groq from "groq-sdk";

export type AIProvider = "groq" | "gemini";

export const AI_PROVIDER: AIProvider =
  (process.env.AI_PROVIDER as AIProvider) ?? "groq";

// Ordered by preference — first available model wins
export const GROQ_MODEL_PRIORITY: string[] = process.env.GROQ_MODEL
  ? [process.env.GROQ_MODEL]
  : [
      "openai/gpt-oss-120b",
      "groq/compound",
      "qwen/qwen3.6-27b",
      "qwen/qwen3.8-27b",
    ];

export function isGroqModelUnavailable(err: unknown): boolean {
  const code = (err as { error?: { code?: string } })?.error?.code;
  return code === "model_not_found" || code === "model_decommissioned";
}

export function getGroqClient(): Groq {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}
