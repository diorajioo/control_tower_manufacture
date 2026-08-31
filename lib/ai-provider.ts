import Groq from "groq-sdk";
import {
  SUMMARY_MODEL_PRIORITY,
  buildChatModelPriority,
  isModelUnavailableError,
} from "./ai-models";

export type AIProvider = "groq";

export const AI_PROVIDER: AIProvider = "groq";

/** Summary route: quality-first, 2-model list */
export const GROQ_MODEL_PRIORITY: string[] = SUMMARY_MODEL_PRIORITY;

/** Chat route: call with the user's preferred model ID to get ordered list */
export { buildChatModelPriority };

export function isGroqModelUnavailable(err: unknown): boolean {
  return isModelUnavailableError(err);
}

export function getGroqClient(): Groq {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}
