"use client";

import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center">
      <Info size={12} className="text-gray-300 group-hover:text-gray-500 cursor-help transition-colors" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 hidden group-hover:block text-xs text-white bg-gray-900 px-2.5 py-2 rounded-lg shadow-xl z-50 leading-relaxed font-normal normal-case tracking-normal">
        {text}
      </span>
    </span>
  );
}

// Tipe props untuk komponen KPICard yang bisa menerima nilai, tren, badge, dan konten kustom
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
}

// Peta warna badge sesuai status yang diberikan dari parent
const badgeColors = {
  green: "bg-green-50 text-green-600",
  red: "bg-red-50 text-red-500",
  amber: "bg-amber-50 text-amber-600",
  blue: "bg-brand-50 text-brand-600",
  purple: "bg-purple-50 text-purple-600",
};

// Badge tren kecil yang tampilkan ikon naik/turun dan persentase perubahan
function TrendBadge({ trend }: { trend: number }) {
  const up = trend > 0;
  const cls = up ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500";
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full", cls)}>
      <Icon size={11} />
      {up ? "+" : ""}{Math.abs(trend).toFixed(1)}%
    </span>
  );
}

// Komponen kartu KPI utama dengan header, nilai besar, subtitle, dan slot konten tambahan
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
}: KPICardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl p-3 shadow-sm border flex flex-col gap-2 transition-all",
        alert ? "border-red-300 ring-1 ring-red-100" : "border-gray-200",
        className
      )}
    >
      {/* Header card berisi ikon, judul, badge tren, dan badge status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${iconColor}18` }}
            >
              <span style={{ color: iconColor }}>{icon}</span>
            </div>
          )}
          <span className="text-sm font-bold text-slate-700 leading-tight">{title}</span>
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
        <div className="flex items-center gap-1">
          {trend !== undefined && <TrendBadge trend={trend} />}
          {badge && (
            <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", badgeColors[badgeColor])}>
              {badge}
            </span>
          )}
        </div>
      </div>

      {/* Nilai utama KPI dalam ukuran besar dengan satuan di sampingnya */}
      {value !== undefined && value !== "" && (
        <div className="flex items-baseline gap-1">
          <span className={cn("font-bold text-slate-800 font-display tracking-tight", compact ? "text-2xl" : "text-3xl")}>{value}</span>
          {unit && <span className="text-sm text-gray-500 font-semibold">{unit}</span>}
        </div>
      )}

      {/* Teks keterangan tambahan di bawah nilai utama */}
      {subtitle && <p className="text-xs text-gray-500 -mt-1">{subtitle}</p>}
      {trendLabel && <p className="text-xs text-gray-400 -mt-1">{trendLabel}</p>}

      {children}
    </div>
  );
}

// ── Circular gauge (SVG) ──────────────────────────────────────────────────────

// Tipe props untuk gauge lingkaran SVG
interface CircularGaugeProps {
  value: number;
  max?: number;
  color?: string;
  size?: number;
  ariaLabel?: string;
}

// Gambar gauge berbentuk lingkaran SVG yang menunjukkan persentase terhadap nilai maksimum
export function CircularGauge({ value, max = 100, color = "#22c55e", size = 72, ariaLabel }: CircularGaugeProps) {
  // Hitung offset stroke berdasarkan persentase untuk animasi lingkaran
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
        {/* Lingkaran latar belakang */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f0fdf4"
          strokeWidth={10}
        />
        {/* Lingkaran progress yang berubah sesuai nilai */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      {/* Label nilai di tengah gauge */}
      <div className="absolute text-center">
        <span className="text-sm font-bold text-slate-800 leading-none font-display">{value.toFixed(1)}</span>
        <span className="text-xs text-gray-400 block leading-none">%</span>
      </div>
    </div>
  );
}

// ── Sparkline (inline SVG polyline) ──────────────────────────────────────────

// Tipe props untuk sparkline mini yang menerima array angka
interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

// Render sparkline SVG kecil dari array data, normalisasi nilai ke koordinat SVG
export function Sparkline({ data, color = "#6366f1", width = 80, height = 32 }: SparklineProps) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  // Konversi tiap nilai ke koordinat x,y dalam viewBox SVG
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
      />
    </svg>
  );
}

// ── Mini stat (used inside cards) ─────────────────────────────────────────────

// Tipe props untuk komponen statistik mini yang dipakai di dalam kartu
interface MiniStatProps {
  label: string;
  value: string | number;
  unit?: string;
  positive?: boolean;
  negative?: boolean;
  trend?: number;
}

// Tampilkan nilai kecil dengan label, satuan opsional, dan indikator tren naik/turun
export function MiniStat({ label, value, unit, positive, negative, trend }: MiniStatProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1">
        <span
          className={cn(
            "text-sm font-bold",
            positive ? "text-green-600" : negative ? "text-red-500" : "text-gray-800"
          )}
        >
          {value}
          {unit && <span className="text-xs font-normal ml-0.5 text-gray-400">{unit}</span>}
        </span>
        {/* Panah tren kecil naik/turun dengan persentase perubahan */}
        {trend !== undefined && (
          <span className={cn("text-xs font-semibold", trend > 0 ? "text-green-500" : "text-red-500")}>
            {trend > 0 ? "↑" : "↓"}{Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}
