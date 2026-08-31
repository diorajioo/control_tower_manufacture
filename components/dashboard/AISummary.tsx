"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";

const KPI_CHIP_LABELS: Record<string, string> = {
  leadtime:     "Lead Time",
  yield:        "Yield",
  rft:          "RFT",
  output:       "Output",
  oee:          "OEE",
  ope:          "OPE",
  productivity: "Produktivitas",
};

function SummaryText({ text }: { text: string }) {
  const parts = text.split(/(\[kpi:[a-z]+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const kpiMatch = part.match(/^\[kpi:([a-z]+)\]$/);
        if (kpiMatch) {
          const kpiId = kpiMatch[1];
          const label = KPI_CHIP_LABELS[kpiId] ?? kpiId;
          return (
            <button
              key={i}
              onClick={() => window.dispatchEvent(new CustomEvent("kpi-highlight", { detail: { kpi: kpiId } }))}
              title={`Highlight ${label} di dashboard`}
              className="inline-flex items-center gap-0.5 text-[10px] text-white bg-white/20 hover:bg-white/35 border border-white/20 px-1.5 py-0.5 rounded-md font-semibold transition-colors ml-0.5 align-middle cursor-pointer"
            >
              {label} ↗
            </button>
          );
        }
        return part;
      })}
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
