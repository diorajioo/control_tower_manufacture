/**
 * ai-provider.ts — Multi-provider AI client factory
 *
 * Routes model calls to the correct SDK client based on the model's provider.
 * DeepSeek models → openai SDK (DeepSeek base URL)
 * Groq models → groq-sdk
 *
 * Both SDKs share the same chat.completions.create() interface and streaming
 * contract, so consumer code (summary/chat routes) works identically for both.
 */

import Groq from "groq-sdk";
import OpenAI from "openai";
import { getDeepSeekClient, isDeepSeekConfigured } from "./deepseek";
import {
  SUMMARY_MODEL_PRIORITY,
  buildChatModelPriority,
  isModelUnavailableError,
  getProviderForModel,
  type ModelProvider,
} from "./ai-models";

export type { ModelProvider };
export { buildChatModelPriority, isModelUnavailableError as isGroqModelUnavailable };

/** Summary priority list — same as SUMMARY_MODEL_PRIORITY */
export const GROQ_MODEL_PRIORITY: string[] = SUMMARY_MODEL_PRIORITY;

export function getGroqClient(): Groq {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

export { getDeepSeekClient, isDeepSeekConfigured };

/**
 * Return the correct SDK client for a given model ID.
 * Both Groq and OpenAI clients share the same chat.completions.create() API.
 */
export function getClientForModel(modelId: string): Groq | OpenAI {
  const provider = getProviderForModel(modelId);
  return provider === "deepseek" ? getDeepSeekClient() : getGroqClient();
}

/**
 * True when the error indicates the model is unavailable on this account tier.
 * Handles both Groq and DeepSeek/OpenAI error shapes.
 */
export function isAIModelUnavailable(err: unknown): boolean {
  return isModelUnavailableError(err);
}
