"use client";

// Standard segmented toggle — same style as the Overview KPI card toggles
// (Gross / Nett, Finished Goods / Bulk): gray pill track, active option = white chip with a soft shadow.
// Use this for every new toggle; spec in docs/UI_UX.md → Segmented Toggle.
export function SegmentedToggle<T extends string>({ options, value, onChange, ariaLabel }: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{ background: "#f2f3f6", borderRadius: 7, padding: 3, display: "flex", gap: 2 }}
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: 5,
              border: "none",
              cursor: "pointer",
              background: active ? "white" : "transparent",
              color: active ? "#101828" : "#667085",
              boxShadow: active ? "0 1px 2px rgba(16,24,40,.08)" : "none",
              fontFamily: "Lato, sans-serif",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
