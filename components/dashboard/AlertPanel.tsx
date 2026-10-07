"use client";

import { useState } from "react";
import { AlertTriangle, AlertCircle, Info, X, ChevronDown, ChevronUp, Send, Check, Loader2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KPIAlert } from "@/lib/alerts";
import type { RiskPoResult } from "@/lib/riskScore";

interface AlertPanelProps {
  alerts: KPIAlert[];
  onDismiss: (id: string) => void;
  plant?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  riskScores?: RiskPoResult[];
  riskLoading?: boolean;
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    rowBg: "bg-[#FFEDEF] border-l-4 border-l-[#E6001C]",
    icon_color: "text-[#E6001C]",
    badge: "bg-[#FFEDEF] text-[#8A0011]",
    label: "Critical",
  },
  warning: {
    icon: AlertTriangle,
    rowBg: "bg-[#FFFBE4] border-l-4 border-l-[#D1A400]",
    icon_color: "text-[#D1A400]",
    badge: "bg-[#FFFBE4] text-[#342900]",
    label: "Warning",
  },
  info: {
    icon: Info,
    rowBg: "bg-[#CCDDF5] border-l-4 border-l-[#0056CC]",
    icon_color: "text-[#0056CC]",
    badge: "bg-[#CCDDF5] text-[#00347A]",
    label: "Info",
  },
};

type SendState = "idle" | "sending" | "sent" | "error";

export function AlertPanel({ alerts, onDismiss, plant, period, startDate, endDate, riskScores = [], riskLoading = false }: AlertPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [riskExpanded, setRiskExpanded] = useState(false);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendError, setSendError] = useState<string | null>(null);

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount  = alerts.filter((a) => a.severity === "warning").length;

  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-[#EBEBEB] bg-white px-4 py-2.5 flex items-center gap-2 shrink-0">
        <AlertTriangle size={13} className="text-gray-300 shrink-0" />
        <span className="text-xs font-semibold text-gray-400">KPI Alerts</span>
        <span className="ml-auto text-[11px] text-emerald-600 font-semibold">✓ All KPIs within normal range</span>
      </div>
    );
  }

  async function handleSendToTeams() {
    setSendState("sending");
    setSendError(null);
    try {
      let recipients: Array<{ email: string; kpis: Record<string, boolean> }> | undefined;
      try {
        const raw = localStorage.getItem("ct-teams-settings");
        if (raw) {
          const cfg = JSON.parse(raw) as { enabled?: boolean; recipients?: typeof recipients };
          if (cfg.enabled && cfg.recipients?.length) recipients = cfg.recipients;
        }
      } catch { /* ignore */ }

      const res = await fetch("/api/notifications/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alerts,
          plant,
          period,
          startDate,
          endDate,
          ...(recipients ? { recipients } : {}),
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setSendState("error");
        setSendError(data.error ?? "Failed to send to Teams");
        setTimeout(() => setSendState("idle"), 4000);
      } else {
        setSendState("sent");
        setTimeout(() => setSendState("idle"), 3000);
      }
    } catch {
      setSendState("error");
      setSendError("Network error");
      setTimeout(() => setSendState("idle"), 4000);
    }
  }

  return (
    <div className="rounded-lg border border-[#EBEBEB] bg-white overflow-hidden shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 flex-1 text-left hover:opacity-80 transition-opacity"
        >
          <AlertTriangle size={14} className="text-amber-500" />
          <span className="text-xs font-semibold text-gray-700">KPI Alerts</span>
          <div className="flex gap-1.5">
            {criticalCount > 0 && (
              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">
                {criticalCount} Critical
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">
                {warningCount} Warning
              </span>
            )}
          </div>
          {collapsed ? <ChevronDown size={14} className="text-gray-400 ml-auto" /> : <ChevronUp size={14} className="text-gray-400 ml-auto" />}
        </button>

        {/* Send to Teams button */}
        <button
          onClick={handleSendToTeams}
          disabled={sendState === "sending" || sendState === "sent"}
          title={
            sendState === "sent"   ? "Sent to Teams" :
            sendState === "error"  ? (sendError ?? "Failed") :
            sendState === "sending"? "Mengirim..." :
            "Send alert to Microsoft Teams"
          }
          className={cn(
            "ml-3 flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all",
            sendState === "idle"    && "bg-[#1E4076] hover:bg-[#16305C] text-white",
            sendState === "sending" && "bg-gray-200 text-gray-400 cursor-wait",
            sendState === "sent"    && "bg-emerald-100 text-emerald-700 cursor-default",
            sendState === "error"   && "bg-red-100 text-red-600 cursor-pointer",
          )}
        >
          {sendState === "sending" && <Loader2 size={11} className="animate-spin" />}
          {sendState === "sent"    && <Check size={11} />}
          {sendState === "idle"    && <Send size={11} />}
          {sendState === "error"   && <Send size={11} />}
          <span>
            {sendState === "idle"    && "Teams"}
            {sendState === "sending" && "Sending..."}
            {sendState === "sent"    && "Terkirim"}
            {sendState === "error"   && "Failed"}
          </span>
        </button>
      </div>

      {/* Error message */}
      {sendState === "error" && sendError && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-[11px] text-red-600">
          {sendError}
        </div>
      )}

      {/* Alert list */}
      {!collapsed && (
        <div className="divide-y divide-gray-50">
          {alerts.map((alert) => {
            const config = SEVERITY_CONFIG[alert.severity];
            const Icon = config.icon;
            return (
              <div key={alert.id} className={cn("flex items-start gap-3 px-4 py-3", config.rowBg)}>
                <Icon size={14} className={cn("mt-0.5 shrink-0", config.icon_color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold", config.badge)}>
                      {config.label}
                    </span>
                    <span className="text-xs font-semibold text-gray-700">{alert.kpi}</span>
                  </div>
                  <p className="text-xs text-gray-600">{alert.message}</p>
                  {alert.trend != null && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Threshold: {alert.threshold} · Trend MoM: {alert.trend > 0 ? "+" : ""}{alert.trend.toFixed(1)}%
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onDismiss(alert.id)}
                  className="text-gray-300 hover:text-gray-500 transition-colors shrink-0 mt-0.5"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* At-Risk POs section */}
      {!collapsed && (riskLoading || riskScores.filter((s) => s.score >= 0.5).length > 0) && (() => {
        const flagged = riskScores.filter((s) => s.score >= 0.5);
        const visible = riskExpanded ? flagged : flagged.slice(0, 3);
        const hidden = flagged.length - 3;
        return (
          <>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-t border-gray-100">
              <TrendingUp size={13} className="text-amber-500" />
              <span className="text-[11px] font-semibold text-gray-600">At-Risk POs</span>
              {!riskLoading && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold ml-auto">
                  {flagged.length} flagged
                </span>
              )}
            </div>
            {riskLoading ? (
              <div className="px-4 py-3 space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-7 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                <div className="grid grid-cols-[1fr_52px_60px_1fr] gap-2 px-4 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  <span>PO · Plant</span><span className="text-right">Risk</span><span className="text-right">Days</span><span>Last stage</span>
                </div>
                {visible.map((r) => {
                  const pct = Math.round(r.score * 100);
                  const badgeCls = pct >= 70 ? "bg-[#FFEDEF] text-[#8A0011]" : "bg-[#FFFBE4] text-[#342900]";
                  return (
                    <div key={r.po} className="grid grid-cols-[1fr_52px_60px_1fr] gap-2 px-4 py-2 items-center">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-gray-700 truncate">{r.po}</div>
                        <div className="text-[10px] text-gray-400">{r.plant} · {r.product}</div>
                      </div>
                      <div className="text-right">
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded tabular-nums", badgeCls)}>{pct}%</span>
                      </div>
                      <div className={cn("text-right text-[11px] font-semibold tabular-nums", r.daysSinceRelease > 13 ? "text-[#E6001C]" : "text-gray-600")}>
                        {r.daysSinceRelease}d
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">
                        {r.lastSeq > 1 ? `#${r.lastSeq} ${r.lastActivity}` : "Released"} → #{r.nextSeq}
                      </div>
                    </div>
                  );
                })}
                {flagged.length > 3 && (
                  <button
                    onClick={() => setRiskExpanded((v) => !v)}
                    className="w-full px-4 py-2 text-[11px] text-blue-700 hover:text-blue-800 font-semibold hover:bg-blue-50 transition-colors text-left"
                  >
                    {riskExpanded ? "Show less" : `Show ${hidden} more POs`}
                  </button>
                )}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}