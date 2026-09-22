# Monitor Page — Design Overrides

Route: `/monitor`
Implementation: `app/monitor/page.tsx`

Inherits all rules from `DESIGN_OVERVIEW.md`. Significant structural deviations below.

---

## Shell

Monitor is a fullscreen page. **No sidebar. No standard header.**

Container: `h-screen w-screen overflow-hidden bg-[#F4F6F9] flex flex-col`

No section inside Monitor should force scroll. Use `shrink-0` for fixed-height sections and `flex-1 min-h-0` for fill sections.

## Bottom Navigation

```
[clock 00:00:00 WIB] [Plant · Period] [Strategic pill] [Lead Time pill] [×]
```

- Background: `bg-[#0f172a]/90 backdrop-blur-xl border border-white/10 rounded-2xl`
- Active page pill: `bg-[#215AA8] text-white`
- Inactive page: `text-white/50 hover:text-white/90`

## Card Style (overrides global default)

| Property | Monitor value | Global default |
|---|---|---|
| Shape | `rounded-xl` (12px) | `rounded-lg` (8px) |
| Border | `border border-slate-200` | `border border-[#EBEBEB]` |
| Shadow on hover | — (none) | `hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)]` |
| KPI padding | `px-3.5 py-2.5` | `px-[18px] py-4` |

These overrides exist for the denser monitor aesthetic. Do not apply them to dashboard or lead-time cards.

## Sub-pages

Monitor has two sub-pages toggled via the bottom nav:
- **Strategic** (`/monitor?page=strategic`) — implemented in `components/monitor/StrategicMonitor.tsx`
- **Lead Time** (`/monitor?page=lead-time`) — implemented in `components/monitor/LeadTimeMonitor.tsx`
