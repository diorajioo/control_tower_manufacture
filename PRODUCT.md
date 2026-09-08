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

## Capabilities and Constraints

**KPI structure (tidak boleh diubah):**
- Lead Time, Yield/Loss, Right First Time (RFT), Output (baris 1)
- OEE, OPE, Productivity (baris 2)

**AI Features:**
- AI Summary: ringkasan eksekutif otomatis 3 kalimat di atas dashboard, di-cache 5 jam, powered by Groq (primary: openai/gpt-oss-120b, fallback: groq/compound → qwen/qwen3.8-27b)
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
- Recharts dipertahankan sebagai library chart; hanya styling yang boleh diubah
- Brand color indigo (#4f46e5 / brand-600) dipertahankan
- Semua UI copy tetap Bahasa Indonesia
- Autentikasi via Azure AD (NextAuth.js)
- Vercel deployment dari branch `main`; branch `dev` untuk staging lokal

## Brand Commitments

- Nama produk: "Control Tower" + "Manufacturing Dashboard"
- Organisasi: PT Paracorp Group
- Primary color: Indigo (#4f46e5)
- Typography: Space Grotesk (heading/angka besar), Plus Jakarta Sans (body)
- Icon: Factory icon (Lucide) di rounded-square badge

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