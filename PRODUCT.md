# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Plant Manager dan Operations Manager PT Paracorp Group. Mereka memantau performa pabrik harian dan membuat keputusan operasional berdasarkan KPI. Akses dibatasi untuk personel yang berwenang; login via Azure AD corporate.

## Product Purpose

Control Tower Manufacturing adalah dashboard operasional yang memberikan visibilitas real-time atas KPI produksi seluruh pabrik PT Paracorp Group langsung dari Snowflake data warehouse — tanpa menunggu laporan manual. Sukses berarti manajer bisa langsung membaca status pabrik dan mengambil keputusan di awal hari kerja.

## Positioning

Real-time visibility langsung dari Snowflake: data tidak melewati proses manual, sehingga angka selalu up-to-date. Dilengkapi AI summary dan chat untuk interpretasi KPI tanpa harus membaca tabel angka sendiri.

## Operating Context

- Digunakan di awal shift atau rapat harian operasional
- Multi-plant: satu view untuk semua pabrik sekaligus
- UI dalam Bahasa Indonesia karena seluruh pengguna adalah staf lokal
- Data warehouse: Snowflake schema MIGRATION.CONTROL_TOWER

## Pages & Routes

| Route | Status | Description |
|---|---|---|
| `/` | Live | Redirect: auth → `/dashboard`, no-auth → `/login` |
| `/login` | Live | Azure AD login, typewriter animation, floating KPI cards |
| `/dashboard` | Live | Main KPI dashboard — Strategic & Tactical views, Monitor Mode, TV Mode |
| `/lead-time` | Live (mock data) | Lead Time deep-dive — 3 views: Strategic / Tactical / Operational |
| `/dashboard/settings` | Live | Notifikasi Teams, alert thresholds, display preferences |
| `/dashboard/output` | Placeholder | Nav link exists, halaman belum dibangun |
| `/dashboard/productivity` | Placeholder | Nav link exists, halaman belum dibangun |
| `/dashboard/oee` | Placeholder | Nav link exists, halaman belum dibangun |
| `/dashboard/energy` | Placeholder | Nav link exists, halaman belum dibangun |

### `/dashboard` — Main Dashboard
- **Strategic view**: Hero OEE card, 4 Operation KPIs (Lead Time/Yield/RFT/Output), Equipment & People (OEE/OPE/Productivity), Trend charts, AI Summary
- **Tactical view**: Abbreviated layout for operation floors
- **Monitor Mode**: Fullscreen display, auto-rotating sections (OKPIs → Equipment → Trends)
- **TV Mode**: Auto-cycles every 20 seconds
- Data: live Snowflake via `/api/dashboard/kpi` and `/api/dashboard/trends`

### `/lead-time` — Lead Time Page
- **Strategic view** (default): 3 KPI cards (Gross LT / UNVA % / Savings potential), Stage Group chart (VA/NNVA/UNVA breakdown), Top 5 + Bottom 5 SKU tables side-by-side, On-Time PO Trend line, Lead Time Pareto per SKU (Nivo bar + cumulative % custom layer)
- **Tactical view**: 4 KPI cards, 20-stage bar chart (Gross/Nett/Pareto toggle), trend line by stage
- **Operational view**: Batch exceptions panel (critical/warning), 6×6 stage heatmap (daily)
- Data: **static mock data** — not yet connected to Snowflake
- Color classifications: VA = `#215AA8` · NNVA = `#d97706` · UNVA = `#b91c1c`

## Universal Components

### `components/dashboard/Header`
Used on ALL pages. Props:
- `views?: Array<{ key: string; label: string }>` — configurable view toggle (defaults to Strategic/Tactical)
- `activeView: string` + `onViewChange: (v: string) => void`
- `plants`, `onFilterChange`, `onRefresh`, `isLoading`, `lastUpdated`
- `alertCount`, `alerts`, `onDismiss`, `onBellClick`
- `onMonitorMode` — shows monitor icon button when provided

### `components/dashboard/Sidebar`
Nav links: Overview / Lead Time / Output / Productivity / OEE / Energy / Settings. Inactivity logout after 15 min.

## Capabilities and Constraints

**KPI structure (tidak boleh diubah):**
- Lead Time, Yield/Loss, Right First Time (RFT), Output (baris 1)
- OEE, OPE, Productivity (baris 2)

**AI Features:**
- AI Summary: ringkasan eksekutif otomatis di atas dashboard, di-cache 5 jam, powered by Groq (primary: `openai/gpt-4o` via Groq, fallback: `compound-beta` → `qwen/qwen3-8b`)
- AI Analyst chatbot (floating UI): query Snowflake via tool use, format respons per-section dengan emoji, selalu menyertakan follow-up questions untuk guided insight discovery
- Chatbot tools: `get_kpi_data` (7 KPI types) + `get_weekly_trend` (8 trend types: leadtime, upstream, downstream, e2e, oee, rft, output, batch)
- Agent routing: kompleksitas pertanyaan menentukan model yang dipakai

**Alert System:**
- KPI alerts otomatis berdasarkan threshold (OEE < 65%, Bulk Loss > 3%, Pack Loss > 1%, RFT < 95%)
- Severity: critical / warning
- Auto-kirim alert critical ke Microsoft Teams via Graph API (delegated, tanpa admin consent)
- Alert panel di dashboard dengan dismiss + undo (5 detik)
- Tidak re-send alert yang sama dalam satu sesi

**Notifikasi:**
- Microsoft Teams: DM personal via Graph API (Chat.Create + ChatMessage.Send)
- Fallback: Power Automate webhook (legacy, jika TEAMS_RECIPIENTS tidak di-set)
- Email: via Resend API

**Constraints teknis:**
- Chart library: Nivo (`@nivo/line`, `@nivo/bar`) — tidak boleh diganti ke Recharts atau library lain
- Brand shell (Paradise Design System v2): Paragon Blue `#215AA8` — header bg, sidebar accent, nav item aktif. Tidak dipakai untuk sinyal KPI
- Semua UI copy tetap Bahasa Indonesia
- Autentikasi via Azure AD (NextAuth.js)
- Vercel deployment dari branch `main`; branch `dev` untuk staging lokal

## Brand Commitments

- Nama produk: "Control Tower" / "Manufacturing Control Tower"
- Organisasi: PT Paracorp Group
- Shell color (Paradise Design System v2): Paragon Blue `#215AA8` (header bg, sidebar active, nav accent) — bukan untuk data/KPI. Hover: `#1A4886`. Text-accent-strong: `#143665`. Surface-subtle: `#D3DEEE`. Border-subtle: `#EBEBEB`. Text-primary: `#2A3D4A`
- Status colors: Green `#22c55e` (good) · Amber `#f59e0b` (warn) · Red `#ef4444` (bad)
- Typography: Inter exclusively — 14px base, `-webkit-font-smoothing: antialiased`
- Logo: `paragon-corp.98d5977b.png` di sidebar, teks "MANUFACTURING CONTROL TOWER" di header nav
- Chart panel standard: `rounded-lg p-4 border border-[#EBEBEB] hover:shadow-[0px_8px_16px_-6px_rgba(42,61,74,0.12)]`
- Chart title standard: `text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.08em] leading-none`

## Evidence on Hand

- Kode Next.js 14 lengkap di repositori (github.com/diorajioo/control_tower_manufacture)
- Snowflake tables: CT_MANUF_LEADTIME, CT_MANUF_KEMAS, CT_MANUF_OLAH, CT_MANUF_E2E, CT_MANUF_TRENDS, DATAMART_PRODUCTION_OUTPUT_OLAH, DATAMART_PRODUCTION_OUTPUT_FG
- Vercel deployment: control-tower-manufacture.vercel.app (branch main)
- Versi produk: v1.1

## Product Principles

1. **Keputusan berbasis data, bukan intuisi** — setiap angka dapat ditelusuri ke sumber Snowflake
2. **Kecepatan membaca lebih dari kelengkapan** — manajer harus memahami status pabrik dalam detik pertama
3. **Konsistensi antar pabrik** — semua plant ditampilkan dengan metrik dan skala yang sama
4. **AI sebagai asisten, bukan pengganti** — summary dan chat membantu interpretasi, keputusan tetap di tangan manajer

## Accessibility & Inclusion

Tidak ada kebutuhan aksesibilitas khusus yang ditetapkan. UI desktop-first; pengguna bekerja di workstation kantor.