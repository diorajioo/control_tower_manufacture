# UI/UX — Control Tower Manufacturing

**Canonical design reference: `DESIGN.md`** — this file summarizes key decisions and patterns for quick reference. For full token specs and component contracts, read `DESIGN.md`.

---

## Design System

**Paradise Design System v2** — ParagonCorp CX Team internal design system.

Creative direction: "The Operations War Room." Dense but not cluttered. High-signal but not alarm-heavy. Color is signal, not decoration.

### Font

**Lato exclusively.** Loaded from Google Fonts (weights 400 and 700 only). Fallback: `ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`.

- Base size: `14px`
- Smoothing: `-webkit-font-smoothing: antialiased`
- **Lato has no weight 500 or 600.** Use 400 (regular) or 700 (bold) only.
- Set globally in `globals.css`. Never add `style={{ fontFamily: ... }}` inline.


### Colors

Two strict color domains — never mix:

**Domain 1: Shell (Paragon Blue ramp)**
| Token | Hex | Usage |
|---|---|---|
| `action-primary` | `#215AA8` | Header bg, sidebar active item, primary CTAs, flash overlay |
| `action-primary-hover` | `#1A4886` | Hover state for all action-primary elements |
| `text-accent-strong` | `#143665` | Active nav text, selected filter pill text |
| `surface-primary-subtle` | `#D3DEEE` | Active nav bg, selected pill bg, selected dropdown item |
| `border-accent` | `#A6BDDC` | Active dropdown border, hover bg in dropdowns |
| `text-primary` | `#2A3D4A` | Body text on white backgrounds (AI Summary) |
| `border-subtle` | `#EBEBEB` | All card and panel borders |

**Domain 2: Data / Status**
| State | Background | Accent/Border | Text |
|---|---|---|---|
| Good/On-target | `bg-emerald-50` | `#22c55e` | `text-emerald-600` |
| Warning | `#FFFBE4` | `#D1A400` | `#342900` (never white on warning) |
| Critical/Error | `#FFEDEF` | `#E6001C` | `#8A0011` |
| Info | `#CCDDF5` | `#0056CC` | `#00347A` |

**AI gradient (only sanctioned gradient):** `linear-gradient(90deg, #725DA3, #864A9C)` — AILabel chip only.

**Lead Time domain colors (fixed):**
- VA (Value-Adding): `#215AA8`
- NNVA: `#d97706`
- UNVA: `#b91c1c`

**Plant colors (positional, never shuffled):**
```
Plant 1 → #3b82f6   Plant 2 → #f59e0b   Plant 3 → #ef4444
Plant 4 → #10b981   Plant 5 → #8b5cf6   Plant 6 → #f97316
```

### Cards & Panels

| Property | Dashboard KPI cards | Monitor components |
|---|---|---|
| Shape | `rounded-lg` (8px) | `rounded-xl` (12px) |
| Border | `border border-[#EBEBEB]` | `border border-slate-200` |
| Shadow at rest | none | none |
| Shadow on hover | `hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)]` | — |
| KPI padding | `px-[18px] py-4` | `px-3.5 py-2.5` |
| Chart padding | `p-3` to `p-4` | `p-3` |


### Typography Reference

| Role | Size | Weight | Color | Extra |
|---|---|---|---|---|
| Card label | `text-[10.5px]` | 700 | `text-slate-400` | `uppercase tracking-[0.08em]` |
| KPI value | `text-[2rem]` (32px) | 700 | `text-slate-900` or status | `tabular-nums tracking-tight` |
| Hero value (OEE) | `text-[3.25rem]` (52px) | 700 | status color | `tabular-nums tracking-tight` |
| Sub-metric | `text-2xl` (24px) | 700 | status color | `tracking-tight` |
| Unit/suffix | `text-[13px]` | 400 | `text-slate-400` | — |
| Note/subtitle | `text-[12px]` | 400 | `text-slate-500` | `leading-snug` |
| Chart panel title | `text-[10.5px]` | 700 | `text-slate-400` | `uppercase tracking-[0.08em] leading-none` |
| Badge/pill | `text-[10.5px]` | 700 | semantic pair | — |

> Note: Dashboard chart titles use the same style as card labels — NOT the `text-[13px] font-bold text-slate-800` style that appears in some older chart panels on the Lead Time page.

### Spacing

| Token | Value | Tailwind | Usage |
|---|---|---|---|
| KPI card padding | 18px × 16px | `px-[18px] py-4` | KPICard body |
| Chart panel padding | 12px–16px | `p-3` or `p-4` | Chart wrapper |
| Content padding | 20px | `p-5` | Page content area |
| KPI grid gap | 14px | `gap-[14px]` | All KPI grids |
| Section gap | 20px | `mb-5` | Between sections |
| Accent bar | 5px wide | `w-[5px]` | Left edge of KPI cards |

---

## Page Structure

### Shell
```
┌──────────────────────────────────────────┐
│  Header (52px, bg #215AA8)               │
│  [logo + brand text | filters | controls]│
├─────────┬────────────────────────────────┤
│ Sidebar │  Content area                  │
│ (224px) │  (bg #F1F5F9, p-5)             │
│ white   │  overflow-y: auto              │
│         │                                │
└─────────┴────────────────────────────────┘
```

### Sidebar (`components/dashboard/Sidebar.tsx`)
- `w-56` (224px), white, `border-r border-slate-200`
- Logo: `public/paragon-corp.98d5977b.png`
- Nav items: Strategic · Lead Time · Output · Productivity · OEE · Energy · Settings (bottom)
- Active state: `bg-[#D3DEEE] text-[#143665]` + right pip `bg-[#215AA8]`
- Inactivity logout: 15-minute idle timer

### Header (`components/dashboard/Header.tsx`)
- Fixed 52px, `bg-[#215AA8] border-b border-[#1A4886]`
- Left: brand text "MANUFACTURING CONTROL TOWER" (`text-[13px] font-medium text-white/50 uppercase tracking-[0.07em]`)
- Right: clock · sync status · notification bell · Teams send button · avatar
- Row 2 (filter row): view toggle (if `views.length >= 2`) · period pills · date picker · plant dropdown · data level pills · monitor button

The view toggle only renders when `views` prop has 2+ items. On `/dashboard`, `views={[]}` is passed so the toggle is hidden. On `/lead-time`, `views={LEAD_TIME_VIEWS}` shows Strategic/Tactical/Operational.

---

## Component Patterns

### KPI Card (`components/dashboard/KPICard.tsx`)
```
┌─[5px accent bar]──────────────────────┐
│ px-[18px] py-4  rounded-lg            │
│ LABEL  (10.5px bold slate-400 UPPER)  │
│ 32.00  days                           │
│ (2rem bold slate-900 / 13px slate-400)│
│ Note text  (12px slate-500)           │
│ [children: bars, sub-stats, sparkline]│
└────────────────────────────────────────┘
```
- Accent bar color derived from KPI status (green/amber/red/`#215AA8` for neutral)
- Animated value count-up on data refresh (Framer Motion)
- Flash overlay on refresh: `#215AA8` at 22% opacity, 0.9s ease-out
- `tooltip` prop shows hover tooltip (bg `#2A3D4A`)
- `alert` prop forces red accent and `border-[#FFEDEF]`

### Hero OEE Card (inline in `app/dashboard/page.tsx`)
- Full-width featured card
- 52px OEE value, green if ≥ 65%, red if < 65%
- Sub-metrics: Availability (derived), Performance, Quality at 24px
- 5px accent bar (red or green)
- "✓ On Target" / "⚠ Below Target" badge

### AISummary (`components/dashboard/AISummary.tsx`)
- White card (`bg-white rounded-lg border border-[#EBEBEB]`)
- AILabel chip: `linear-gradient(90deg,#725DA3,#864A9C)` pill — "✦ AI Summary"
- Body text: `13px text-[#2A3D4A] leading-relaxed`
- Clickable KPI numbers: `text-[#215AA8]` with underline

### AlertPanel (`components/dashboard/AlertPanel.tsx`)
- Critical row: `bg-[#FFEDEF] border-l-4 border-l-[#E6001C]`
- Warning row: `bg-[#FFFBE4] border-l-4 border-l-[#D1A400]`
- Dismiss with undo (5s countdown)

### TrendChart + StackedBarChart
Both charts share a KPI selector — changing selection in one updates the other. This is a deliberate design decision (Tableau parity).

**Nivo theme (shared config from `lib/chartConfig.ts`):**
- `fontFamily: "inherit"` — inherits Lato from body
- Axis tick text: `#9ca3af 10px`
- Grid lines: `#f3f4f6`
- Crosshair: `#215AA8`
- Tooltip bg: `#2A3D4A`
- SPC control zone fill: `#E9EFF6` (brand-50) at 55% opacity

**TrendChart:** Line chart per plant. X-axis: even ISO week numbers only (W2, W4...). SPC UCL/Mean/LCL bands.

**StackedBarChart:** Bar per plant, status legend (In Control / Above UCL / Below LCL).

---

## Monitor Mode Layout

Monitor mode (`/monitor`) is a fullscreen page with a dark bottom navigation bar. No sidebar, no standard header.

**Bottom nav:**
```
[clock 00:00:00 WIB] [Plant · Period] [Strategic pill] [Lead Time pill] [×]
```
- Background: `bg-[#0f172a]/90 backdrop-blur-xl border border-white/10 rounded-2xl`
- Active page pill: `bg-[#215AA8] text-white`
- Inactive page: `text-white/50 hover:text-white/90`

**Content area rules (no-scroll):**
- Container: `h-screen w-screen overflow-hidden bg-[#F4F6F9] flex flex-col`
- Each section inside: either `shrink-0` (fixed height) or `flex-1 min-h-0` (fills remaining space)
- No section should force scroll

**StrategicMonitor cards** use `rounded-xl` and `border-slate-200` (slightly different from dashboard cards) for a denser monitor aesthetic.

---

## Interactions

| Interaction | Behavior |
|---|---|
| Filter change | Immediate re-fetch, KPI values animate count-up |
| Data refresh | Flash `#215AA8` overlay 0.9s, values re-animate |
| Alert dismiss | Row slides out, undo toast appears for 5s |
| KPI number in AI Summary | `kpi-highlight` event, matching card briefly highlights |
| Monitor button | `router.push('/monitor?page=...')` (fullscreen page) |
| Escape in fullscreen | `fullscreenchange` event → `router.back()` |
| 15min idle | Auto-logout → `/login` |

---

## Loading States

- KPI cards: `SkeletonCard` components (`animate-pulse`, same height as loaded card)
- Charts: spinner (`border border-[#215AA8] border-t-transparent`)
- AI Summary: skeleton bar animation
- Monitor mode cards: inline `animate-pulse` divs matching card dimensions

---

## Do's and Don'ts

| ❌ Don't | ✅ Do |
|---|---|
| Use Inter, Space Grotesk, or any font other than Lato | Use Lato (already global) |
| Use `rounded-xl` on dashboard KPI cards | Use `rounded-lg` |
| Use `border-slate-200` on dashboard cards | Use `border-[#EBEBEB]` |
| Use `#1E4076` (old navy) as shell color | Use `#215AA8` (Paragon Blue) |
| Use `#215AA8` to signal KPI health | Use green/amber/red |
| Use gradients in product UI | Only use gradient on AILabel chip |
| Shuffle plant color order | Plant colors are positional and fixed |
| Put white text on warning yellow | Use `#342900` dark text on `#FFFBE4` |
| Use `border-gray-100` or `border-gray-200` | Use `border-[#EBEBEB]` |
| Add animation beyond `transition-all ease-out` | No `animate-bounce` |
| Add `animate-bounce` | Use `transition-all ease-out` |
