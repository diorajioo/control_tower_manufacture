export type DataLevel = "Daily" | "Weekly" | "Monthly" | "Year-to-Date";
export type Plant = "All Plant" | string;

export interface DashboardFilters {
  plant: Plant;
  period: string;
  startDate: string;
  endDate: string;
  dataLevel: DataLevel;
}

export interface KPIData {
  leadTime: {
    value: number;
    unit: string;
    trend: number;
    breakdown: { label: string; value: number }[];
  };
  yield: {
    bulkLoss: number;
    packLoss: number;
    trend: number;
    bulkLossKg: number;
    packLossKg: number;
  };
  rightFirstTime: {
    value: number;
    trend: number;
  };
  output: {
    acceptedBulkKg: number;
    releasedFgPcs: number;
    bulkTrend: number;
    fgTrend: number;
  };
  oee: {
    value: number;
    trend: number;
    status: "Improvement Recommended" | "On Track" | "Good";
  };
  ope: {
    value: number;
    trend: number;
    status: "Improvement Recommended" | "On Track" | "Good";
  };
  productivity: {
    pcsPerManhour: number;
    manhour: number;
    operators: number;
    trend: number;
    byPlant: { plant: string; value: number }[];
  };
}

export interface TrendDataPoint {
  date: string;
  liquid: number;
  semisolid: number;
  powder: number;
  total: number;
  benchmark: number;
}

export interface StackedBarDataPoint {
  plant: string;
  value: number;
  benchmark: number;
  color: string;
}

export interface PlantOption {
  value: string;
  label: string;
}
