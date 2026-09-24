# Control Tower Manufacturing — Context Prompt

Project: Next.js 14 manufacturing KPI dashboard for PT Paracorp Group. Stack: Snowflake · Azure AD (NextAuth.js) · Groq AI · Nivo charts · Tailwind CSS · Lato font only.

---

## KPI Card Design System — source of truth: `components/dashboard/OutputKPICard.tsx`

TONES object (standar seluruh sistem):
```ts
const TONES = {
  on:      { color: "#067647", bg: "#f0fdf6", border: "#bbf0d2", icon: "↑", label: "Up"       },
  risk:    { color: "#b45309", bg: "#fffaeb", border: "#f0d58a", icon: "!", label: "Declining" },
  off:     { color: "#d92d20", bg: "#fef4f3", border: "#fbd5d1", icon: "↓", label: "Down"     },
  neutral: { color: "#667085", bg: "#f8f9fb", border: "#e4e7ec", icon: "—", label: "No Data"  },
};
```

Rules:
- **Trend chip** di value row: plain colored text, NO background, NO border, arrows diagonal `↗`/`↘`/`→` only — never `↑↓`
- **Status pill**: SATU-SATUNYA elemen yang boleh punya `bg` + `border` dari TONES
- **Main number**: selalu `color: "#101828"`, tidak pernah diwarnai berdasarkan status
- Jika prior period tidak ada → chip tampil `—` neutral, bukan `+0.0%`

---

## Komponen yang ada

- `components/dashboard/OutputKPICard.tsx` — card utama Output & RFT (referensi desain)
- `components/dashboard/LeadTimeKPICard.tsx` — card lead time, Gross/Nett toggle, Days/Hours toggle, sparkline di kanan
- `components/dashboard/LiteKPICard.tsx` — compact card untuk OEE, E2E Productivity, Yield Loss, Energy. Props: `label, value, unit, target, attainment, trend?, series?, status?, noData?, icon?`
- `components/dashboard/TrendChart.tsx`, `AIRisksPanel.tsx`, `StrategicMonitor.tsx`

---

## Status data per KPI

| KPI | Tabel Snowflake | Status |
|---|---|---|
| Lead Time | `CT_MANUF_LEADTIME` | Real data |
| Output (FG/Bulk) | `DATAMART_PRODUCTION_OUTPUT_FG/OLAH` | Real data |
| RFT | `CT_MANUF_LEADTIME` | Real data |
| E2E Productivity | `CT_MANUF_E2E` | Real data, prior period YTD bisa kosong |
| OEE | `CT_MANUF_KEMAS` | `noData` (belum connect) |
| Yield Loss | `CT_MANUF_KEMAS` | `noData` (belum connect) |
| Energy | — | `noData` (belum ada tabel) |
| Lead Time page (3 cards) | static mock | 100% dummy data |

---

## File penting

- `app/dashboard/page.tsx` — halaman utama Strategic dashboard
- `app/lead-time/page.tsx` — halaman Lead Time (mock data)
- `app/api/dashboard/kpi/route.ts` — API route, pakai `Promise.allSettled` + `delta()` helper (return `null` kalau prev = 0)
- `lib/queries.ts` — semua Snowflake queries, pakai `periodDateWhere()` untuk date filter
- `lib/alerts.ts` — threshold alerts
- `docs/` — dokumentasi canonical (baca ini dulu sebelum edit apapun)

---

## Anti-pattern yang sudah dikonfirmasi — jangan diulangi

- Jangan kasih background/border pada trend chip
- Jangan pakai `↑↓` — selalu `↗↘`
- Jangan warnai main number berdasarkan status
- Jangan ganti Nivo ke library lain
- Jangan ganti font ke Inter/Space Grotesk
- Bulk Output/Bulk Loss tidak punya PLANT column — jangan tambah plant filter di query itu
