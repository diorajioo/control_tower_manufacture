// Lead Time card note — AI draft from variables (2026-10-13). The AI only turns the variables the page shows into a
// sentence; every number in its answer must be one of them, otherwise null (the page keeps the code-written note).

import { complete } from "@/lib/aiComplete";

export interface NoteFacts {
  basis: "gross" | "nett";
  scope: "created" | "released";
  unit: "days" | "hours";
  avg: string; median: string; p25: string; p75: string; max: string; poCount: string;
  target?: string; gap?: string; trendPct?: string;
  onTime?: string; atRisk?: string; late?: string;
  largest?: { label: string; value: string; share: string };
}

const PROMPT = `You write the short note under a Lead Time KPI card for plant and operations managers.
Write 1–2 sentences, at most 40 words, plain English, no emoji, no markdown.
Cover, in this order: the middle of the distribution (median and the range where half of the POs fall),
the gap to the target when a target is given, and the largest time block as the main driver.
Copy numbers exactly as written in Variables, with their unit; use no other numbers and do not compute new ones.
Never mention manhours, headcount, demand or any cause that is not in Variables.`;

export function factsText(f: NoteFacts): string {
  const u = f.unit;
  return [
    `Basis: ${f.basis} lead time (${f.basis === "gross" ? `${f.scope === "released" ? "PO Released" : "PO Created"} → Receive NDC` : "active production time"})`,
    `Average ${f.avg} ${u}; median ${f.median} ${u}; half of the POs between ${f.p25} and ${f.p75} ${u}; max ${f.max} ${u}; ${f.poCount} POs`,
    f.target ? `Target ${f.target} ${u}; gap ${f.gap} ${u}` : "No target for this basis",
    f.trendPct ? `Change vs prior period ${f.trendPct}%` : "",
    f.late ? `POs on time ${f.onTime}, at risk ${f.atRisk}, late ${f.late}` : "",
    f.largest ? `Largest time block: ${f.largest.label} ${f.largest.value} ${u} (${f.largest.share}% of process time)` : "",
  ].filter(Boolean).join("\n");
}

/** Every number in the text must be one of the variables (commas ignored, ±0.005). */
export function numbersAllowed(text: string, f: NoteFacts): boolean {
  const allowed = [f.avg, f.median, f.p25, f.p75, f.max, f.poCount, f.target, f.gap, f.trendPct, f.onTime, f.atRisk, f.late,
    f.largest?.value, f.largest?.share]
    .filter((v): v is string => !!v)
    .map((v) => Math.abs(Number(v.replace(/[,+%−-]/g, ""))))
    .filter((n) => Number.isFinite(n));
  const found = (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((v) => Number(v.replace(/,/g, "")));
  return found.every((n) => allowed.some((a) => Math.abs(a - n) < 0.005));
}

export async function draftLeadTimeNote(factsJson: string): Promise<string | null> {
  const f = JSON.parse(factsJson) as NoteFacts;
  const text = await complete(PROMPT, `Variables:\n${factsText(f)}\n\nWrite the note:`);
  if (!text || text.length > 400) return null;
  return numbersAllowed(text, f) ? text : null;
}
