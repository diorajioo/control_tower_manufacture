"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, AlertCircle, Info, X, ChevronDown, ChevronUp, Send, Check, Loader2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KPIAlert } from "@/lib/alerts";
import type { RiskPoResult } from "@/lib/riskScore";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { activityLabel } from "@/lib/leadTimeStages";

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
  const [collapsed, setCollapsed] = useState(true);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendError, setSendError] = useState<string | null>(null);
  const [atRiskOpen, setAtRiskOpen] = useState(false);
  const [lateOpen, setLateOpen] = useState(false);

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount  = alerts.filter((a) => a.severity === "warning").length;
  const atRiskCount   = riskScores.filter((s) => s.score >= 0.5).length;

  if (alerts.length === 0 && !riskLoading && atRiskCount === 0) {
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
            {alerts.length === 0 ? (
              <span className="text-[11px] text-emerald-600 font-semibold">✓ All KPIs within normal range</span>
            ) : (
              <>
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
              </>
            )}
            {!riskLoading && atRiskCount > 0 && (
              <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-semibold">
                {atRiskCount} At-Risk PO
              </span>
            )}
          </div>
          {collapsed ? <ChevronDown size={14} className="text-gray-400 ml-auto" /> : <ChevronUp size={14} className="text-gray-400 ml-auto" />}
        </button>

        {/* Send to Teams button — only shown when there are KPI alerts */}
        {alerts.length > 0 && <button
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
        </button>}
      </div>

      {/* Error message */}
      {sendState === "error" && sendError && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-[11px] text-red-600">
          {sendError}
        </div>
      )}

      {/* Alert list */}
      {!collapsed && alerts.length > 0 && (
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
        const flagged   = riskScores.filter((s) => s.score >= 0.5);
        const confirmed = flagged.filter((r) => r.daysSinceRelease > 13);
        const atRisk    = flagged.filter((r) => r.daysSinceRelease <= 13);

        const colCls = "grid grid-cols-[minmax(0,1fr)_48px_52px_minmax(0,1fr)] gap-x-3";

        const ColHeaders = () => (
          <div className={cn(colCls, "px-4 py-1 text-[9.5px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100")}>
            <span>PO · Plant</span><span className="text-right">Risk</span><span className="text-right">Days</span><span>Last → Next stage</span>
          </div>
        );

        const PoRow = ({ r }: { r: RiskPoResult }) => {
          const pct = Math.round(r.score * 100);
          const isLate = r.daysSinceRelease > 13;
          const badgeCls = pct >= 70 ? "bg-[#FFEDEF] text-[#8A0011]" : "bg-[#FFFBE4] text-[#342900]";
          return (
            <div className={cn(colCls, "px-4 py-1.5 items-center hover:bg-gray-50 transition-colors")}>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-gray-700 truncate">{r.po}</div>
                <div className="text-[10px] text-gray-400 truncate">{r.plant} · {r.product}</div>
              </div>
              <div className="text-right">
                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded tabular-nums", badgeCls)}>{pct}%</span>
              </div>
              <div className={cn("text-right text-[11px] font-semibold tabular-nums", isLate ? "text-[#E6001C]" : "text-gray-600")}>
                {r.daysSinceRelease}d
              </div>
              <div className="text-[10px] text-gray-500 truncate">
                {r.lastActivity && r.lastActivity !== "PO" ? activityLabel(r.lastActivity) : "PO Released"}
                {" → "}
                {r.nextActivity ? activityLabel(r.nextActivity) : "—"}
              </div>
            </div>
          );
        };

        const SubSection = ({
          open, onToggle, icon, label, count, badgeCls, rows,
        }: {
          open: boolean; onToggle: () => void;
          icon: ReactNode; label: string; count: number; badgeCls: string;
          rows: RiskPoResult[];
        }) => (
          <div className="border-t border-gray-100">
            <button
              onClick={onToggle}
              className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              {icon}
              <span className="text-[10.5px] font-semibold text-gray-600">{label}</span>
              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", badgeCls)}>{count} POs</span>
              <span className="ml-auto text-gray-400">
                {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </span>
            </button>
            {open && (
              <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
                <ColHeaders />
                {rows.map((r) => <PoRow key={r.po} r={r} />)}
              </div>
            )}
          </div>
        );

        return (
          <>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-t border-gray-100">
              <TrendingUp size={13} className="text-amber-500" />
              <span className="text-[11px] font-semibold text-gray-600">At-Risk POs</span>
              <InfoTooltip
                size={11}
                width={272}
                rows={[
                  { label: "Risk %",      text: "Predicted probability this PO exceeds the 13-day target. ≥ 50% = flagged." },
                  { label: "Days",        text: "Calendar days since PO Released." },
                  { label: "Last · Next", text: "Most-recent completed activity → next expected activity for this PO." },
                ]}
                footer="Logistic-regression model scored on: route-steps remaining, idle wait time, product late-rate history, and queue depth at the next step."
              />
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
              <>
                {atRisk.length > 0 && (
                  <SubSection
                    open={atRiskOpen}
                    onToggle={() => setAtRiskOpen((v) => !v)}
                    icon={<TrendingUp size={11} className="text-amber-500" />}
                    label="Predicted at risk"
                    count={atRisk.length}
                    badgeCls="bg-amber-100 text-amber-700"
                    rows={atRisk}
                  />
                )}
                {confirmed.length > 0 && (
                  <SubSection
                    open={lateOpen}
                    onToggle={() => setLateOpen((v) => !v)}
                    icon={<AlertTriangle size={11} className="text-red-500" />}
                    label="Already late — still in production"
                    count={confirmed.length}
                    badgeCls="bg-red-100 text-red-700"
                    rows={confirmed}
                  />
                )}
              </>
            )}
          </>
        );
      })()}
    </div>
  );
}