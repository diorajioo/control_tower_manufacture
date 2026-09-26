# Project Overview — Control Tower Manufacturing

## What Is This

**Manufacturing Control Tower** is a real-time KPI dashboard for PT Paracorp Group's manufacturing operations. It replaces the previous Tableau-based reporting by connecting directly to Snowflake, eliminating the lag between data availability and decision-making.

Product name: "Control Tower" / "Manufacturing Control Tower"
Organization: PT Paracorp Group
Version: v1.1
Deployment: https://control-tower-manufacture.vercel.app (branch `main`)
Repository: https://github.com/diorajioo/control_tower_manufacture

## Users

| Role | Description |
|---|---|
| Plant Manager | Primary user. Reads dashboard at the start of each shift or daily ops meeting. Needs to assess plant health in under 5 seconds. |
| Operations Manager | Reviews KPI trends, investigates alerts, uses AI chat for root-cause analysis. |

Access is restricted to PT Paracorp Group corporate accounts — login via Azure AD (Microsoft SSO). There are no guest or public accounts.

Usage context: Workstation in office, desktop-first. Used at the start of shifts or during operational meetings. UI is in English (switched from Bahasa Indonesia on 2026-09-26).

## Business Problem

Before this system: KPI data lived in Snowflake but required manual export → Tableau → report distribution. This introduced hours or days of lag and meant decisions were based on stale data.

After: Managers open the dashboard and see current numbers directly from Snowflake. AI Summary auto-generates an executive reading. AI Analyst chatbot allows drill-down without needing SQL access.

## Pages & Routes

| Route | Status | Description |
|---|---|---|
| `/` | Live | Root redirect: authenticated → `/dashboard`, unauthenticated → `/login` |
| `/login` | Live | Azure AD SSO login page; typewriter animation, floating KPI icon cards |
| `/dashboard` | Live | Strategic view — main KPI dashboard (live Snowflake data) |
| `/dashboard/settings` | Live | Teams notification config, alert thresholds, display preferences |
| `/lead-time` | Live (partial real data) | Lead Time deep-dive — 3 views: Strategic / Tactical / Operational |
| `/monitor` | Live | Fullscreen monitor mode with bottom navigation (Strategic + Lead Time views) |
| `/dashboard/output` | Placeholder | Nav link exists; page not built |
| `/dashboard/productivity` | Placeholder | Nav link exists; page not built |
| `/dashboard/oee` | Placeholder | Nav link exists; page not built |
| `/dashboard/energy` | Placeholder | Nav link exists; page not built |

## Key Terminology

| Term | Meaning |
|---|---|
| **Strategic view** | Executive/manager view: Hero OEE card + 4 KPI cards + Equipment row + Charts. This is the default and only view on `/dashboard`. |
| **Tactical view** | Detailed/supervisor view. Only exists on `/lead-time` (not on `/dashboard`). |
| **Operational view** | Batch-level detail. Only exists on `/lead-time`. |
| **KPI** | Key Performance Indicator. The 7 core KPIs are Lead Time, Yield/Loss, RFT, Output, OEE, OPE, Productivity. |
| **Gross Lead Time** | Total calendar time from PO creation to NDC receipt (includes waiting time). |
| **Nett Lead Time** | Active processing time only (excludes waiting/idle). |
| **RFT** | Right First Time — % of batches completed without rework or rejection. |
| **OEE** | Overall Equipment Effectiveness = Quality × Performance. |
| **OPE** | Overall Plant Effectiveness = OEE × 0.8 (estimated). |
| **VA / NNVA / UNVA** | Value-Adding / Non-Necessary Value-Adding / Unnecessary Non-Value-Adding — lead time classification. |
| **NDC** | Distribution center / warehouse (Nusa Distribution Center). |
| **PO** | Production Order. |
| **FG** | Finished Goods. |
| **SFG** | Semi-Finished Goods (Bulk). |
| **Monitor Mode** | Fullscreen display at `/monitor`. Bottom nav bar for switching views. |

## Product Principles

1. **Keputusan berbasis data, bukan intuisi** — every number is traceable to Snowflake.
2. **Kecepatan membaca lebih dari kelengkapan** — managers must understand plant status in the first few seconds.
3. **Konsistensi antar pabrik** — all plants are shown with the same metrics and scales.
4. **AI sebagai asisten, bukan pengganti** — summaries and chat assist interpretation; decisions stay with the manager.

## Current Product Status

- `/dashboard` Strategic view: fully live with real Snowflake data
- `/lead-time`: Strategic KPI cards read from Snowflake; charts, stage breakdown and Tactical/Operational views still use static mock data
- `/monitor`: live, fullscreen mode with bottom navigation
- `/dashboard/settings`: live (Teams config, alert thresholds)
- Placeholder pages (Output, Productivity, OEE, Energy): nav links exist but pages are not built
- Azure AD group-based plant-level access control: planned but not yet implemented
