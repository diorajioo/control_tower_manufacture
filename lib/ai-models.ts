/**
 * ai-models.ts — Portable AI model registry for Groq-backed products
 *
 * Drop this file into any project that uses Groq. Set GROQ_API_KEY, import
 * what you need, and the model metadata + fallback logic travels with it.
 *
 * To add a new model: append an entry to GROQ_MODELS below.
 * To support a new provider: implement the AIModelConfig shape for that
 * provider's IDs and wire a new client factory in ai-provider.ts.
 */

export type ModelSpeed = "fast" | "balanced" | "thorough";
export type ModelBadgeVariant = "indigo" | "emerald" | "amber" | "cyan";

export interface AIModelConfig {
  /** Provider model ID passed to the API */
  id: string;
  /** Short display name shown in UI */
  name: string;
  /** One-word badge (Cepat / Smart / Seimbang) */
  badge: string;
  /** Tailwind color stem for the badge */
  badgeVariant: ModelBadgeVariant;
  /** ~6-word tagline shown as subtitle in picker */
  tagline: string;
  /** 1–2 sentence description of best-fit use cases */
  description: string;
  /** Rate-limit label for the account/tier */
  limit: string;
  /** Relative speed characteristic — used to sort/recommend */
  speed: ModelSpeed;
}

// ── Model registry ─────────────────────────────────────────────────────────────
// Update this list whenever models are added or removed from the Groq account.

export const GROQ_MODELS: AIModelConfig[] = [
  {
    id:          "openai/gpt-oss-120b",
    name:        "GPT OSS 120B",
    badge:       "Smart",
    badgeVariant:"indigo",
    tagline:     "Analisa mendalam & reasoning kompleks",
    description: "Model terbesar yang tersedia. Terbaik untuk interpretasi data yang nuanced, laporan panjang, dan pertanyaan multi-step yang butuh konteks penuh.",
    limit:       "1.000 req/hari",
    speed:       "thorough",
  },
  {
    id:          "qwen/qwen3.6-27b",
    name:        "Qwen 3.6 (27B)",
    badge:       "Cepat",
    badgeVariant:"emerald",
    tagline:     "Respon cepat, lookup data, analisa ringkas",
    description: "27B model dengan TTFB lebih rendah dari model besar. Cocok untuk pertanyaan langsung, cek angka KPI, atau analisa singkat yang butuh respons cepat.",
    limit:       "1.000 req/hari",
    speed:       "fast",
  },
  {
    id:          "groq/compound",
    name:        "Groq Compound",
    badge:       "Seimbang",
    badgeVariant:"amber",
    tagline:     "Kecepatan & kualitas seimbang, no token limit",
    description: "Model compound tanpa batas token. Pilihan terbaik untuk percakapan panjang, analisa multi-langkah, atau sesi yang butuh konteks besar.",
    limit:       "250 req/hari · no token limit",
    speed:       "balanced",
  },
  {
    id:          "qwen/qwen3.8-27b",
    name:        "Qwen 3.8 (27B)",
    badge:       "Cepat+",
    badgeVariant:"cyan",
    tagline:     "Instruksi terstruktur & data terformat",
    description: "Iterasi terbaru Qwen. Lebih baik dalam mengikuti instruksi kompleks dan memproses output terstruktur seperti tabel atau daftar.",
    limit:       "1.000 req/hari",
    speed:       "fast",
  },
];

// ── Priority lists ─────────────────────────────────────────────────────────────

/**
 * Summary uses quality-first order.
 * Cached for 5 hours so latency matters less than output quality.
 * Keep this short: 1 primary + 1 safety fallback.
 */
export const SUMMARY_MODEL_PRIORITY: string[] = [
  "openai/gpt-oss-120b",
  "qwen/qwen3.6-27b",
];

/** Default model for interactive chat (speed > quality) */
export const CHAT_DEFAULT_MODEL_ID = "qwen/qwen3.6-27b";

// ── Helpers ────────────────────────────────────────────────────────────────────

export function getModelConfig(id: string): AIModelConfig | undefined {
  return GROQ_MODELS.find((m) => m.id === id);
}

export function isValidModelId(id: string): boolean {
  return GROQ_MODELS.some((m) => m.id === id);
}

/**
 * Build the fallback priority list for a chat session.
 * If the user picked a specific model, try it first; remaining models
 * serve as ordered fallbacks so the session never hard-fails on one model.
 */
export function buildChatModelPriority(preferredId?: string): string[] {
  const all = GROQ_MODELS.map((m) => m.id);
  if (!preferredId || !isValidModelId(preferredId)) {
    // Default: fast models first
    return [CHAT_DEFAULT_MODEL_ID, ...all.filter((id) => id !== CHAT_DEFAULT_MODEL_ID)];
  }
  return [preferredId, ...all.filter((id) => id !== preferredId)];
}

/**
 * Returns true for Groq error codes that mean the model is unavailable
 * on this account tier — safe to skip and try the next fallback.
 */
export function isModelUnavailableError(err: unknown): boolean {
  const code = (err as { error?: { code?: string } })?.error?.code;
  return code === "model_not_found" || code === "model_decommissioned";
}
