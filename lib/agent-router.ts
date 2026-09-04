/**
 * agent-router.ts — Automatic model selection based on question complexity
 *
 * Drop-in for any product using ai-models.ts. The router classifies an
 * incoming message and picks the most cost-efficient model that can handle it.
 *
 * Integration: import { routeModel } from "@/lib/agent-router" and call it
 * with the latest user message before building the Groq request. The returned
 * model ID takes priority over the user's manual selection for that turn only.
 */

export type QuestionComplexity = "simple" | "moderate" | "complex";

// ── Classification ─────────────────────────────────────────────────────────────

/**
 * Simple heuristic classifier — fast, zero-cost, no extra API call.
 *
 * "simple"   → single-KPI lookup, short questions, basic acknowledgements
 * "moderate" → multi-metric questions, short trend analysis
 * "complex"  → root-cause analysis, comparisons, recommendations, long context
 */
export function classifyQuestion(message: string): QuestionComplexity {
  const text = message.trim().toLowerCase();
  const wordCount = text.split(/\s+/).length;

  // Explicit complexity signals — evaluate complex first so they aren't
  // misclassified as simple even when the message is short.
  const complexPatterns = [
    /kenapa|mengapa|penyebab|root.?cause/,
    /rekomendasi|saran|langkah|action/,
    /bandingkan|perbandingan|compare|vs\.?\s/,
    /analisa|analisis|analyz|investigasi/,
    /tren|trend|pola|pattern|anomali/,
    /prediksi|forecast|proyeksi/,
    /multi.?step|serangkaian|beberapa.*kpi/,
  ];

  const simplePatterns = [
    /^berapa\b/,
    /^apa itu\b/,
    /^tampilkan\b/,
    /^lihat\b/,
    /^cek\b/,
    /^show\b/,
    /^what is\b/,
    /^how much\b/,
    /nilai.*(oee|rft|lead.?time|ope|output)/,
    /^(ok|oke|ya|yes|no|tidak|thanks|terima kasih)$/,
  ];

  if (complexPatterns.some((p) => p.test(text))) return "complex";
  if (wordCount <= 12 && simplePatterns.some((p) => p.test(text))) return "simple";
  if (wordCount <= 20) return "moderate";
  return "complex";
}

// ── Model mapping ──────────────────────────────────────────────────────────────
//
// Maps complexity → preferred model ID from GROQ_MODELS.
// The chat route's existing fallback list handles unavailable models; this only
// sets the front of the priority queue.

export const COMPLEXITY_MODEL_MAP: Record<QuestionComplexity, string> = {
  simple:   "qwen/qwen3.6-27b",      // lowest latency
  moderate: "qwen/qwen3.8-27b",      // structured output, balanced
  complex:  "openai/gpt-oss-120b",   // deepest reasoning
};

/**
 * Classify the message and return the recommended model ID.
 * The chat route should treat this as the preferred model for the turn,
 * overriding the user's manual selection only when the agent deems it necessary.
 *
 * Pass `allowOverride = false` to use the result as a suggestion only — the
 * caller decides whether to honour it.
 */
export function routeModel(
  message: string,
  options: { allowDowngrade?: boolean } = {}
): { modelId: string; complexity: QuestionComplexity; reason: string } {
  const complexity = classifyQuestion(message);
  const modelId = COMPLEXITY_MODEL_MAP[complexity];

  const reasons: Record<QuestionComplexity, string> = {
    simple:   "Pertanyaan lookup langsung — model cepat dipilih untuk latensi rendah.",
    moderate: "Analisa singkat — model balanced dipilih untuk output terstruktur.",
    complex:  "Pertanyaan multi-step atau analisa mendalam — model terkuat dipilih.",
  };

  // When downgrade is disabled (default), complex questions always get the
  // strongest model regardless of user's manual selection.
  if (!options.allowDowngrade && complexity === "complex") {
    return { modelId, complexity, reason: reasons[complexity] };
  }

  return { modelId, complexity, reason: reasons[complexity] };
}