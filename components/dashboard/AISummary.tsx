"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";

// KPI keyword → look for the next number within 50 chars and make it clickable
const KPI_KEYWORDS: { pattern: RegExp; id: string }[] = [
  { pattern: /lead[\s-]?time/gi,                     id: "leadtime"     },
  { pattern: /bulk[\s-]?loss|pack[\s-]?loss/gi,      id: "yield"        },
  { pattern: /right[\s-]?first[\s-]?time|\bRFT\b/g, id: "rft"          },
  { pattern: /\bOEE\b/g,                             id: "oee"          },
  { pattern: /\bOPE\b/g,                             id: "ope"          },
  { pattern: /produktivitas|\bproductivity\b/gi,     id: "productivity" },
  { pattern: /\boutput\b/gi,                         id: "output"       },
];
const NUM_RE = /\d+(?:[.,]\d+)?\s*(?:%|hari|days|kg|pcs)?/;

interface Segment { text: string; kpi?: string }

function parseSummary(text: string): Segment[] {
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
            onClick={(e) => {
              e.stopPropagation(); // prevent main onClick from clearing highlight
              window.dispatchEvent(new CustomEvent("kpi-highlight", { detail: { kpi: seg.kpi } }));
            }}
            title={`Highlight di dashboard`}
            className="font-bold underline decoration-white/50 underline-offset-2 hover:decoration-white hover:text-white transition-colors cursor-pointer"
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

const CACHE_TEXT = "ai_summary_text";
const CACHE_TIME = "ai_summary_time";
const TTL_MS    = 5 * 60 * 60 * 1000; // 5 hours

export function AISummary({ kpi, filters, ready }: AISummaryProps) {
  const [summary,  setSummary]  = useState(() =>
    typeof window !== "undefined" ? (localStorage.getItem(CACHE_TEXT) ?? "") : ""
  );
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const abortRef   = useRef<AbortController | null>(null);
  const accumRef   = useRef("");

  const fetchSummary = async (force = false) => {
    if (!kpi || !ready) return;

    // Skip if cache is fresh and not a forced refresh
    if (!force) {
      const cachedTime = Number(localStorage.getItem(CACHE_TIME) ?? 0);
      const cachedText = localStorage.getItem(CACHE_TEXT) ?? "";
      if (cachedText && Date.now() - cachedTime < TTL_MS) return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setSummary("");
    accumRef.current = "";
    setError(false);
    setErrorMsg("");

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

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        accumRef.current += text;
        setSummary((prev) => prev + text);
      }

      // Persist to cache only on success
      localStorage.setItem(CACHE_TEXT, accumRef.current);
      localStorage.setItem(CACHE_TIME, String(Date.now()));
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch only when ready first becomes true — NOT on every filter change
  useEffect(() => {
    if (ready) fetchSummary();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Age label for cached summary
  const cachedTime = typeof window !== "undefined"
    ? Number(localStorage.getItem(CACHE_TIME) ?? 0) : 0;
  const ageHours = cachedTime ? Math.floor((Date.now() - cachedTime) / (60 * 60 * 1000)) : null;
  const ageLabel = ageHours === 0 ? "baru saja"
    : ageHours === 1 ? "1 jam lalu"
    : ageHours != null ? `${ageHours} jam lalu`
    : null;

  return (
    <div className="bg-gradient-to-r from-brand-800 via-brand-700 to-brand-600 rounded-xl px-3 py-2 mb-2 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="bg-white/10 rounded-md p-1 shrink-0">
          <Sparkles size={11} className="text-blue-300" />
        </div>
        <span className="text-[10px] font-semibold text-blue-200 uppercase tracking-wider shrink-0">AI Summary</span>

        <div className="flex-1 min-w-0">
          {(loading && !summary) && (
            <div className="flex gap-1.5 items-center">
              <div className="h-2 bg-white/10 rounded-full w-48 animate-pulse" />
              <div className="h-2 bg-white/10 rounded-full w-32 animate-pulse" />
            </div>
          )}
          {(summary || loading) && (
            <p className="text-xs text-blue-50 leading-relaxed">
              <SummaryText text={summary} />
              {loading && <span className="inline-block w-0.5 h-3 bg-blue-300 ml-0.5 animate-pulse align-middle" />}
            </p>
          )}
          {error && (
            <div className="flex items-center gap-1.5 text-[11px] text-red-300">
              <AlertCircle size={11} />
              <span>{errorMsg || "Gagal memuat ringkasan AI"}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {ageLabel && !loading && !error && (
            <span className="text-[10px] text-blue-300/60 shrink-0">{ageLabel}</span>
          )}
          <button
            onClick={() => fetchSummary(true)}
            disabled={loading}
            className="flex items-center gap-1 text-[10px] text-blue-300 hover:text-white transition-colors px-1.5 py-0.5 rounded hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
            {loading ? "..." : "Refresh"}
          </button>
        </div>
      </div>
    </div>
  );
}
