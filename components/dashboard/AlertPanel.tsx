"use client";

import { useState } from "react";
import { AlertTriangle, AlertCircle, Info, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KPIAlert } from "@/lib/alerts";

interface AlertPanelProps {
  alerts: KPIAlert[];
  onDismiss: (id: string) => void;
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

export function AlertPanel({ alerts, onDismiss }: AlertPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (alerts.length === 0) return null;

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500" />
          <span className="text-xs font-semibold text-gray-700">
            KPI Alerts
          </span>
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
        </div>
        {collapsed ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronUp size={14} className="text-gray-400" />}
      </button>

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
