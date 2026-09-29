"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { highlightKpi, isKpiHighlightId, KPI_TRIGGER_ATTR } from "@/components/ui/KpiHighlight";

// KPI keyword → look for the next number within 50 chars and make it clickable.
// Only IDs that have a highlight target (KPI_HIGHLIGHT_IDS) become clickable.
const KPI_KEYWORDS: { pattern: RegExp; id: string }[] = [
  { pattern: /lead[\s-]?time/gi,                              id: "leadtime"     },
  { pattern: /produktivitas|\bproductivity\b/gi,              id: "productivity" },
  { pattern: /\boutput\b|released\s+FG|finished\s+goods?/gi, id: "output"       },
].filter((k) => isKpiHighlightId(k.id));
// Number with optional thousands separators ("37,421,683") and unit
const NUM = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*(?:%|days?|hours?|hari|kg|pcs\/manhour|pcs\/mh|pieces per manhour|pcs|pieces)?`;
const NUM_RE     = new RegExp(NUM);
const NUM_END_RE = new RegExp(`${NUM}$`);
// "[kpi:ID]" tag written by the model right after a number (see SYSTEM_PROMPT in /api/dashboard/summary)
const TAG_RE     = /\s?\[kpi:([a-z]+)\]/g;

interface Segment { text: string; kpi?: string }

/** Tagged summary: the number right before each [kpi:ID] becomes clickable; tags are removed. */
function parseTagged(text: string): Segment[] {
  const segs: Segment[] = [];
  let pos = 0;
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(text)) !== null) {
    const before = text.slice(pos, m.index);
    const num = NUM_END_RE.exec(before);
    if (num && isKpiHighlightId(m[1])) {
      if (num.index > 0) segs.push({ text: before.slice(0, num.index) });
      segs.push({ text: num[0], kpi: m[1] });
    } else if (before) {
      segs.push({ text: before });
    }
    pos = m.index + m[0].length;
  }
  // Hide a tag that is still streaming in ("… 16.98 days [kpi:lea")
  const rest = text.slice(pos).replace(/\s?\[[a-z:]*$/, "");
  if (rest) segs.push({ text: rest });
  return segs;
}

function parseSummary(text: string): Segment[] {
  if (text.includes("[kpi:")) return parseTagged(text);
  // Fallback for untagged text: keyword → first number within 50 chars
  const hits: { start: number; end: number; id: string; raw: string }[] = [];
  const seen = new Set<string>();

  for (const { pattern, id } of KPI_KEYWORDS) {
    if (seen.has(id)) continue;
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 50);
      const num = NUM_RE.exec(after);
      if (num) {
        const start = m.index + m[0].length + num.index;
        const end   = start + num[0].length;
        if (!hits.some(h => h.start < end && h.end > start)) {
          hits.push({ start, end, id, raw: text.slice(start, end) });
          seen.add(id);
          break;
        }
      }
    }
  }

  hits.sort((a, b) => a.start - b.start);

  const segs: Segment[] = [];
  let pos = 0;
  for (const h of hits) {
    if (h.start > pos) segs.push({ text: text.slice(pos, h.start) });
    segs.push({ text: h.raw, kpi: h.id });
    pos = h.end;
  }
  if (pos < text.length) segs.push({ text: text.slice(pos) });
  return segs;
}

function SummaryText({ text }: { text: string }) {
  const segments = parseSummary(text);
  return (
    <>
      {segments.map((seg, i) =>
        seg.kpi ? (
          <button
            key={i}
            {...KPI_TRIGGER_ATTR}
            onClick={() => highlightKpi(seg.kpi!)}
            title={`Highlight on dashboard`}
            className="font-bold text-[#215AA8] underline decoration-[#A6BDDC] underline-offset-2 hover:decoration-[#215AA8] transition-colors cursor-pointer"
          >
            {seg.text}
          </button>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

interface AISummaryProps {
  kpi: unknown;
  filters: {
    plant: string;
    startDate: string;
    endDate: string;
    dataLevel: string;
  };
  ready: boolean;
}

// "_v3": invalidates summaries cached before the model started writing [kpi:ID] tags.
const CACHE_TEXT = "ai_summary_text_v3";
const CACHE_TIME = "ai_summary_time_v3";
// Filters the cached summary was generated for — a different plant/period regenerates it.
const CACHE_KEY  = "ai_summary_key_v3";
const TTL_MS    = 5 * 60 * 60 * 1000; // 5 hours

export function AISummary({ kpi, filters, ready }: AISummaryProps) {
  const filterKey = [filters.plant, filters.startDate, filters.endDate].join("|");
  const [summary,   setSummary]   = useState(() =>
    typeof window !== "undefined" && localStorage.getItem(CACHE_KEY) === filterKey
      ? (localStorage.getItem(CACHE_TEXT) ?? "") : ""
  );
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(false);
  const [errorMsg,  setErrorMsg]  = useState("");
  const [truncated, setTruncated] = useState(false);
  const abortRef    = useRef<AbortController | null>(null);
  const accumRef    = useRef("");

  const fetchSummary = async (force = false) => {
    if (!kpi || !ready) return;

    // Skip if cache is fresh and not a forced refresh
    if (!force) {
      const cachedTime = Number(localStorage.getItem(CACHE_TIME) ?? 0);
      const cachedText = localStorage.getItem(CACHE_TEXT) ?? "";
      const sameFilters = localStorage.getItem(CACHE_KEY) === filterKey;
      if (cachedText && sameFilters && Date.now() - cachedTime < TTL_MS) return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setSummary("");
    accumRef.current = "";
    setError(false);
    setErrorMsg("");
    setTruncated(false);

    try {
      const res = await fetch("/api/dashboard/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kpi, filters }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = body?.error ?? `HTTP ${res.status}`;
        setErrorMsg(detail);
        throw new Error(detail);
      }
      if (!res.body) throw new Error("No response body");

      const SENTINEL = "\n​[DONE]​";
      const reader   = res.body.getReader();
      const decoder  = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        accumRef.current += text;
        // Strip the sentinel before displaying so it never shows in the UI
        const display = accumRef.current.replace(SENTINEL, "");
        setSummary(display);
      }

      const complete = accumRef.current.includes(SENTINEL);
      const clean    = accumRef.current.replace(SENTINEL, "").trim();

      if (complete) {
        localStorage.setItem(CACHE_TEXT, clean);
        localStorage.setItem(CACHE_TIME, String(Date.now()));
        localStorage.setItem(CACHE_KEY, filterKey);
        setSummary(clean);
      } else {
        // Stream was cut — show what arrived but do NOT cache so next load retries
        setSummary(clean);
        setTruncated(true);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when ready becomes true (initial load and after each filter change);
  // the cache check skips the call if a fresh summary exists for the same filters
  useEffect(() => {
    if (ready) fetchSummary();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Age label for cached summary
  const cachedTime = typeof window !== "undefined"
    ? Number(localStorage.getItem(CACHE_TIME) ?? 0) : 0;
  const ageHours = cachedTime ? Math.floor((Date.now() - cachedTime) / (60 * 60 * 1000)) : null;
  const ageLabel = ageHours === 0 ? "just now"
    : ageHours === 1 ? "1 hour ago"
    : ageHours != null ? `${ageHours} hours ago`
    : null;

  return (
    <div className="bg-white rounded-lg border border-[#EBEBEB] border-l-[3px] border-l-[#215AA8] px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#215AA8]">
          AI Summary
        </span>

        <div className="flex-1 min-w-0">
          {(loading && !summary) && (
            <div className="flex gap-1.5 items-center">
              <div className="h-2 bg-[#EBEBEB] rounded-full w-48 animate-pulse" />
              <div className="h-2 bg-[#EBEBEB] rounded-full w-32 animate-pulse" />
            </div>
          )}
          {(summary || loading) && (
            <p className="text-[13px] text-[#2A3D4A] leading-relaxed">
              <SummaryText text={summary} />
              {loading && <span className="inline-block w-0.5 h-3 bg-[#215AA8] ml-0.5 animate-pulse align-middle" />}
              {truncated && !loading && (
                <span className="ml-1.5 text-[#D1A400] text-[10px]">— truncated, click Refresh</span>
              )}
            </p>
          )}
          {error && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#E6001C]">
              <AlertCircle size={11} />
              <span>{errorMsg || "Failed to load AI summary"}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {ageLabel && !loading && !error && (
            <span className="text-[10px] text-[#7A7A7A] shrink-0">{ageLabel}</span>
          )}
          <button
            onClick={() => fetchSummary(true)}
            disabled={loading}
            className="flex items-center gap-1 text-[10px] text-[#215AA8] hover:text-[#1A4886] transition-colors px-1.5 py-0.5 rounded hover:bg-[#D3DEEE] disabled:opacity-50"
          >
            <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
            {loading ? "..." : "Refresh"}
          </button>
        </div>
      </div>
    </div>
  );
}
