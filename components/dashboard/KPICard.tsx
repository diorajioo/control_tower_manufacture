"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown, Info } from "lucide-react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";

// ── AnimatedNumber ────────────────────────────────────────────────────────────
// Count-up from previous → target using Framer Motion.

function parseNumeric(v: string | number): { raw: number; decimals: number; prefix: string; suffix: string } {
  const s = String(v);
  const match = s.match(/^([^\d-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/);
  if (!match) return { raw: NaN, decimals: 0, prefix: "", suffix: s };
  const numStr = match[2].replace(/,/g, "");
  const dotIdx = numStr.indexOf(".");
  return {
    raw: parseFloat(numStr),
    decimals: dotIdx === -1 ? 0 : numStr.length - dotIdx - 1,
    prefix: match[1],
    suffix: match[3],
  };
}

function fmt(n: number, decimals: number): string {
  if (decimals === 0) return Math.round(n).toLocaleString("en-US");
  return n.toFixed(decimals);
}

interface AnimatedNumberProps {
  value: string | number;
  className?: string;
}

function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const { raw, decimals, prefix, suffix } = parseNumeric(value);
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(() =>
    isNaN(raw) ? String(value) : `${prefix}${fmt(0, decimals)}${suffix}`
  );
  const prevRef = useRef(0);

  useEffect(() => {
    if (isNaN(raw)) {
      setDisplay(String(value));
      prevRef.current = 0;
      return;
    }
    const from = prevRef.current;
    prevRef.current = raw;
    const ctrl = animate(mv, raw, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      from,
      onUpdate: (v) => setDisplay(`${prefix}${fmt(v, decimals)}${suffix}`),
    });
    return () => ctrl.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  return <span className={className}>{display}</span>;
}

// ── InfoTooltip ───────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <Info size={11} className={cn("cursor-help transition-colors", open ? "text-gray-400" : "text-gray-200")} />
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, scale: 0.88, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 6 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 text-xs text-slate-100 bg-[#1e293b] px-3 py-2 rounded-xl shadow-2xl z-50 leading-relaxed font-normal normal-case tracking-normal"
            style={{ transformOrigin: "50% 100%" }}
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

// ── KPICard types ─────────────────────────────────────────────────────────────

interface KPICardProps {
  title: string;
  icon?: React.ReactNode;
  iconColor?: string;
  value?: string | number;
  unit?: string;
  trend?: number;
  trendLabel?: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  badge?: string;
  badgeColor?: "green" | "red" | "amber" | "blue" | "purple";
  alert?: boolean;
  compact?: boolean;
  tooltip?: string;
  sparkline?: number[];
  sparklineColor?: string;
}

const badgeColors = {
  green:  "bg-emerald-50 text-emerald-600",
  red:    "bg-red-50 text-red-500",
  amber:  "bg-amber-50 text-amber-600",
  blue:   "bg-indigo-50 text-indigo-600",
  purple: "bg-violet-50 text-violet-600",
};

// ── TrendBadge ────────────────────────────────────────────────────────────────

export function TrendBadge({ trend }: { trend: number }) {
  const up = trend > 0;
  const cls = up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500";
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full", cls)}>
      <Icon size={10} />
      {up ? "+" : ""}{Math.abs(trend).toFixed(1)}%
    </span>
  );
}

// ── KPICard ───────────────────────────────────────────────────────────────────

export function KPICard({
  title,
  icon,
  iconColor = "#4f46e5",
  value,
  unit,
  trend,
  trendLabel,
  subtitle,
  children,
  className,
  badge,
  badgeColor = "blue",
  alert,
  compact,
  tooltip,
  sparkline,
  sparklineColor,
}: KPICardProps) {
  const hasValue = value !== undefined && value !== "";
  const isNumeric = hasValue && !isNaN(parseNumeric(value!).raw);

  return (
    <div
      className={cn(
        "bg-white rounded-2xl p-4 flex flex-col gap-3 transition-all",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]",
        alert
          ? "border border-red-200 ring-1 ring-red-100/50"
          : "border border-gray-100/80",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${iconColor}14` }}
            >
              <span style={{ color: iconColor }}>{icon}</span>
            </div>
          )}
          <span className="text-[13px] font-bold text-slate-700 leading-tight tracking-tight">{title}</span>
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
        <div className="flex items-center gap-1.5">
          {trend !== undefined && <TrendBadge trend={trend} />}
          {badge && (
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-tight", badgeColors[badgeColor])}>
              {badge}
            </span>
          )}
        </div>
      </div>

      {/* Primary value */}
      {hasValue && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            {isNumeric ? (
              <AnimatedNumber
                value={value!}
                className={cn(
                  "font-bold text-slate-900 tracking-tighter tabular-nums",
                  compact ? "text-2xl" : "text-3xl"
                )}
              />
            ) : (
              <span className={cn("font-bold text-slate-900 tracking-tighter", compact ? "text-2xl" : "text-3xl")}>
                {value}
              </span>
            )}
            {unit && <span className="text-sm text-gray-400 font-medium">{unit}</span>}
          </div>
          {sparkline && sparkline.length >= 2 && (
            <Sparkline data={sparkline} color={sparklineColor ?? iconColor} width={88} height={36} />
          )}
        </div>
      )}

      {subtitle && <p className="text-[11px] text-gray-400 -mt-1.5 tracking-tight">{subtitle}</p>}
      {trendLabel && <p className="text-[11px] text-gray-400 -mt-1.5">{trendLabel}</p>}

      {children}
    </div>
  );
}

// ── CircularGauge ─────────────────────────────────────────────────────────────

interface CircularGaugeProps {
  value: number;
  max?: number;
  color?: string;
  size?: number;
  ariaLabel?: string;
}

export function CircularGauge({ value, max = 100, color = "#22c55e", size = 72, ariaLabel }: CircularGaugeProps) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(value / max, 0), 1);
  const offset = circumference * (1 - pct);

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel ?? `${value.toFixed(1)}% dari ${max}%`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={9} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <span className="text-sm font-bold text-slate-800 tabular-nums leading-none">{value.toFixed(1)}</span>
        <span className="text-[10px] text-gray-400 block leading-none mt-0.5">%</span>
      </div>
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function Sparkline({ data, color = "#6366f1", width = 80, height = 32 }: SparklineProps) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.8}
      />
    </svg>
  );
}

// ── MiniStat ──────────────────────────────────────────────────────────────────

interface MiniStatProps {
  label: string;
  value: string | number;
  unit?: string;
  positive?: boolean;
  negative?: boolean;
  trend?: number;
}

export function MiniStat({ label, value, unit, positive, negative, trend }: MiniStatProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <span
          className={cn(
            "text-sm font-bold tabular-nums",
            positive ? "text-emerald-600" : negative ? "text-red-500" : "text-slate-800"
          )}
        >
          {value}
          {unit && <span className="text-[11px] font-normal ml-0.5 text-gray-400">{unit}</span>}
        </span>
        {trend !== undefined && (
          <span className={cn("text-[11px] font-semibold", trend > 0 ? "text-emerald-500" : "text-red-500")}>
            {trend > 0 ? "↑" : "↓"}{Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <span className="text-[11px] text-gray-400 leading-none">{label}</span>
    </div>
  );
}
