# Manufacturing Control Tower — Dashboard Overview

---

## Apa ini?

Dashboard real-time untuk monitoring KPI manufaktur PT Paracorp Group. Data diambil langsung dari Snowflake, ditampilkan dalam bentuk kartu KPI + chart tren, bisa difilter per periode dan per pabrik.

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **Animation** | Framer Motion |
| **Charts** | Nivo (`@nivo/line`, `@nivo/bar`) |
| **Database** | Snowflake (via `snowflake-sdk`) |
| **Auth** | NextAuth.js + Azure AD |
| **Icons** | Lucide React |
| **Date util** | date-fns |
| **AI** | Groq SDK (primary), Anthropic SDK (fallback) |
| **Notifications** | Microsoft Teams Graph API + Resend (email) |

---

## Arsitektur

```
Browser (React)
    │
    ├─ GET /api/dashboard/kpi         ← KPI cards
    ├─ GET /api/dashboard/trends      ← Chart data
    ├─ GET /api/dashboard/plants      ← Plant dropdown
    ├─ GET /api/dashboard/summary     ← AI Summary (5h cache)
    ├─ POST /api/notifications/teams  ← Teams alert
    └─ POST /api/chat                 ← AI Analyst chat
              │
              ▼
        Next.js API Routes (server)
              │
              ▼
        Snowflake SDK + Groq SDK
              │
              ▼
        Snowflake (cloud DW) / Groq API
```

Next.js berfungsi ganda: frontend (React) sekaligus backend (API Routes). Tidak ada backend terpisah.

---

## Halaman

| Halaman | Route | Status |
|---|---|---|
| **Overview (Dashboard)** | `/dashboard` | ✅ Live |
| **Lead Time** | `/lead-time` | ✅ Live |
| **Output** | `/dashboard/output` | 🔲 Planned |
| **Productivity** | `/dashboard/productivity` | 🔲 Planned |
| **OEE** | `/dashboard/oee` | 🔲 Planned |
| **Energy** | `/dashboard/energy` | 🔲 Planned |
| **Settings** | `/dashboard/settings` | ✅ Live |

---

## Views: Strategic vs Tactical

Dashboard Overview memiliki dua mode yang bisa di-toggle di header:

**Strategic** (default — untuk Plant Manager & BOD)
1. AI Summary strip (navy gradient)
2. Alert Panel (jika ada alert aktif)
3. Hero OEE card — full-width, nilai 52px, derivasi Availability
4. Operation KPIs — 4-col grid (Lead Time, Yield, RFT, Output)
5. Equipment & People — **2-col** grid (OPE, Productivity)
6. Trend & Benchmark charts

**Tactical** (untuk Supervisor produksi)
- Sama, tapi tanpa Hero OEE card
- Equipment & People — **3-col** grid (OEE, OPE, Productivity)

---

## Flow Data

1. User login → session via NextAuth + Azure AD
2. Dashboard load → `fetchData()` dipanggil otomatis
3. `fetchData` kirim request ke `/api/dashboard/kpi` dengan filter aktif
4. API Route query Snowflake via SDK
5. Snowflake return data → dikalkulasi server-side → JSON ke browser
6. React render KPI cards + charts
7. Auto-refresh setiap **1 jam**; idle **15 menit** → auto logout

---

## Filter yang Tersedia

| Filter | Pilihan |
|---|---|
| **Periode** | YTD, 30D, 90D, 6M, Custom date range |
| **Plant** | All Plant / pabrik tertentu |
| **Data Level** | Daily, Weekly, Monthly |

Filter persist ke `localStorage` (key: `ct-filters`). Semua KPI card dan chart merespons filter yang sama secara bersamaan.

---

## KPI yang Ditampilkan

| KPI | Sumber Tabel | Yang Dihitung |
|---|---|---|
| **Lead Time** | `CT_MANUF_LEADTIME` | Rata-rata waktu PO → NDC (Gross & Nett) |
| **Yield** | `CT_MANUF_KEMAS` + `OUTPUT_OLAH` | % Bulk Loss & Pack Loss |
| **Right First Time** | `CT_MANUF_LEADTIME` | % batch tanpa rework/rejection |
| **Output** | `OUTPUT_OLAH` + `OUTPUT_FG` | Total produksi Bulk (kg) & FG (pcs) |
| **OEE** | `CT_MANUF_KEMAS` | Quality × Performance per mesin |
| **OPE** | *(derived)* | OEE × 0.8 (estimasi overall plant) |
| **Productivity** | `CT_MANUF_E2E` + `CT_MANUF_OLAH` + `CT_MANUF_KEMAS` | pcs atau kg per manhour |

---

## Tabel Snowflake yang Dipakai

```
MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH
DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG
```

---

## Charts (Overview page)

**Trend Chart** — `components/dashboard/TrendChart.tsx`
Line chart per plant, tren KPI dari waktu ke waktu.
SPC Control Limits: UCL · Mean · LCL (Statistical Process Control).
Control zone (UCL–LCL) dirender sebagai filled band ungu muda.

**KPI by Plant** — `components/dashboard/StackedBarChart.tsx`
Bar chart rata-rata KPI per pabrik dalam periode yang dipilih.
Menampilkan status: *In Control / Above UCL / Below LCL*.

Kedua chart share KPI selector yang sama — ganti KPI di satu chart, chart satunya ikut.

---

## Fitur Lain

| Fitur | Keterangan |
|---|---|
| **Animated numbers** | Count-up saat data baru masuk (Framer Motion) |
| **Flash overlay** | Indigo flash 0.9s saat refresh |
| **AI Summary** | Ringkasan 3 kalimat, navy gradient strip, 5-jam cache |
| **Alert system** | Auto-threshold: OEE<65%, Loss>3%, RFT<95% |
| **Teams alerts** | DM personal via Graph API — no admin consent |
| **Floating Chat** | Diagnostic AI Analyst: live KPI context injection, 5-step framework (Observe→Hypothesize→Ask ONE→Narrow→Recommend), 10-turn conversation memory, enhanced WHY-pattern model routing |
| **Spring animations** | Filter pill transitions (Framer Motion layoutId) |
| **Auto logout** | Idle 15 menit → redirect ke /login |

---

## AI Diagnostic Framework

`lib/diagnostic-prompt.ts` membangun system prompt dinamis yang dikirim ke Groq sebelum setiap percakapan.

**Apa yang dikirim ke AI sebelum user bicara:**
- Filter aktif (plant, periode, tanggal)
- KPI Snapshot live: nilai aktual OEE, Lead Time, Bulk Loss, Pack Loss, RFT, Output, Produktivitas — plus flag ⚠/✓ vs target
- Alert aktif (severity, KPI, pesan)

**Framework diagnostik (Observe → Hypothesize → Ask ONE → Narrow → Recommend):**
1. OBSERVE — sebut angka aktual vs target, besar gap
2. HYPOTHESIZE — ajukan 1–2 hipotesis penyebab paling masuk akal
3. ASK ONE — tanya tepat 1 pertanyaan untuk validasi hipotesis
4. NARROW — gunakan jawaban user untuk mempersempit hipotesis
5. RECOMMEND — beri rekomendasi konkret hanya setelah hipotesis tervalidasi

**Conversation memory:** 10 pesan terakhir dikirim bersama setiap request sehingga AI punya konteks percakapan.

**Enhanced model routing** (`lib/agent-router.ts`): pattern WHY, root-cause, tren, strategi, korelasi → otomatis pakai model terkuat (gpt-oss-120b). Lookup sederhana → model ringan.

**KPI highlight tags:** AI menyisipkan `[kpi:id]` setelah nilai numerik agar UI bisa highlight kartu yang relevan di dashboard.

---

## File Penting

| File | Fungsi |
|---|---|
| `app/dashboard/page.tsx` | Halaman utama dashboard (Strategic + Tactical view) |
| `app/lead-time/page.tsx` | Halaman Lead Time (Strategic / Tactical / Operational) |
| `components/dashboard/Header.tsx` | Shared header: nav bar + filter row |
| `components/dashboard/Sidebar.tsx` | Shared sidebar: logo + nav links + auto-logout |
| `components/dashboard/KPICard.tsx` | Card KPI dengan accent bar + animated value |
| `components/dashboard/TrendChart.tsx` | Line chart tren per plant |
| `components/dashboard/StackedBarChart.tsx` | Bar chart KPI per plant |
| `components/dashboard/AISummary.tsx` | AI Summary strip |
| `components/dashboard/FloatingChat.tsx` | Floating AI Analyst chat (sends kpiSnapshot + alerts + history) |
| `lib/diagnostic-prompt.ts` | Dynamic system prompt builder — KPI snapshot + diagnostic framework |
| `lib/agent-router.ts` | Complexity classifier → model selector (simple/moderate/complex) |
| `lib/queries.ts` | Semua query ke Snowflake |
| `lib/alerts.ts` | Logic threshold + alert generation |
| `lib/chartConfig.ts` | PLANT_COLORS, KPI_OPTIONS, SPC formula |
| `lib/i18n.ts` | Indonesian translation keys |
| `app/api/dashboard/` | API Routes: kpi, trends, plants, summary |
| `app/api/notifications/teams/` | Teams alert endpoint |
| `QUERIES.md` | Dokumentasi formula & query (source of truth) |
| `DESIGN.md` | Design system lengkap |
| `FORMATTING_GUIDE.md` | Quick-reference: token font, warna, spacing |
| `public/paragon-corp.98d5977b.png` | Logo Paragon Corp (sidebar) |
