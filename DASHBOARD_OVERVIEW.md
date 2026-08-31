# Manufacturing Control Tower — Dashboard Overview

---

## Apa ini?

Dashboard real-time untuk monitoring KPI manufaktur. Data diambil langsung dari Snowflake, ditampilkan dalam bentuk kartu KPI + chart tren, bisa difilter per periode dan per pabrik.

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
| **Auth** | NextAuth.js |
| **Icons** | Lucide React |
| **Date util** | date-fns |
| **AI** | Anthropic SDK (AI Summary) |

---

## Arsitektur

```
Browser (React)
    │
    ├─ GET /api/dashboard/kpi         ← KPI cards
    ├─ GET /api/dashboard/trends      ← Chart data
    └─ GET /api/dashboard/plants      ← Plant dropdown
              │
              ▼
        Next.js API Routes (server)
              │
              ▼
        Snowflake SDK
              │
              ▼
        Snowflake (cloud data warehouse)
```

Next.js berfungsi ganda: sebagai frontend (React) sekaligus backend (API Routes). Tidak ada backend terpisah.

---

## Flow Data

1. User login → session disimpan via NextAuth
2. Dashboard load → `fetchData()` dipanggil otomatis
3. `fetchData` kirim request ke `/api/dashboard/kpi` dengan filter aktif (periode, plant, tanggal)
4. API Route di server query ke Snowflake menggunakan SDK
5. Snowflake return data → dikalkulasi di server → dikirim ke browser sebagai JSON
6. React render KPI cards + charts dari data tersebut
7. Auto-refresh setiap **1 jam**; user idle **15 menit** → otomatis logout

---

## Filter yang Tersedia

| Filter | Pilihan |
|---|---|
| **Periode** | YTD, 30D, 90D, 6M, Custom date range |
| **Plant** | All Plant / pabrik tertentu |
| **Data Level** | Daily, Weekly, Monthly |

Filter ini dikirim ke semua query sebagai parameter — artinya semua KPI card dan chart merespons filter yang sama secara bersamaan.

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
| **Productivity** | `CT_MANUF_E2E` + `CT_MANUF_OLAH` + `CT_MANUF_KEMAS` | E2E, Upstream, Downstream (pcs atau kg per manhour) |

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

## Charts

**Trend Chart** (kiri bawah)
— Line chart per plant, menunjukkan tren KPI dari waktu ke waktu.
Dilengkapi **SPC Control Limits**: UCL (batas atas), Mean, LCL (batas bawah) — sama seperti metode Statistical Process Control di Tableau.

**KPI by Plant** (kanan bawah)
— Bar chart rata-rata KPI per pabrik dalam periode yang dipilih.
Juga menampilkan status kontrol: *In Control / Above UCL / Below LCL*.

Kedua chart share KPI selector yang sama — kalau ganti KPI di satu chart, chart satunya ikut berubah.

---

## Fitur Lain

- **Animated numbers** — angka count-up saat data baru masuk
- **AI Summary** — ringkasan kondisi KPI dibuat otomatis via Anthropic API
- **Alert system** — muncul otomatis kalau ada KPI yang melewati threshold
- **Floating Chat** — tanya langsung soal data ke AI
- **Spring animations** — transisi filter pill pakai physics-based animation (Framer Motion)

---

## File Penting

| File | Fungsi |
|---|---|
| `app/dashboard/page.tsx` | Halaman utama dashboard |
| `lib/queries.ts` | Semua query ke Snowflake |
| `QUERIES.md` | Dokumentasi formula & query (source of truth) |
| `lib/chartConfig.ts` | Config warna plant + formula SPC |
| `components/dashboard/` | Semua komponen UI |
| `app/api/dashboard/` | API Routes (server-side) |
