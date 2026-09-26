/**
 * ai-models.ts — Multi-provider AI model registry
 *
 * Supports DeepSeek (primary) and Groq (fallback/additional).
 * DeepSeek V4 uses deepseek-chat model ID via api.deepseek.com (OpenAI-compatible).
 * To add a new model: append an entry to AI_MODELS below.
 */

export type ModelSpeed = "fast" | "balanced" | "thorough";
export type ModelBadgeVariant = "indigo" | "emerald" | "amber" | "cyan" | "violet";
export type ModelProvider = "groq" | "deepseek";

export interface AIModelConfig {
  /** Provider model ID passed to the API */
  id: string;
  /** Which provider serves this model */
  provider: ModelProvider;
  /** Short display name shown in UI */
  name: string;
  /** One-word badge (Fast / Smart / Reasoning) */
  badge: string;
  /** Tailwind color stem for the badge */
  badgeVariant: ModelBadgeVariant;
  /** ~6-word tagline shown as subtitle in picker */
  tagline: string;
  /** 1–2 sentence description of best-fit use cases */
  description: string;
  /** Rate-limit label for the account/tier */
  limit: string;
  /** Relative speed characteristic */
  speed: ModelSpeed;
}

// ── Model registry ─────────────────────────────────────────────────────────────

export const AI_MODELS: AIModelConfig[] = [
  // ── DeepSeek models (primary provider) ──────────────────────────────────────
  {
    id:          "deepseek-chat",
    provider:    "deepseek",
    name:        "DeepSeek V4",
    badge:       "Fast",
    badgeVariant:"emerald",
    tagline:     "Primary model — fast, smart, token-efficient",
    description: "DeepSeek V4: flagship chat model for KPI analysis, data lookups, and manufacturing conversations. Low latency, most efficient token cost.",
    limit:       "Per DeepSeek plan",
    speed:       "fast",
  },
  {
    id:          "deepseek-reasoner",
    provider:    "deepseek",
    name:        "DeepSeek R1",
    badge:       "Reasoning",
    badgeVariant:"violet",
    tagline:     "Chain-of-thought & deep root-cause analysis",
    description: "DeepSeek R1: best reasoning model for root-cause investigation, multi-KPI comparison, and questions that need step-by-step chain-of-thought.",
    limit:       "Per DeepSeek plan",
    speed:       "thorough",
  },

  // ── Groq models (backup + additional options) ────────────────────────────────
  {
    id:          "qwen/qwen3.6-27b",
    provider:    "groq",
    name:        "Qwen 3.6 (Groq)",
    badge:       "Backup",
    badgeVariant:"emerald",
    tagline:     "Reliable fallback — fast via Groq",
    description: "27B Qwen model via Groq. Main fallback for summary and chat when DeepSeek is unavailable. Low latency.",
    limit:       "1,000 req/day",
    speed:       "fast",
  },
  {
    id:          "openai/gpt-oss-120b",
    provider:    "groq",
    name:        "GPT OSS 120B (Groq)",
    badge:       "Smart",
    badgeVariant:"indigo",
    tagline:     "Large Groq model for in-depth analysis",
    description: "Largest Groq model. Best for nuanced data interpretation, long reports, and multi-step questions.",
    limit:       "1,000 req/day",
    speed:       "thorough",
  },
  {
    id:          "groq/compound",
    provider:    "groq",
    name:        "Groq Compound",
    badge:       "Balanced",
    badgeVariant:"amber",
    tagline:     "Balanced speed & quality, no token limit",
    description: "Groq compound model with no token limit. A good choice for long conversations or sessions that need a large context.",
    limit:       "250 req/day · no token limit",
    speed:       "balanced",
  },
  {
    id:          "qwen/qwen3.8-27b",
    provider:    "groq",
    name:        "Qwen 3.8 (Groq)",
    badge:       "Fast+",
    badgeVariant:"cyan",
    tagline:     "Structured instructions & formatted output",
    description: "Latest Qwen iteration via Groq. Better at following complex instructions and producing structured output such as tables.",
    limit:       "1,000 req/day",
    speed:       "fast",
  },
];

// Backward-compat alias — FloatingChat.tsx imports GROQ_MODELS
export const GROQ_MODELS = AI_MODELS;

// ── Priority lists ─────────────────────────────────────────────────────────────

/**
 * Summary priority: DeepSeek primary (fastest, fewest tokens), one Groq fallback.
 * Cached 5 hours so latency matters less — but we still prefer the fastest model.
 */
export const SUMMARY_MODEL_PRIORITY: string[] = [
  "deepseek-chat",      // primary: DeepSeek V4, fastest + lowest token cost
  "qwen/qwen3.6-27b",  // fallback: one reliable Groq model
];

/** Default model for interactive chat */
export const CHAT_DEFAULT_MODEL_ID = "deepseek-chat";

// ── Helpers ────────────────────────────────────────────────────────────────────

export function getModelConfig(id: string): AIModelConfig | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

export function getProviderForModel(id: string): ModelProvider {
  return AI_MODELS.find((m) => m.id === id)?.provider ?? "groq";
}

export function isValidModelId(id: string): boolean {
  return AI_MODELS.some((m) => m.id === id);
}

/**
 * Build fallback priority list for a chat session.
 * Preferred model goes first; all other models serve as ordered fallbacks.
 */
export function buildChatModelPriority(preferredId?: string): string[] {
  const all = AI_MODELS.map((m) => m.id);
  if (!preferredId || !isValidModelId(preferredId)) {
    return [CHAT_DEFAULT_MODEL_ID, ...all.filter((id) => id !== CHAT_DEFAULT_MODEL_ID)];
  }
  return [preferredId, ...all.filter((id) => id !== preferredId)];
}

/**
 * Returns true for error codes that mean the model is unavailable on this
 * account tier — safe to skip and try the next fallback.
 * Handles both Groq error codes and OpenAI/DeepSeek HTTP errors.
 */
export function isModelUnavailableError(err: unknown): boolean {
  const code = (err as { error?: { code?: string } })?.error?.code;
  if (code === "model_not_found" || code === "model_decommissioned") return true;
  const status = (err as { status?: number })?.status;
  if (status === 404) return true;
  const msg = (err as { message?: string })?.message?.toLowerCase() ?? "";
  if (msg.includes("model_not_found") || msg.includes("does not exist") || msg.includes("model not found")) return true;
  return false;
}
