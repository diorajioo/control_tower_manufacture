"use client";

import { useState } from "react";
import { AlertTriangle, AlertCircle, Info, X, ChevronDown, ChevronUp, Send, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KPIAlert } from "@/lib/alerts";

interface AlertPanelProps {
  alerts: KPIAlert[];
  onDismiss: (id: string) => void;
  plant?: string;
  period?: string;
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    bg: "bg-red-50 border-red-200",
    icon_color: "text-red-500",
    badge: "bg-red-100 text-red-700",
    label: "Critical",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50 border-amber-200",
    icon_color: "text-amber-500",
    badge: "bg-amber-100 text-amber-700",
    label: "Warning",
  },
  info: {
    icon: Info,
    bg: "bg-blue-50 border-blue-200",
    icon_color: "text-blue-500",
    badge: "bg-blue-100 text-blue-700",
    label: "Info",
  },
};

type SendState = "idle" | "sending" | "sent" | "error";

export function AlertPanel({ alerts, onDismiss, plant, period }: AlertPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendError, setSendError] = useState<string | null>(null);

  if (alerts.length === 0) return null;

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount  = alerts.filter((a) => a.severity === "warning").length;

  async function handleSendToTeams() {
    setSendState("sending");
    setSendError(null);
    try {
      const res = await fetch("/api/notifications/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alerts,
          plant,
          period,
          withRecommendation: criticalCount > 0,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setSendState("error");
        setSendError(data.error ?? "Gagal mengirim ke Teams");
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
    <div className="mb-4 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
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
            sendState === "sent"   ? "Terkirim ke Teams" :
            sendState === "error"  ? (sendError ?? "Gagal") :
            sendState === "sending"? "Mengirim..." :
            "Kirim alert ke Microsoft Teams"
          }
          className={cn(
            "ml-3 flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all",
            sendState === "idle"    && "bg-[#464eb8] hover:bg-[#3b42a0] text-white",
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
            {sendState === "error"   && "Gagal"}
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
              <div key={alert.id} className={cn("flex items-start gap-3 px-4 py-3", config.bg)}>
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
    </div>
  );
}