// Single source of truth untuk semua konfigurasi chart
// Semua komponen harus import dari sini — jangan define ulang di masing-masing file

// Urutan warna per plant konsisten di seluruh dashboard (TrendChart, StackedBarChart, Header, dll)
export const PLANT_COLORS = [
  "#3b82f6", // biru
  "#f59e0b", // amber
  "#ef4444", // merah
  "#10b981", // hijau
  "#8b5cf6", // ungu
  "#f97316", // oranye
] as const;

// Daftar KPI untuk selector di chart — label dan unit harus sama di semua chart
export const KPI_OPTIONS = [
  { value: "leadtime",    label: "Lead Time",       unit: "days"   },
  { value: "upstream",    label: "Upstream Prod.",   unit: "kg/mh"  },
  { value: "downstream",  label: "Downstream Prod.", unit: "pcs/mh" },
  { value: "e2e",         label: "E2E Prod.",        unit: "pcs/mh" },
  { value: "output",      label: "Accepted Output",  unit: "pcs"    },
  { value: "batch",       label: "Besar Batch",      unit: "kg"     },
] as const;

export type KpiValue = (typeof KPI_OPTIONS)[number]["value"];

export interface ControlLimits {
  mean:  number;
  stdev: number;
  ucl:   number;
  lcl:   number;
}

// Global control limits — dihitung dari semua titik data lintas plant
// Rumus: mean ± 3σ (sample stdev, n-1), LCL minimal 0
export function computeControlLimits(
  data: Record<string, unknown>[],
  plants: string[]
): ControlLimits {
  const values: number[] = [];
  for (const pt of data) {
    for (const p of plants) {
      const v = pt[p];
      if (typeof v === "number" && !isNaN(v)) values.push(v);
    }
  }
  if (values.length < 2) return { mean: 0, stdev: 0, ucl: 0, lcl: 0 };

  const mean  = values.reduce((s, v) => s + v, 0) / values.length;
  const stdev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1));

  return {
    mean:  Number(mean.toFixed(2)),
    stdev: Number(stdev.toFixed(2)),
    ucl:   Number((mean + 3 * stdev).toFixed(2)),
    lcl:   Number(Math.max(0, mean - 3 * stdev).toFixed(2)),
  };
}

// Per-plant control limits — dipakai di tooltip untuk detail per plant
export function computePerPlantLimits(
  data: Record<string, unknown>[],
  plants: string[]
): Record<string, ControlLimits> {
  const map: Record<string, ControlLimits> = {};
  for (const plant of plants) {
    const vals = data
      .map((pt) => pt[plant])
      .filter((v): v is number => typeof v === "number" && !isNaN(v));

    if (vals.length < 2) {
      map[plant] = { mean: 0, stdev: 0, ucl: 0, lcl: 0 };
      continue;
    }

    const m  = vals.reduce((s, v) => s + v, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1));

    map[plant] = {
      mean:  Number(m.toFixed(2)),
      stdev: Number(sd.toFixed(2)),
      ucl:   Number((m + 3 * sd).toFixed(2)),
      lcl:   Number(Math.max(0, m - 3 * sd).toFixed(2)),
    };
  }
  return map;
}
