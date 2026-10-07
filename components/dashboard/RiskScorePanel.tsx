"use client";

import { AlertTriangle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiskPoResult } from "@/lib/riskScore";

interface RiskScorePanelProps {
  scores: RiskPoResult[];
  modelMissing?: boolean;
  loading?: boolean;
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const cls =
    pct >= 70 ? "bg-[#FFEDEF] text-[#8A0011]" :
    pct >= 50 ? "bg-[#FFFBE4] text-[#342900]" :
                "bg-[#CCDDF5] text-[#00347A]";
  return (
    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded tabular-nums", cls)}>
      {pct}%
    </span>
  );
}

export function RiskScorePanel({ scores, modelMissing, loading }: RiskScorePanelProps) {
  if (modelMissing) return null;

  const high = scores.filter((s) => s.score >= 0.5);

  if (!loading && high.length === 0) return null;

  return (
    <div className="rounded-lg border border-[#EBEBEB] bg-white overflow-hidden shrink-0">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <TrendingUp size={14} className="text-amber-500" />
        <span className="text-xs font-semibold text-gray-700">At-Risk POs</span>
        {!loading && (
          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">
            {high.length} PO{high.length !== 1 ? "s" : ""} flagged
          </span>
        )}
      </div>

      {loading ? (
        <div className="px-4 py-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_56px_72px_80px_80px] gap-2 px-4 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
            <span>PO · Product</span>
            <span className="text-right">Risk</span>
            <span className="text-right">Days</span>
            <span>Last stage</span>
            <span>Next stage</span>
          </div>
          {high.map((r) => (
            <div
              key={r.po}
              className="grid grid-cols-[1fr_56px_72px_80px_80px] gap-2 px-4 py-2.5 items-center hover:bg-gray-50 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-gray-700 truncate">{r.po}</div>
                <div className="text-[10px] text-gray-400 truncate">{r.plant} · {r.product}</div>
              </div>
              <div className="text-right">
                <ScoreBadge score={r.score} />
              </div>
              <div className="text-right">
                <span className={cn(
                  "text-xs font-semibold tabular-nums",
                  r.daysSinceRelease > 13 ? "text-[#E6001C]" : "text-gray-600"
                )}>
                  {r.daysSinceRelease}d
                </span>
              </div>
              <div className="text-[10px] text-gray-500 truncate" title={r.lastActivity}>
                {r.lastSeq > 1 ? `#${r.lastSeq} ${r.lastActivity}` : "Released"}
              </div>
              <div className="text-[10px] text-gray-500 truncate">
                #{r.nextSeq}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
