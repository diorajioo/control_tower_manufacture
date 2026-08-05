"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { format, parseISO } from "date-fns";
import {
  PLANT_COLORS,
  KPI_OPTIONS,
  computeControlLimits,
  computePerPlantLimits,
} from "@/lib/chartConfig";

// Tipe props untuk filter yang diterima dari parent
interface Filters {
  plant: string;
  startDate: string;
  endDate: string;
}

interface TrendChartProps {
  filters: Filters;
  kpiType: string;
  onKpiChange: (kpi: string) => void;
}

export function TrendChart({ filters, kpiType, onKpiChange }: TrendChartProps) {
  const [data,    setData]      = useState<Record<string, unknown>[]>([]);
  const [plants,  setPlants]    = useState<string[]>([]);
  const [loading, setLoading]   = useState(false);

  const selectedKpi = KPI_OPTIONS.find((o) => o.value === kpiType)!;

  // Ambil data trend dari API tiap filter atau jenis KPI berubah
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      plant:     filters.plant,
      startDate: filters.startDate,
      endDate:   filters.endDate,
      kpiType,
    });
    fetch(`/api/dashboard/trends?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d.trendSeries ?? []);
        setPlants(d.plants ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters.plant, filters.startDate, filters.endDate, kpiType]);

  // Hitung batas kontrol global untuk garis referensi di chart
  const { mean, stdev, ucl, lcl } = useMemo(
    () => computeControlLimits(data, plants),
    [data, plants]
  );

  const perPlantLimits = useMemo(
    () => computePerPlantLimits(data, plants),
    [data, plants]
  );

  // Parse string tanggal ke objek Date, coba format ISO dulu lalu fallback ke native
  const parseAnyDate = (s: string): Date => {
    // try ISO "YYYY-MM-DD" first, then fall back to native Date constructor
    const iso = parseISO(s);
    if (!isNaN(iso.getTime())) return iso;
    return new Date(s);
  };

  // Format label tanggal di sumbu X menjadi "d MMM"
  const formatTick = (s: string) => {
    try {
      const d = parseAnyDate(s);
      return isNaN(d.getTime()) ? s : format(d, "d MMM");
    } catch { return s; }
  };

  return (
    <div className="bg-white rounded-xl pt-3 px-3 pb-0 shadow-sm border border-gray-200">
      {/* Judul chart, badge KPI aktif, dan spinner loading */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-bold text-gray-800">Metric Trend</h3>
          {loading && (
            <span className="w-3 h-3 border border-brand-400 border-t-transparent rounded-full animate-spin inline-block" />
          )}
        </div>
        <span className="text-xs bg-brand-50 text-brand-600 px-2.5 py-0.5 rounded-full font-medium border border-brand-100">
          {selectedKpi.label} ({selectedKpi.unit})
        </span>
      </div>

      {/* Tombol pilih KPI dan legend plant dalam satu baris */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex flex-wrap gap-1">
          {KPI_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onKpiChange(opt.value)}
              className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                kpiType === opt.value
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Legend plant di atas chart — muncul setelah data dimuat */}
        {plants.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0">
            {plants.map((plant, i) => (
              <div key={plant} className="flex items-center gap-1">
                <span
                  className="w-5 h-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: PLANT_COLORS[i % PLANT_COLORS.length] }}
                />
                <span className="text-[10px] font-medium text-gray-500">{plant}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Render chart garis tren per plant dengan batas kontrol UCL/LCL */}
      <ResponsiveContainer width="100%" height={210}>
        <ComposedChart data={data as Record<string, string | number>[]} margin={{ top: 0, right: 14, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tickFormatter={formatTick}
            tick={{ fontSize: 12, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            height={20}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => Number(v).toFixed(1)}
            domain={["auto", (dataMax: number) => Math.ceil(dataMax * 1.05)]}
          />
          {/* Tooltip kustom yang tampilkan nilai dan batas kontrol tiap plant */}
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const dateLabel = (() => {
                try {
                  const d = parseAnyDate(String(label));
                  return isNaN(d.getTime()) ? String(label) : format(d, "dd MMM yyyy");
                } catch { return String(label); }
              })();
              return (
                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 11, minWidth: 190 }}>
                  <p style={{ fontWeight: 600, marginBottom: 6, color: "#374151" }}>{dateLabel}</p>
                  {payload.map((entry) => {
                    const pname = String(entry.name);
                    const lim = perPlantLimits[pname];
                    return (
                      <div key={pname} style={{ marginBottom: 6 }}>
                        <p style={{ color: String(entry.color), margin: 0, fontWeight: 600 }}>
                          {pname}: {Number(entry.value).toFixed(2)} {selectedKpi.unit}
                        </p>
                        {lim && (
                          <p style={{ color: "#9ca3af", margin: "1px 0 0 0", fontSize: 10 }}>
                            Mean {lim.mean.toFixed(2)} · σ {lim.stdev.toFixed(2)} · UCL <span style={{ color: "#ef4444" }}>{lim.ucl.toFixed(2)}</span> · LCL <span style={{ color: "#ef4444" }}>{lim.lcl.toFixed(2)}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />

          {/* Area biru muda sebagai zona kontrol antara LCL dan UCL */}
          {ucl > 0 && (
            <ReferenceArea
              y1={lcl}
              y2={ucl}
              fill="#eff6ff"
              fillOpacity={0.45}
              ifOverflow="visible"
            />
          )}

          {/* ── UCL = Mean + 3σ ── */}
          <ReferenceLine
            y={ucl}
            stroke="#ef4444"
            strokeDasharray="5 3"
            strokeWidth={1.5}
            label={{
              value: `UCL ${ucl.toFixed(1)}`,
              position: "insideTopRight",
              fontSize: 9,
              fill: "#ef4444",
            }}
          />
          {/* ── Mean (WINDOW_AVG) ── */}
          <ReferenceLine
            y={mean}
            stroke="#6b7280"
            strokeDasharray="4 2"
            strokeWidth={1.5}
            label={{
              value: `Mean ${mean.toFixed(1)}`,
              position: "insideTopRight",
              fontSize: 9,
              fill: "#6b7280",
            }}
          />
          {/* ── LCL = Mean − 3σ ── */}
          {lcl > 0 && (
            <ReferenceLine
              y={lcl}
              stroke="#ef4444"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{
                value: `LCL ${lcl.toFixed(1)}`,
                position: "insideBottomRight",
                fontSize: 9,
                fill: "#ef4444",
              }}
            />
          )}

          {/* Gambar garis tren per plant — label nilai hanya di titik terakhir, digeser vertikal supaya tidak tumpang tindih */}
          {plants.map((plant, i) => {
            const color = PLANT_COLORS[i % PLANT_COLORS.length];
            const lastIndex = data.length - 1;
            // Offset vertikal bergantian atas-bawah: plant 0 → atas, plant 1 → bawah, dst.
            const yOffset = i % 2 === 0 ? -10 : 10;
            return (
              <Line
                key={plant}
                type="monotone"
                dataKey={plant}
                stroke={color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: color, stroke: "#fff", strokeWidth: 2 }}
                name={plant}
                connectNulls
                label={({ x, y, value, index }: { x?: number; y?: number; value?: unknown; index?: number }) => {
                  if (index !== lastIndex || typeof value !== "number") return <g key={`lbl-${plant}-${index}`} />;
                  const cx = x ?? 0;
                  const cy = y ?? 0;
                  return (
                    <g key={`lbl-${plant}-${index}`}>
                      <circle cx={cx} cy={cy} r={3} fill={color} stroke="#fff" strokeWidth={1.5} />
                      <rect
                        x={cx - 18}
                        y={cy + yOffset - 8}
                        width={36}
                        height={13}
                        rx={4}
                        fill={color}
                        opacity={0.12}
                      />
                      <text
                        x={cx}
                        y={cy + yOffset}
                        fill={color}
                        fontSize={9}
                        fontWeight={700}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {value.toFixed(1)}
                      </text>
                    </g>
                  );
                }}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>

    </div>
  );
}
