/**
 * deepseek.ts — DeepSeek API client (OpenAI-compatible)
 *
 * DeepSeek exposes the same API contract as OpenAI. We use the openai SDK
 * with a custom baseURL so we get full TypeScript types + streaming support
 * without a separate SDK.
 *
 * Model IDs: "deepseek-chat" (V4 fast), "deepseek-reasoner" (R1 reasoning)
 * API docs: https://platform.deepseek.com/api-docs/
 */

import OpenAI from "openai";

export function getDeepSeekClient(): OpenAI {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY not configured");
  return new OpenAI({
    baseURL: "https://api.deepseek.com/v1",
    apiKey: process.env.DEEPSEEK_API_KEY,
  });
}

export function isDeepSeekConfigured(): boolean {
  return !!process.env.DEEPSEEK_API_KEY;
}
