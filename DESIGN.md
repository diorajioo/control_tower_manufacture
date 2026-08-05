---
name: Control Tower Manufacturing Dashboard
description: Dasbor operasional manufaktur real-time untuk manajer pabrik PT Paracorp Group
colors:
  brand: "#4f46e5"
  brand-deep: "#3730a3"
  brand-light: "#6366f1"
  brand-surface: "#f8f7ff"
  brand-sidebar: "#f0eeff"
  status-good: "#22c55e"
  status-warn: "#f59e0b"
  status-bad: "#ef4444"
  status-info: "#3b82f6"
  plant-blue: "#3b82f6"
  plant-amber: "#f59e0b"
  plant-red: "#ef4444"
  plant-green: "#10b981"
  plant-purple: "#8b5cf6"
  plant-orange: "#f97316"
  neutral-text: "#374151"
  neutral-muted: "#6b7280"
  neutral-subtle: "#9ca3af"
  neutral-border: "#e5e7eb"
  neutral-card: "#ffffff"
typography:
  display:
    fontFamily: "Space Grotesk, sans-serif"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontWeight: 400
    fontSize: "0.875rem"
    lineHeight: 1.5
  label:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontWeight: 500
    fontSize: "0.75rem"
    letterSpacing: "0.01em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  kpi-card:
    backgroundColor: "{colors.neutral-card}"
    rounded: "{rounded.xl}"
    padding: "16px"
  nav-item-active:
    backgroundColor: "{colors.brand-surface}"
    textColor: "{colors.brand}"
    rounded: "{rounded.md}"
  filter-pill-active:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
  filter-pill-inactive:
    backgroundColor: "#f3f4f6"
    textColor: "{colors.neutral-muted}"
    rounded: "{rounded.full}"
---

# Design System: Control Tower Manufacturing Dashboard

## Overview

**Creative North Star: "The Operations War Room"**

Control Tower is built for the moment of decision. Every morning, a plant manager opens this dashboard and needs to know — in under five seconds — whether the factory is running clean or on fire. The design language serves that moment without apology: dense but not cluttered, high-signal but not alarm-heavy, authoritative but not intimidating.

Color is signal, not decoration. Indigo (#4f46e5) marks the system's own intelligence: navigation, controls, AI summaries. Green, amber, and red belong to the data — they report what the machines are doing. No color is used merely to look good. No element exists without a job.

The aesthetic draws from precision instrumentation rather than consumer software. This is closer to a Bloomberg Terminal that a production team would actually love to use: everything visible at once, status readable without clicking, context preserved across sessions.

**Key Characteristics:**
- High information density with intentional breathing room between card groups
- Color as a binary signal system: indigo = system, green/amber/red = data status
- Two-typeface system: Space Grotesk for numbers and headings, Plus Jakarta Sans for labels and prose
- Flat surfaces at rest, subtle shadow on hover and elevation
- Indigo sidebar and brand-surface background create a visual "frame" separating navigation from content

## Colors

Palette operates in two distinct domains: **brand/system** (indigo family) and **data/status** (semantic tricolor).

### Primary
- **Command Indigo** (#4f46e5): Primary brand color. Used for sidebar navigation active states, primary buttons, chart highlights, and the AI interface. This is the system's voice.
- **Deep Indigo** (#3730a3): Sidebar header gradient, dark-mode-adjacent surfaces.
- **Soft Indigo** (#6366f1): Secondary brand accents, chart stroke highlights.

### Secondary
- **Brand Surface** (#f8f7ff): Main content background. Slightly lavender-tinted white creates visual separation from pure-white cards.
- **Brand Sidebar** (#f0eeff): Sidebar background. Deeper tint creates the navigation "frame."

### Tertiary (Plant Legend Colors)
Six consistent plant colors for multi-plant chart legends:
- Plant Blue (#3b82f6), Plant Amber (#f59e0b), Plant Red (#ef4444), Plant Green (#10b981), Plant Purple (#8b5cf6), Plant Orange (#f97316)
- These are fixed per-plant across all chart types — never reordered.

### Neutral
- **Primary Text** (#374151): Headings, KPI values, primary labels.
- **Muted Text** (#6b7280): Secondary labels, timestamps, subtitles.
- **Subtle Text** (#9ca3af): Placeholder text, de-emphasized values.
- **Border** (#e5e7eb): Card borders, dividers, input strokes.
- **Card Surface** (#ffffff): All KPI cards and content panels sit on pure white.

### Status Colors
- **On Track** (#22c55e / green): KPI within target, positive trend, healthy metric.
- **Watch** (#f59e0b / amber): KPI approaching threshold, warning state.
- **Critical** (#ef4444 / red): KPI outside control limits, alert state.
- **Info** (#3b82f6 / blue): Lead time domain, informational indicators.

### Named Rules
**The Two-Domain Rule.** Indigo is the system. Green/amber/red belongs to the data. Never use status colors for UI chrome (buttons, nav, icons) and never use brand indigo to signal KPI health. A brand-colored metric would poison the signal.

**The Plant Color Permanence Rule.** Plant color assignments (#3b82f6 for Plant 1, etc.) are positional constants across all chart types. Shuffling them in any view breaks cross-chart pattern recognition.

## Typography

**Display Font:** Space Grotesk (500–700 weight, sans-serif)
**Body Font:** Plus Jakarta Sans (400–600 weight, sans-serif)

**Character:** Space Grotesk's geometric confidence makes large KPI numbers feel authoritative rather than clinical. Plus Jakarta Sans grounds labels and prose in readable warmth. Together they read as "precise but human" — appropriate for a tool that carries operational weight.

### Hierarchy
- **Display** (Space Grotesk, 700, text-3xl/30px, leading-none): KPI values (OEE %, Lead Time days, Output pcs). Purpose: immediate status read at a glance.
- **Headline** (Space Grotesk, 600, text-xl/20px): Card section headers, chart titles.
- **Title** (Plus Jakarta Sans, 600, text-sm/14px): KPI card titles, sidebar nav labels, panel headings.
- **Body** (Plus Jakarta Sans, 400, text-sm/14px, leading-relaxed): AI summary text, alert descriptions, helper copy.
- **Label** (Plus Jakarta Sans, 500, text-xs/12px, tracking-wide): Filter pills, badges, table headers, legends. Max-width 65ch for reading comfort.

### Named Rules
**The Number-as-Hero Rule.** KPI values use Space Grotesk display weight. Labels and context use Plus Jakarta Sans. Never swap: a prose label in Space Grotesk adds visual noise; a KPI in Plus Jakarta Sans loses authority.

## Layout

The dashboard is organized in a fixed two-column shell: sidebar (240px fixed) + main content (fluid). Main content uses a responsive grid:

- **KPI Row 1** (Operational): `grid-cols-2 lg:grid-cols-4` — 4 KPI cards (Lead Time, Yield, RFT, Output)
- **KPI Row 2** (Equipment & People): `grid-cols-3` — 3 KPI cards (OEE, OPE, Productivity)
- **Charts Row**: 2-column (TrendChart + StackedBarChart), each 50% width on lg+

Container max-width: unconstrained (full fluid within sidebar). Card padding: `p-4` (16px) standard, `p-3` (12px) for compact variants.

Section headers use colored left-border dividers (brand indigo / purple / blue) to group related KPIs. This creates visual "chapters" without adding navigation.

Spacing rhythm: 4px base unit. `gap-3` (12px) between cards in a row, `gap-6` (24px) between rows/sections.

## Elevation & Depth

This system is **flat by default, shadow on state**. Card surfaces are flat at rest — depth is communicated through background color difference (white cards on #f8f7ff body), not shadows. Shadows appear only as a response to interaction:

- **Hover state**: `shadow-md` on KPI cards and interactive elements
- **Floating elements**: `shadow-xl` for the chat window and dropdown overlays
- **No ambient shadow**: Cards at rest have only a border (`border border-gray-100`) — no default box-shadow.

### Named Rules
**The Flat-at-Rest Rule.** Surfaces do not cast shadows at rest. Shadow is a response state, not a default style. If every card has a shadow, none of them do.

## Shapes

Corner language is **consistently rounded, never sharp**:
- Large containers (KPI cards, panels, chart wrappers): `rounded-xl` (12px) or `rounded-2xl` (16px)
- Interactive controls (buttons, pills, badges): `rounded-full` (9999px) — fully circular
- Small elements (input fields, tooltips): `rounded-lg` (8px)

No sharp 0px corners anywhere. No organic curves or asymmetric shapes.

Badge elements (KPI status badges, plant legend chips) use `rounded-full` to create clear visual distinction from content containers.

## Components

### KPI Cards
The central unit of the dashboard. High-density with strict internal hierarchy.
- **Shape:** `rounded-xl` (12px), white background, `border border-gray-100`
- **Elevation:** flat at rest; `shadow-md` on hover
- **Primary value:** Space Grotesk 700, `text-3xl` (30px), domain-specific color (blue for lead time, green/amber/red for status KPIs)
- **Title:** Plus Jakarta Sans 600, `text-sm`, `text-gray-600`
- **Status badge:** `rounded-full`, `text-xs`, semantic background + text color pair (e.g., `bg-green-100 text-green-700`)
- **Internal toggle buttons** (Gross/Nett, Daily/Hourly): `rounded-full`, `text-xs`, active = `bg-brand-600 text-white`, inactive = `bg-gray-100 text-gray-500`

### Filter Pills (Header)
- **Active:** `bg-brand-600 text-white rounded-full px-3 py-1.5 text-xs font-medium`
- **Inactive:** `bg-gray-100 text-gray-600 rounded-full px-3 py-1.5 text-xs font-medium`
- **Hover (inactive):** `bg-gray-200`
- No border on pills — background is the differentiator.

### Sidebar Navigation
- **Background:** `bg-brand-sidebar` (#f0eeff)
- **Active item:** `bg-brand-surface text-brand-600 rounded-md font-semibold`
- **Inactive item:** `text-gray-600 hover:bg-white/50 rounded-md`
- **Brand header:** gradient `from-brand-800 via-brand-700 to-brand-600` on white text

### Charts (Recharts)
- **Line chart:** `strokeWidth: 2.5`, plant color per series, no area fill by default
- **Control limits:** dashed lines (`strokeDasharray: "4 2"`), `stroke: #6b7280`, no legend label
- **Control zone fill:** `fill: #eff6ff` (light blue), `fillOpacity: 0.45`
- **Circular gauge:** `strokeWidth: 10`, arc shape, domain-status color, background arc `#f0fdf4`

### Floating Chat
- **Position:** fixed bottom-right (`bottom-6 right-6`)
- **Container:** `rounded-2xl shadow-2xl`, `w-96 h-[500px]`
- **Header gradient:** `from-brand-800 to-brand-600`
- **Input:** `rounded-xl border-gray-200 focus:ring-brand-300`

## Do's and Don'ts

### Do:
- **Do** use status colors (green/amber/red) only for data-driven state. Never use them for decorative purposes.
- **Do** keep Space Grotesk reserved for numeric KPI values and section headings only.
- **Do** maintain plant color assignments positionally — Plant 1 is always #3b82f6 across all views.
- **Do** use `rounded-full` for all pill-style controls and badges; use `rounded-xl` for all card containers.
- **Do** show shadow only as a response to hover or elevation state — never as a default card style.
- **Do** write all UI copy in Indonesian (Bahasa Indonesia) — labels, alerts, tooltips, error messages.

### Don't:
- **Don't** use brand indigo (#4f46e5) to signal KPI health status. It's the system color, not a data color.
- **Don't** replace Recharts with another charting library — only styling changes are permitted.
- **Don't** reorder or rename the 6 core KPIs (Lead Time, Yield, RFT, Output, OEE, Productivity).
- **Don't** use Plus Jakarta Sans for large KPI numeric displays — Space Grotesk owns numbers.
- **Don't** add shadows to cards at rest — flat surfaces with border-gray-100 is the default.
- **Don't** introduce new font families — the two-font system (Space Grotesk + Plus Jakarta Sans) is fixed.
- **Don't** use `animate-bounce` for UI feedback — it reads as dated and unprofessional. Use smooth ease-out transitions instead.