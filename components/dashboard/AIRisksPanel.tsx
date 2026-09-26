"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { KPIAlert } from "@/lib/alerts";

interface Risk { title: string; desc: string; level: "warn" | "info" }
interface Action { num: string; title: string; desc: string }

interface AIRisksPanelProps {
  kpi: unknown;
  alerts: KPIAlert[];
  filters: { plant: string; period: string; startDate: string; endDate: string };
  ready: boolean;
}

function parseRisksAndActions(text: string): { risks: Risk[]; actions: Action[] } {
  const risks: Risk[] = [];
  const actions: Action[] = [];

  const riskMatch = text.match(/RISK:([\s\S]*?)(?:ACTION:|$)/i);
  const actionMatch = text.match(/ACTION:([\s\S]*?)$/i);

  if (riskMatch) {
    for (const line of riskMatch[1].trim().split("\n").filter(Boolean)) {
      const m = line.match(/^\d+\.\s*\[?([^\]:\n]+)\]?:\s*(.+)/);
      if (m) risks.push({ title: m[1].trim(), desc: m[2].trim(), level: "warn" });
    }
  }
  if (actionMatch) {
    for (const line of actionMatch[1].trim().split("\n").filter(Boolean).slice(0, 3)) {
      const m = line.match(/^(\d+)\.\s*\[?([^\]:\n]+)\]?:\s*(.+)/);
      if (m) actions.push({ num: String(m[1]).padStart(2, "0"), title: m[2].trim(), desc: m[3].trim() });
    }
  }
  return { risks, actions };
}

export function AIRisksPanel({ kpi, alerts, filters, ready }: AIRisksPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(false);
  const [risks,   setRisks]   = useState<Risk[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const fetchRisks = async (force = false) => {
    if (!kpi || !ready) return;

    const cacheKey  = `ai_risks_${filters.plant}_${filters.period}`;
    const cacheTime = `${cacheKey}_time`;
    if (!force) {
      try {
        const txt = localStorage.getItem(cacheKey);
        const age = Number(localStorage.getItem(cacheTime) ?? 0);
        if (txt && Date.now() - age < 3 * 60 * 60 * 1000) {
          const p = JSON.parse(txt);
          // Skip incomplete entries cached before the fix
          if (p.risks?.length > 0 && p.actions?.length > 0) { setRisks(p.risks); setActions(p.actions); return; }
        }
      } catch { /* ignore */ }
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(false); setRisks([]); setActions([]);

    try {
      const res = await fetch("/api/ai-risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kpi, filters }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) throw new Error("fetch failed");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
      }

      const parsed = parseRisksAndActions(acc);
      setRisks(parsed.risks); setActions(parsed.actions);
      // Cache only a complete answer — a cut-off stream would otherwise stick for 3 hours
      if (parsed.risks.length > 0 && parsed.actions.length > 0) {
        try {
          localStorage.setItem(cacheKey,  JSON.stringify(parsed));
          localStorage.setItem(cacheTime, String(Date.now()));
        } catch { /* ignore */ }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready && kpi) fetchRisks();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const displayRisks: Risk[] = risks.length > 0 ? risks : alerts.slice(0, 3).map((a) => ({
    title: a.kpi,
    desc:  a.message,
    level: a.severity === "critical" ? "warn" : "info" as const,
  }));

  const displayActions: Action[] = actions.length > 0 ? actions : alerts.slice(0, 3).map((a, i) => ({
    num:   String(i + 1).padStart(2, "0"),
    title: a.kpi,
    desc:  (a as KPIAlert & { recommendation?: string }).recommendation ?? a.message,
  }));

  return (
    <div className="bg-white border border-[#EBEBEB] rounded-lg flex flex-col overflow-hidden">
      <div className="px-3.5 py-2 border-b border-[#EBEBEB] flex items-center gap-2 shrink-0">
        <span
          className="inline-flex items-center gap-1 px-2 py-[2px] rounded text-[10px] font-bold text-white shrink-0"
          style={{ background: "linear-gradient(90deg,#725DA3,#864A9C)" }}
        >
          ✦ AI
        </span>
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em]">
          Risks &amp; Recommendations
        </span>
        <button
          onClick={() => fetchRisks(true)}
          disabled={loading}
          className="ml-auto text-[#215AA8] hover:text-[#1A4886] transition-colors disabled:opacity-40"
          title="Refresh AI analysis"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-3 pt-2 pb-2 border-b border-[#EBEBEB]">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1.5">Top Risks</p>
          {loading && displayRisks.length === 0 ? (
            <div className="space-y-1.5">
              {[1, 2].map((i) => <div key={i} className="h-10 bg-[#F7F8FA] rounded-md animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-1.5">
              {displayRisks.slice(0, 3).map((r, i) => (
                <div
                  key={i}
                  className={r.level === "warn"
                    ? "rounded-md px-2 py-1.5 bg-[#FFFBE4] border border-[#fcd34d]"
                    : "rounded-md px-2 py-1.5 bg-[#F7F8FA] border border-[#EBEBEB]"}
                >
                  <p className={`text-[10px] font-bold uppercase tracking-[0.08em] mb-0.5 ${r.level === "warn" ? "text-[#b45309]" : "text-slate-500"}`}>
                    {r.title}
                  </p>
                  <p className="text-[11.5px] text-[#2A3D4A] leading-[1.35]">{r.desc}</p>
                </div>
              ))}
              {error && displayRisks.length === 0 && (
                <p className="text-[11.5px] text-slate-400 italic">Failed to load AI analysis</p>
              )}
            </div>
          )}
        </div>

        <div className="px-3 pt-2 pb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1.5">Required Actions</p>
          {loading && displayActions.length === 0 ? (
            <div className="space-y-1">
              {[1, 2, 3].map((i) => <div key={i} className="h-9 bg-[#F0F6FF] rounded-md animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-1">
              {displayActions.map((a, i) => (
                <div key={i} className="bg-[#F0F6FF] border border-[#D3DEEE] rounded-md px-2.5 py-1.5">
                  <p className="text-[10px] font-bold text-[#215AA8] uppercase tracking-[0.06em] mb-0.5">
                    {a.num} · {a.title}
                  </p>
                  <p className="text-[11.5px] text-[#2A3D4A] leading-[1.35]">{a.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
