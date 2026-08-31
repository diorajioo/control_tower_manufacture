import Groq from "groq-sdk";

export type AIProvider = "groq" | "gemini";

export const AI_PROVIDER: AIProvider =
  (process.env.AI_PROVIDER as AIProvider) ?? "groq";

export const AI_MODELS: Record<AIProvider, string> = {
  groq: process.env.GROQ_MODEL ?? "llama-3.1-8b-instant",
  gemini: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
};

export function getGroqClient(): Groq {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// --- Gemini slot ---
// 1. npm install @google/generative-ai
// 2. Set GEMINI_API_KEY di .env.local
// 3. Set AI_PROVIDER=gemini di .env.local
// 4. Uncomment kode di bawah dan sesuaikan di app/api/chat/route.ts
//
// import { GoogleGenerativeAI } from "@google/generative-ai";
// export function getGeminiClient() {
//   if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
//   return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// }
