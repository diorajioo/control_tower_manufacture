"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterPanelProps {
  plants: string[];
  onFilterChange: (filters: {
    plant: string;
    startDate: string;
    endDate: string;
    dataLevel: string;
  }) => void;
}

const DATA_LEVELS = ["Daily", "Weekly", "Monthly"];

const PERIOD_PRESETS = [
  { label: "Year-to-Date", getValue: () => ({ start: `${new Date().getFullYear()}-01-01`, end: today() }) },
  { label: "Last 30 Days", getValue: () => ({ start: daysAgo(30), end: today() }) },
  { label: "Last 90 Days", getValue: () => ({ start: daysAgo(90), end: today() }) },
  { label: "Last 6 Months", getValue: () => ({ start: daysAgo(180), end: today() }) },
];

function today() {
  return new Date().toISOString().split("T")[0];
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export function FilterPanel({ plants, onFilterChange }: FilterPanelProps) {
  const [plant, setPlant] = useState("All Plant");
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(today());
  const [dataLevel, setDataLevel] = useState("Daily");
  const [period, setPeriod] = useState("Year-to-Date");

  const handleApply = () => onFilterChange({ plant, startDate, endDate, dataLevel });

  const handlePeriodChange = (label: string) => {
    const preset = PERIOD_PRESETS.find((p) => p.label === label);
    if (preset) {
      const { start, end } = preset.getValue();
      setStartDate(start);
      setEndDate(end);
      setPeriod(label);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <FilterGroup label="Plant">
        <Select value={plant} onChange={setPlant} options={plants} />
      </FilterGroup>

      <FilterGroup label="Period">
        <Select value={period} onChange={handlePeriodChange} options={PERIOD_PRESETS.map((p) => p.label)} />
      </FilterGroup>

      <FilterGroup label="Start Date">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full text-xs text-gray-800 border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </FilterGroup>

      <FilterGroup label="End Date">
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-full text-xs text-gray-800 border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </FilterGroup>

      <FilterGroup label="Data Level">
        <Select value={dataLevel} onChange={setDataLevel} options={DATA_LEVELS} />
      </FilterGroup>

      <button
        onClick={handleApply}
        className="mt-2 w-full bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold py-2 rounded-md transition-colors"
      >
        Apply Filter
      </button>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-300">{label}</label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none text-xs text-gray-800 border border-gray-200 rounded-md px-2 py-1.5 pr-6 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

export { cn };
