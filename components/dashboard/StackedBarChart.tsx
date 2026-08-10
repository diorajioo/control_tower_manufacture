"use client";

import { useState, useEffect, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Cell,
} from "recharts";
import {
  PLANT_COLORS,
  KPI_OPTIONS,
  computeControlLimits,
  computePerPlantLimits,
} from "@/lib/chartConfig";

// Tipe props untuk filter tanggal dan plant dari parent
interface Filters {
  plant: string;
  startDate: string;
  endDate: string;
}

interface StackedBarChartProps {
  filters: Filters;
  kpiType: string;
  onKpiChange: (kpi: string) => void;
}

const KPI_TAB_LABELS: Record<string, string> = {
  leadtime:   "chart_tab_leadtime",
  upstream:   "chart_tab_upstream",
  downstream: "chart_tab_downstream",
  e2e:        "chart_tab_e2e",
  output:     "chart_tab_output",
};

export function StackedBarChart({ filters, kpiType, onKpiChange }: StackedBarChartProps) {
  const [rawData,  setRawData]  = useState<Record<string, unknown>[]>([]);
  const [plants,   setPlants]   = useState<string[]>([]);
  const [loading,  setLoading]  = useState(false);
  const { t } = useI18n();

  const selectedKpi = KPI_OPTIONS.find((o) => o.value === kpiType)!;

  // Ambil data dari endpoint yang sama dengan TrendChart tiap filter berubah
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
        setRawData(d.trendSeries ?? []);
        setPlants(d.plants ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters.plant, filters.startDate, filters.endDate, kpiType]);

  // Hitung batas kontrol global untuk garis referensi di bar chart
  const { mean, stdev, ucl, lcl } = useMemo(
    () => computeControlLimits(rawData, plants),
    [rawData, plants]
  );

  const perPlantLimits = useMemo(
    () => computePerPlantLimits(rawData, plants),
    [rawData, plants]
  );

  const plantData = useMemo(
    () =>
      plants.map((plant, i) => {
        const vals = rawData
          .map((pt) => pt[plant])
          .filter((v): v is number => typeof v === "number" && !isNaN(v));
        const lim = perPlantLimits[plant] ?? { mean: 0, stdev: 0, ucl: 0, lcl: 0 };
        return {
          plant,
          value:      lim.mean,
          color:      PLANT_COLORS[i % PLANT_COLORS.length],
          weeks:      vals.length,
          plantMean:  lim.mean,
          plantStdev: lim.stdev,
          plantUcl:   lim.ucl,
          plantLcl:   lim.lcl,
        };
      }),
    [rawData, plants, perPlantLimits]
  );

  // Tentukan status kontrol tiap plant berdasarkan posisi nilai terhadap UCL/LCL global
  const getStatus = (val: number) => {
    if (ucl === 0) return { label: "—", cls: "text-gray-400" };
    if (val > ucl)  return { label: `Above ${t("chart_ucl")}`, cls: "text-red-500"   };
    if (lcl > 0 && val < lcl) return { label: `Below ${t("chart_lcl")}`, cls: "text-amber-500" };
    return                   { label: t("chart_in_control"), cls: "text-green-600" };
  };

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
      {/* Judul card dan badge KPI yang sedang dipilih */}
      <div className="flex items-start justify-between mb-1.5">
        <div>
          <h3 className="text-sm font-bold text-slate-700">{t("chart_kpi_by_plant")}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {t("chart_subtitle_plant")}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && (
            <span className="w-3 h-3 border border-brand-400 border-t-transparent rounded-full animate-spin inline-block" />
          )}
          <span className="text-xs bg-brand-50 text-brand-600 px-2.5 py-0.5 rounded-full font-medium border border-brand-100">
            {selectedKpi.label}
          </span>
        </div>
      </div>

      {/* Tombol pilih KPI, opsinya sama dengan TrendChart */}
      <div className="flex flex-wrap gap-1 mb-1.5">
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
            {KPI_TAB_LABELS[opt.value] ? t(KPI_TAB_LABELS[opt.value] as Parameters<typeof t>[0]) : opt.label}
          </button>
        ))}
      </div>

      {/* Bar chart rata-rata KPI per plant dengan overlay batas kontrol */}
      <ResponsiveContainer width="100%" height={140}>
        <BarChart
          data={plantData}
          margin={{ top: 10, right: 14, left: -12, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="plant"
            tick={{ fontSize: 12, fill: "#374151" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => Number(v).toFixed(1)}
          />
          {/* Tooltip kustom yang tampilkan detail statistik tiap plant */}
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as typeof plantData[number];
              return (
                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 11, minWidth: 160 }}>
                  <p style={{ fontWeight: 600, marginBottom: 4, color: "#374151" }}>{p.plant}</p>
                  <p style={{ color: p.color, margin: "2px 0" }}>
                    Avg: <strong>{p.value.toFixed(2)} {selectedKpi.unit}</strong> · {p.weeks}w
                  </p>
                  <hr style={{ margin: "6px 0", borderColor: "#f3f4f6" }} />
                  <p style={{ color: "#6b7280", margin: "2px 0" }}>Mean: <strong>{p.plantMean.toFixed(2)}</strong></p>
                  <p style={{ color: "#9ca3af", margin: "2px 0" }}>σ: <strong>{p.plantStdev.toFixed(2)}</strong></p>
                  <p style={{ color: "#ef4444", margin: "2px 0" }}>UCL: <strong>{p.plantUcl.toFixed(2)}</strong></p>
                  <p style={{ color: "#ef4444", margin: "2px 0" }}>LCL: <strong>{p.plantLcl.toFixed(2)}</strong></p>
                </div>
              );
            }}
          />

          {/* Area biru muda penanda zona kontrol antara LCL dan UCL, sama seperti TrendChart */}
          {ucl > 0 && (
            <ReferenceArea y1={lcl} y2={ucl} fill="#eff6ff" fillOpacity={0.45} />
          )}

          {/* Garis UCL batas atas kontrol */}
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
          {/* Garis rata-rata global */}
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
          {/* Garis LCL batas bawah kontrol, hanya tampil kalau nilainya di atas nol */}
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

          {/* Bar tiap plant diberi warna sesuai urutan plant */}
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={52}>
            {plantData.map((entry) => (
              <Cell
                key={entry.plant}
                fill={entry.color}
                fillOpacity={0.82}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Daftar status kontrol tiap plant di bawah chart */}
      <div className="mt-1.5 pt-1.5 border-t border-gray-100 space-y-1">
        {plantData.map((p) => {
          const { label, cls } = getStatus(p.value);
          return (
            <div key={p.plant} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="text-slate-700 font-semibold">{p.plant}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-400 tabular-nums text-xs">
                  {p.weeks}w
                </span>
                <span className="font-bold text-slate-700 tabular-nums">
                  {p.value.toFixed(2)}&thinsp;<span className="font-normal text-gray-500">{selectedKpi.unit}</span>
                </span>
                <span className={`font-semibold w-20 text-right text-xs ${cls}`}>{label}</span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
