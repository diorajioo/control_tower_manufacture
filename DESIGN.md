---
name: Control Tower Manufacturing Dashboard
description: Dasbor operasional manufaktur real-time untuk manajer pabrik PT Paracorp Group
design-system: Paradise Design System v2 (ParagonCorp CX Team)
colors:
  # Brand / Shell — Paragon Blue ramp
  brand-50: "#E9EFF6"
  brand-100: "#D3DEEE"   # surface-primary-subtle — active nav bg
  brand-200: "#A6BDDC"   # border accent, hover bg
  brand-300: "#7A9CCB"
  brand-400: "#4D7BB9"
  brand-500: "#215AA8"   # action-primary — topbar, accent, CTA
  brand-600: "#1A4886"   # action-primary-hover
  brand-700: "#143665"   # text-accent-strong — active nav text
  brand-800: "#0D2443"
  brand-900: "#071222"
  # Semantic aliases (Paradise)
  surface-primary-subtle: "#D3DEEE"  # active nav bg, selected pill bg
  text-accent-strong: "#143665"       # active nav text, selected pill text
  action-primary: "#215AA8"
  action-primary-hover: "#1A4886"
  border-subtle: "#EBEBEB"            # all card & panel borders
  text-primary: "#2A3D4A"             # body text on light bg (e.g. AI Summary)
  # Status / Data
  accent-warning: "#D1A400"           # warning icon, border-l (dark — WCAG safe on #FFFBE4)
  surface-warning-subtle: "#FFFBE4"
  text-on-warning-subtle: "#342900"
  accent-error: "#E6001C"
  surface-error-subtle: "#FFEDEF"
  text-on-error-subtle: "#8A0011"
  accent-info: "#0056CC"
  surface-info-subtle: "#CCDDF5"
  text-on-info-subtle: "#00347A"
  # AI Label gradient (only permitted product gradient)
  gradient-ai: "linear-gradient(90deg, #725DA3, #864A9C)"
  # Unchanged
  background: "#F1F5F9"   # page bg — unchanged
  surface: "#FFFFFF"
  status-good: "#22c55e"
  plant-1: "#3b82f6"
  plant-2: "#f59e0b"
  plant-3: "#ef4444"
  plant-4: "#10b981"
  plant-5: "#8b5cf6"
  plant-6: "#f97316"
typography:
  fontFamily: "Lato, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
  baseSize: "14px"
  smoothing: "-webkit-font-smoothing: antialiased"
  weights: "400 (regular), 700 (bold) — Lato has no 500/600"
rounded:
  card: "rounded-lg (8px)"    # Paradise rounded.large
  control: "rounded (4px)"
  pill: "rounded-full"
  badge: "rounded (4px)"
spacing:
  card-padding: "px-[18px] py-4 (18px horizontal, 16px vertical)"
  grid-gap: "14px (gap-[14px])"
  section-gap: "mb-5"
  content-padding: "p-5 (20px)"
elevation:
  card-rest: "border border-[#EBEBEB], no shadow"
  card-hover: "hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)]"
  floating: "shadow-2xl"
components:
  card:
    shape: "rounded-lg"
    border: "border border-[#EBEBEB]"
    shadow: "none at rest; hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)]"
    accent-bar: "w-[5px] left edge, color = accentColor (derived from status)"
    padding: "px-[18px] py-4"
  label:
    size: "10.5px"
    weight: "font-bold (700)"
    color: "text-slate-400"
    style: "uppercase tracking-[0.08em]"
  value:
    size: "text-[2rem] (32px)"
    weight: "font-bold (700)"
    color: "text-slate-900"
    tracking: "tracking-tight"
    number-format: "tabular-nums"
  unit:
    size: "13px"
    color: "text-slate-400"
    weight: "font-medium"
  note:
    size: "12px"
    color: "text-slate-500"
    lineHeight: "leading-snug"
  badge:
    size: "10.5px"
    shape: "rounded (4px, NOT pill)"
    weight: "font-bold"
  hero-card:
    value-size: "text-[3.25rem] (52px)"
    accent-bar: "w-[5px] left edge"
    sub-metric-size: "text-2xl (24px)"
---

# Design System: Control Tower Manufacturing Dashboard

> **Implements Paradise Design System v2** — ParagonCorp CX Team internal design system.
> Single source of truth: `paradise.md`. Rules in this file reflect Paradise constraints applied to this product.

## Overview

**Creative North Star: "The Operations War Room"**

Control Tower is built for the moment of decision. Every morning, a plant manager opens this dashboard and needs to know — in under five seconds — whether the factory is running clean or on fire. The design language serves that moment: dense but not cluttered, high-signal but not alarm-heavy.

Color is signal, not decoration. Paragon Blue (#215AA8) is the system shell — header, sidebar accents, brand identity. Green, amber, and red belong entirely to the data. No color used merely to look good. No element without a job.

## Colors

### Brand / Shell — Paragon Blue ramp
- **action-primary** (#215AA8 / brand-500): Topbar background, primary CTAs, accent icons, flash overlay. System color only — never used to signal KPI health.
- **action-primary-hover** (#1A4886 / brand-600): Hover state for all action-primary elements.
- **text-accent-strong** (#143665 / brand-700): Active nav text, selected filter pill text.
- **surface-primary-subtle** (#D3DEEE / brand-100): Active nav background, selected pill background, selected dropdown item.
- **border accent** (#A6BDDC / brand-200): Active dropdown border, hover background in dropdowns.

### Background & Surface
- **Page Background** (#F1F5F9 / `bg-slate-100`): Main content area — unchanged.
- **Card Surface** (#FFFFFF): All KPI cards, chart panels, modals, AI Summary strip.
- **border-subtle** (#EBEBEB): All card and panel borders. Replaces previous `border-slate-200` everywhere.

### Status / Data (Paradise-aligned)
| State | Background | Icon/Border | Text |
|---|---|---|---|
| Warning | `#FFFBE4` (surface-warning-subtle) | `#D1A400` (accent-warning) | `#342900` (text-on-warning-subtle) |
| Error/Critical | `#FFEDEF` (surface-error-subtle) | `#E6001C` (accent-error) | `#8A0011` (text-on-error-subtle) |
| Info | `#CCDDF5` (surface-info-subtle) | `#0056CC` (accent-info) | `#00347A` (text-on-info-subtle) |
| Good | `bg-emerald-50` | `#22c55e` | `text-emerald-600` |

**Warning color change:** Old amber `#f59e0b` is replaced by `#D1A400` (accent-warning). White text on `#FFCD00`/`#D1A400` fails WCAG (1.6:1 contrast ratio) — always pair with dark text `#342900`.

### AI Label Gradient (sanctioned)
`linear-gradient(90deg, #725DA3, #864A9C)` — only for the AILabel chip. No other product gradients allowed per Paradise rules.

### Named Rules
**The Two-Domain Rule.** Paragon Blue (#215AA8) is the system. Green/amber/red belongs to the data. Never mix.  
**No product gradients.** Only the AILabel chip uses the sanctioned `gradient-ai`. The AI Summary strip is now a white card — no navy gradient.  
**The Plant Color Permanence Rule.** Plant color positions are fixed across every chart type.

## Typography

**Single font: Lato** (loaded from Google Fonts, weights 400 and 700 only)  
Fallback stack: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`  
Base: `14px`, `-webkit-font-smoothing: antialiased`

Lato has no weight 500 or 600 — use 400 for regular, 700 for bold/semibold.

### Hierarchy
| Role | Size | Weight | Color | Style |
|---|---|---|---|---|
| Card label | 10.5px | 700 | `text-slate-400` | UPPERCASE, `tracking-[0.08em]` |
| Primary KPI value | 32px (2rem) | 700 | `text-slate-900` | `tracking-tight`, `tabular-nums` |
| Hero value (OEE card) | 52px (3.25rem) | 700 | status color | `tracking-tight`, `tabular-nums` |
| Sub-metric | 24px | 700 | status color | `tracking-tight` |
| Unit / suffix | 13px | 400 | `text-slate-400` | — |
| Note / subtitle | 12px | 400 | `text-slate-500` | `leading-snug` |
| Chart panel title | 13px | 700 | `text-slate-800` | `tracking-tight` |
| Section eyebrow | 10px | 700 | accent color | UPPERCASE, `tracking-widest` |
| Badge / pill | 10.5px | 700 | semantic pair | — |
| Body text on white (AI Summary) | 13px | 400 | `#2A3D4A` (text-primary) | `leading-relaxed` |

### Named Rules
**Lato only.** No Inter, no Space Grotesk, no Plus Jakarta Sans, no DM Sans. Single family for everything.  
**Numbers are always tabular.** Use `tabular-nums` on all numeric displays.

## Layout

Shell: fixed sidebar (224px) + fluid main column.  
Header: fixed 52px Paragon Blue bar (`bg-[#215AA8]`).  
Content area: `p-5` (20px) all sides, `overflow-y-auto`.

### KPI Grid
- **Operation KPIs**: `grid-cols-2 lg:grid-cols-4 gap-[14px]` — Lead Time, Yield, RFT, Output
- **Equipment & People (Strategic)**: `grid-cols-1 lg:grid-cols-2 gap-[14px]` — OPE, Productivity (OEE is in Hero card)
- **Equipment & People (Tactical)**: `grid-cols-1 lg:grid-cols-3 gap-[14px]` — OEE, OPE, Productivity
- **Charts**: `grid-cols-1 lg:grid-cols-2 gap-[14px]`

Section spacing: `mb-5` between grid and next divider.

## Elevation & Depth

Flat at rest. Shadow only on hover or overlay.
- **Cards at rest**: `border border-[#EBEBEB]`, no shadow
- **Cards on hover**: `hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200`
- **Floating elements** (chat window, dropdowns): `shadow-2xl`

### Named Rules
**The Flat-at-Rest Rule.** If every card has a shadow, none of them do. Shadows are a state, not a style.

## Shapes

**All cards and panels: `rounded-lg` (8px).** Replaces previous `rounded-xl` (12px) per Paradise `rounded.large`.  
**Controls (buttons, pills): `rounded-full` or `rounded` (4px for badges).**  
**No sharp 0px corners anywhere.**

## Components

### KPI Card (`components/dashboard/KPICard.tsx`)
```
┌─[5px accent bar]─────────────────────────────┐
│ px-[18px] py-4                               │
│ LABEL  (10.5px uppercase bold slate-400)      │
│ 32.00 days  (32px bold slate-900 + unit 13px)│
│ Subtitle text  (12px slate-500)               │
│ [children: bars, toggles, gauges]             │
└──────────────────────────────────────────────┘
```
- Shape: `rounded-lg` (8px)
- Border: `border-[#EBEBEB]`; alert state: `border-[#FFEDEF]`
- Accent bar color = `accentColor`: derived from `badgeColor` prop (red/green/amber) or falls back to `iconColor`
- Default `iconColor`: `#215AA8` (was `#4f46e5`)
- Amber accent: `#D1A400` (was `#f59e0b`)
- `alert` prop forces red accent and `border-[#FFEDEF]`
- Badge colors: amber → `bg-[#FFFBE4] text-[#342900]`; blue → `bg-[#D3DEEE] text-[#143665]`; red → `bg-[#FFEDEF] text-[#8A0011]`
- Animated value count-up on data refresh (Framer Motion)
- Flash overlay on refresh: `#215AA8` (was indigo `#6366f1`) `opacity-0.22 → 0`, 0.9s ease
- Tooltip bg: `#2A3D4A` (was `#1e293b`)

### Hero OEE Card (inline in `app/dashboard/page.tsx`, Strategic view only)
Large featured card — OEE is the primary diagnostic metric.
- 52px main value, red or green based on ≥65% threshold
- Derived Availability = OEE / (Performance × Quality) × 100
- 24px sub-metrics: Availability, Performance, Quality
- Left accent bar: 5px, red if below target, green if on target

### Chart Panels (`components/dashboard/TrendChart.tsx`, `StackedBarChart.tsx`)
Same shell as KPI cards: `bg-white rounded-lg p-3 border border-[#EBEBEB] hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)]`

**Chart title** — matches KPI card label style (NOT the old 13px slate-800):
```
text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em] leading-none
```
Both TrendChart and StackedBarChart use this exact class. No exceptions.

**KPI selector badge** (top-right pill): `bg-[#D3DEEE] text-[#143665] px-2.5 py-0.5 rounded-full font-semibold text-[10px]`  
**Active KPI tab pill**: `bg-[#215AA8] text-white`; inactive: `bg-gray-100 text-gray-500`  
**Loading spinner**: `border border-[#215AA8] border-t-transparent`  
**Tooltip bg**: `#2A3D4A`  
**Nivo margin** (both charts): `{ top: 4, right: 16, bottom: 24, left: 36 }` — tight, no excess whitespace  
**Nivo theme**: `fontFamily: "inherit"` — auto-inherits Lato; axis tick text `#9ca3af 10px`  
**Crosshair color**: `#215AA8`  
**SPC control zone fill**: `#E9EFF6` (brand-50) opacity 0.55

**TrendChart-specific**:
- `chartHeight = 195` (default)
- X-axis ticks: even ISO week numbers only (W2, W4, W6…) — never show all weeks. Filter: `getISOWeek(date) % 2 === 0`; thin further (step 2) if > 26 even-week data points
- Plant legend: inline top-right, 4px line + plant name, 10px text-gray-400

**StackedBarChart-specific**:
- `chartHeight = 180` (default)
- Plant status legend: compact 2-column grid below chart. One row per plant: dot + name + weeks + avg value + status label. No separate detail rows.
- Legend font: 10px. Status colors: emerald-600 (In control), red-500 (Above UCL), amber-500 (Below LCL)

### AISummary (`components/dashboard/AISummary.tsx`)
- **White card** — `bg-white rounded-lg border border-[#EBEBEB] shadow-[0px_4px_4px_-2px_rgba(42,61,74,0.08)]`
- **AILabel chip**: `linear-gradient(90deg,#725DA3,#864A9C)` pill — "✦ AI Summary" in white text (10px bold)
- Summary text: `13px text-[#2A3D4A] leading-relaxed`
- Clickable KPI numbers: `text-[#215AA8]` with `decoration-[#A6BDDC]` underline — trigger `kpi-highlight` CustomEvent
- Refresh button: `text-[#215AA8] hover:bg-[#D3DEEE]`
- Error: `text-[#E6001C]`; truncated warning: `text-[#D1A400]`; age label: `text-[#7A7A7A]`
- 5-hour cache; auto-fetch on first load; refresh button force-refetches from `/api/dashboard/summary`

### AlertPanel (`components/dashboard/AlertPanel.tsx`)
- Container: `rounded-lg border border-[#EBEBEB] bg-white`
- **Alert rows use 4px left border style** (Paradise pattern) — no full-border colored cards
- Critical row: `bg-[#FFEDEF] border-l-4 border-l-[#E6001C]`
- Warning row: `bg-[#FFFBE4] border-l-4 border-l-[#D1A400]`
- Info row: `bg-[#CCDDF5] border-l-4 border-l-[#0056CC]`
- Teams button idle: `bg-[#215AA8] hover:bg-[#1A4886] text-white`

### Sidebar (`components/dashboard/Sidebar.tsx`)
- White, `w-56`, `border-r border-slate-200`
- Active nav: `bg-[#D3DEEE] text-[#143665]` + right pip `bg-[#215AA8]`
- Inactivity auto-logout: 15 minutes via `setTimeout` + window event listeners

### Header (`components/dashboard/Header.tsx`)
- Topbar: `bg-[#215AA8] border-b border-[#1A4886]`, fixed 52px
- Bell badge border: `border-[#215AA8]`
- Active filter pills (period/data-level/view): `bg-[#D3DEEE]` pill bg, `text-[#143665]` text
- Plant dropdown active: `border-[#A6BDDC] bg-[#D3DEEE] text-[#143665]`
- Plant item active: `bg-[#D3DEEE]/60 text-[#143665]`, check icon `text-[#215AA8]`
- Teams send button idle: `bg-[#D3DEEE] text-[#143665] border-[#A6BDDC] hover:bg-[#A6BDDC]`
- Avatar: solid `bg-[#215AA8]` circle
- Row 2: Strategic/Tactical view toggle + period/date/plant/data-level filters
- Filters persist to `localStorage` key `ct-filters`

## Views

### Strategic (default)
For plant managers & executives — big-picture health check.
1. AI Summary strip (white card + AILabel gradient chip)
2. Alert Panel (if active alerts)
3. Hero OEE card (full-width, 52px number)
4. Operation KPIs — 4-col grid (Lead Time, Yield, RFT, Output)
5. Equipment & People — 2-col grid (OPE, Productivity)
6. Trend & Benchmark — 2-col charts

### Tactical
For production supervisors — operational detail.
Same structure but:
- No Hero OEE card
- Equipment & People — 3-col grid (OEE, OPE, Productivity)

## Cross-Page Visual Standards

These rules apply to **every page** in the app (dashboard, lead-time, settings, future pages). The Strategic dashboard (`app/dashboard/page.tsx`) is the canonical reference.

### Page Shell
- Background: `bg-slate-100` (`#F1F5F9`) — never `bg-slate-50` or `bg-white`
- Header: 52px `bg-[#215AA8]` — text only, no logos or SVG marks in the nav bar
- Sidebar: white, `w-56`, logo at top, `border-r border-slate-200`

### Cards & Panels (all pages)
| Property | Value |
|---|---|
| Shape | `rounded-lg` (8px) — never `rounded-xl` or `rounded-2xl` |
| Border | `border border-[#EBEBEB]` |
| Shadow at rest | none |
| Shadow on hover | `hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)] transition-shadow duration-200` |
| Padding (KPI card) | `px-[18px] py-4` |
| Padding (chart panel) | `p-4` |

### Chart Panel Titles
```
text-[13px] font-bold text-slate-800 tracking-tight
```

### Chart Panel Subtitles
```
text-[11px] text-slate-500 mt-0.5
```

### KPI Value Typography
| Context | Size | Color |
|---|---|---|
| Standard KPI card | `text-[2rem]` (32px) bold | `text-slate-900` or status color |
| Hero card (OEE) | `text-[3.25rem]` (52px) bold | red/green by threshold |
| Sub-metric | `text-[1.5rem]` (24px) bold | status color |

### Section Page Headers (sub-pages like Lead Time)
- Title: `text-[20px] font-bold text-slate-900 leading-tight`
- Subtitle: `text-[12px] text-slate-500`
- Breadcrumb: `text-[11px] text-slate-400 font-medium`

### Colors: Strict Domains
- **Paragon Blue #215AA8** = shell only (header bg, sidebar active item, primary CTAs)
- **Green/amber/red** = KPI health signals only — use Paradise semantic colors
- **PLANT_COLORS array** = positional, never shuffled across chart types
- **Status in lead-time**: UNVA=#b91c1c, NNVA=#d97706, VA=#215AA8 (fixed — updated from #1e4076)

### No Inline Font Overrides
Remove all `style={{ fontFamily: ... }}` — the body already sets Lato globally.

## Do's and Don'ts

### Do:
- Use Lato for every text element. `font-sans` and `font-display` both map to Lato.
- Use `border-[#EBEBEB]` for every card and panel border.
- Use `rounded-lg` for every card, panel, and chart wrapper.
- Use `gap-[14px]` for all KPI grids.
- Assign accent bar color from KPI status — red/amber/green/iconColor.
- Use Paradise semantic colors for status states (see table above).
- Pair warning colors with dark text: `#D1A400` bg → `#342900` text (white fails WCAG).
- Keep plant color assignments positional and immutable.
- Test Strategic and Tactical views after any layout change.

### Don't:
- Don't use `rounded-xl` or `rounded-2xl` on cards — only `rounded-lg`.
- Don't use `border-slate-200` or `border-gray-100` — use `border-[#EBEBEB]`.
- Don't use indigo (`#6366f1`, `indigo-*`) anywhere — replaced by Paragon Blue.
- Don't use Inter, Space Grotesk, Plus Jakarta Sans, or DM Sans.
- Don't use product gradients except the AILabel chip (`gradient-ai`).
- Don't use white text on warning colors (`#FFCD00`, `#D1A400`) — contrast fails WCAG.
- Don't use navy (#1E4076) — replaced by #215AA8 everywhere.
- Don't hardcode dummy numbers in any card — all values must come from live KPI API.
- Don't use navy to signal KPI health — it's the system shell color.
- Don't reorder or rename the 6 core KPIs (Lead Time, Yield, RFT, Output, OEE, Productivity).
- Don't add `animate-bounce` — use `transition-all ease-out` instead.
