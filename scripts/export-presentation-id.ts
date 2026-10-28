/**
 * Export Indonesian-language version of the presentation → PDF only
 * Usage: npx tsx scripts/export-presentation-id.ts
 */
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HTML_FILE = path.join(ROOT, 'public', 'control-tower-presentation.html');
const OUT_PDF = path.join(ROOT, 'public', 'PDP - FINAL YEAR - DIO ARIOSENO - MT DATA ANALYST - Bahasa.pdf');

const SLIDE_IDS = [
  'S1', 'S1P', 'S2', 'S5W', 'S3', 'S4',
  'S6', 'S6R', 'S6M', 'S6b',
  'S7R', 'S7A', 'S7', 'S8', 'S8T',
  'S9', 'S9L', 'S9DA', 'S9DB', 'S9P', 'S10',
];

const WIDTH  = 1280;
const HEIGHT = 720;

// ─── Translation map ──────────────────────────────────────────────────────────
// Applied as exact-string replacements on the HTML source.
// Ordered longest-first to avoid partial-match conflicts.
const TRANSLATIONS: [string, string][] = [

  // ── S1P ──────────────────────────────────────────────────────────────────
  ['Context — Our Business Process', 'Konteks — Alur Bisnis Kami'],
  ['How a PO Moves Through Our Plants', 'Bagaimana PO Mengalir di Pabrik'],
  ['Every process is logged in Snowflake. Until now, managers read it through Tableau views and hand-built Excel reports, so a problem in one process surfaced days later.',
   'Semua proses tercatat di Snowflake. Selama ini manajer membacanya lewat Tableau dan laporan Excel buatan sendiri — kalau ada masalah di satu proses, baru ketahuan beberapa hari kemudian.'],
  ['Next: the problem →', 'Selanjutnya: masalahnya →'],

  // ── S2 ───────────────────────────────────────────────────────────────────
  ['Section 1 — Define the Problem', 'Bagian 1 — Identifikasi Masalah'],
  ['Problem vs Ideal State', 'Kondisi Saat Ini vs Kondisi Ideal'],
  ['🔴 Current State — The Problem', '🔴 Kondisi Saat Ini — Masalah'],
  ['🟢 Ideal State — What We Want', '🟢 Kondisi Ideal — Yang Ingin Dicapai'],
  ['Tableau dashboards are static. Plant Managers must open them to find problems — no alert fires when a KPI breaches its threshold.',
   'Dashboard Tableau statis. Plant Manager harus buka sendiri untuk tahu ada masalah — tidak ada notifikasi otomatis saat KPI melewati batas.'],
  ['"OEE is 58%" — but why? No AI to explain it, so data is exported view by view and compiled in Excel: 3–4 days per report.',
   '"OEE 58%" — tapi kenapa? Tidak ada AI yang bisa menjelaskan, jadi data diekspor satu-satu ke Excel: 3–4 hari per laporan.'],
  ['The manufacturing team downloads data from Metabase and builds its own reports. Each report is a separate copy with its own formulas — there is no single version of the numbers.',
   'Tim manufaktur download data dari Metabase dan bikin laporan sendiri. Setiap laporan punya salinan terpisah dengan rumusnya sendiri — tidak ada satu versi angka yang jadi acuan bersama.'],
  ['The daily board is built by hand from static reports, so the PDCA cycle can\'t run on live data.',
   'Papan harian dibuat manual dari laporan statis, jadi siklus PDCA tidak bisa berjalan dengan data real-time.'],
  ['Changes take weeks and only licensed Creators can build. Per-seat licensing ($278K/year) limits who gets access.',
   'Perubahan butuh berminggu-minggu dan hanya Creator berlisensi yang bisa membangun. Biaya per kursi ($278K/tahun) membatasi siapa yang bisa akses.'],
  ['Live KPIs from Snowflake. The system detects issues and pushes alerts to the right person\'s Teams DM.',
   'KPI real-time dari Snowflake. Sistem mendeteksi masalah dan langsung kirim notifikasi ke Teams DM orang yang tepat.'],
  ['Automated executive summary and a chatbot that answers from real data — report prep drops to 3–4 hours.',
   'Ringkasan eksekutif otomatis dan chatbot yang menjawab dari data nyata — waktu persiapan laporan turun jadi 3–4 jam.'],
  ['A single control tower: all KPIs, all plants, alerts and AI in one entry point — the single source of truth for daily decisions.',
   'Satu control tower: semua KPI, semua pabrik, notifikasi dan AI dalam satu pintu masuk — referensi tunggal untuk keputusan harian.'],
  ['Live KPIs, alerts, drill-down and plant-TV Monitor mode support the daily TQM PDCA cycle.',
   'KPI real-time, notifikasi, drill-down, dan mode Monitor di TV pabrik untuk mendukung siklus PDCA TQM setiap hari.'],
  ['Codebase belongs to Paragon. User feedback ships in days, and adding users costs nothing.',
   'Codebase milik Paragon. Masukan pengguna bisa langsung diterapkan dalam hitungan hari, dan menambah pengguna tidak ada biaya tambahan.'],
  ['Proactive, system-driven monitoring', 'Monitoring proaktif, digerakkan oleh sistem'],
  ['Insight in hours, AI-assisted', 'Analisis dalam jam, dibantu AI'],
  ['One place for every KPI', 'Satu tempat untuk semua KPI'],
  ['Daily Management Visualization System', 'Sistem Visualisasi Manajemen Harian'],
  ['Owned platform: fast to improve, flat cost', 'Platform milik sendiri: cepat diperbarui, biaya tetap'],
  ['Passive, view-only monitoring', 'Monitoring pasif, hanya bisa lihat'],
  ['Insight takes days, not minutes', 'Analisis butuh berhari-hari, bukan menit'],
  ['KPIs scattered across self-built reports', 'KPI tersebar di berbagai laporan buatan sendiri'],
  ['No daily management system for TQM', 'Tidak ada sistem manajemen harian untuk TQM'],
  ['Locked platform: slow to change, costly to scale', 'Platform tertutup: lambat berubah, mahal untuk berkembang'],

  // ── S5W ──────────────────────────────────────────────────────────────────
  ['Section 2 — Analyze the Root Cause', 'Bagian 2 — Analisis Akar Masalah'],
  ['5 Whys: From Symptom to Root Cause', '5 Why: Dari Gejala ke Akar Masalah'],
  ['For each problem, ask "why?" until the answer is something we can change.',
   'Untuk setiap masalah, tanya "kenapa?" sampai ketemu jawaban yang bisa kita ubah.'],
  ['Why 5 = Root cause', 'Kenapa 5 = Akar masalah'],
  ['Problems are found only when someone opens Tableau',
   'Masalah baru ketahuan kalau ada yang buka Tableau'],
  ['No system watches KPIs and notifies anyone',
   'Tidak ada sistem yang memantau KPI dan memberi tahu siapapun'],
  ['Tableau renders dashboards on request — no event or push to Teams',
   'Tableau hanya tampilkan dashboard saat diminta — tidak ada event atau push ke Teams'],
  ['Tableau was chosen as a reporting tool, not an operational one',
   'Tableau dipilih sebagai alat pelaporan, bukan alat operasional'],
  ['Monitoring was designed as a report you pull, not a system that pushes',
   'Monitoring dirancang sebagai laporan yang kamu tarik, bukan sistem yang mendorong'],
  ['A report needs 3–4 days of data collection',
   'Satu laporan butuh 3–4 hari pengumpulan data'],
  ['Data is exported view by view and compiled in Excel',
   'Data diekspor satu-satu dan disusun di Excel'],
  ['Dashboards show numbers but don\'t explain them or answer questions',
   'Dashboard menampilkan angka tapi tidak menjelaskan atau menjawab pertanyaan'],
  ['No AI layer is bound to the data (Tableau Pulse is a paid add-on)',
   'Tidak ada AI yang terhubung ke data (Tableau Pulse berbayar terpisah)'],
  ['Nothing turns data into explanation — people do it by hand',
   'Tidak ada yang mengubah data menjadi penjelasan — manusia yang mengerjakannya sendiri'],
  ['Seeing the full picture takes many separate reports',
   'Untuk lihat gambaran utuh perlu banyak laporan terpisah'],
  ['The team builds its own reports from Metabase downloads',
   'Tim membuat laporan sendiri dari download Metabase'],
  ['Official dashboards don\'t give the views they need, and changes take weeks',
   'Dashboard resmi tidak memberikan tampilan yang dibutuhkan, dan perubahan butuh berminggu-minggu'],
  ['Downloading and rebuilding locally is the only fast option',
   'Download dan buat ulang secara lokal adalah satu-satunya cara yang cepat'],
  ['There is no shared KPI layer the team can use and extend',
   'Tidak ada lapisan KPI bersama yang bisa digunakan dan dikembangkan oleh tim'],
  ['The daily board is built by hand', 'Papan harian dibuat secara manual'],
  ['Available reports are static and backward-looking',
   'Laporan yang tersedia statis dan hanya melihat ke belakang'],
  ['No live per-plant view, no alerts, no screen for the daily meeting',
   'Tidak ada tampilan real-time per pabrik, tidak ada notifikasi, tidak ada layar untuk rapat harian'],
  ['The tool was built for periodic reporting, not a daily rhythm',
   'Alat ini dibuat untuk pelaporan berkala, bukan ritme harian'],
  ['No system is designed around the daily PDCA cycle',
   'Tidak ada sistem yang dirancang untuk siklus PDCA harian'],
  ['Changes take weeks and access is limited',
   'Perubahan butuh berminggu-minggu dan akses terbatas'],
  ['Only licensed Creators can build; every seat costs money',
   'Hanya Creator berlisensi yang bisa membangun; setiap kursi berbayar'],
  ['Tableau is a closed SaaS priced per seat',
   'Tableau adalah SaaS tertutup berbayar per kursi'],
  ['Paragon does not own the application layer',
   'Paragon tidak memiliki lapisan aplikasinya'],
  ['The vendor owns the app layer, so the vendor sets speed and cost',
   'Vendor yang memiliki lapisan aplikasi, jadi vendor yang menentukan kecepatan dan biaya'],
  ['Common thread: all five root causes point to the same gap — Paragon does not own an application layer built for',
   'Benang merah: kelima akar masalah menunjuk ke celah yang sama — Paragon tidak memiliki lapisan aplikasi yang dirancang untuk'],
  ['daily operations', 'operasional harian'],
  ['. Fix that once, and every problem has a place to be solved.',
   '. Perbaiki itu sekali, dan setiap masalah punya tempat untuk diselesaikan.'],

  // ── S3 ───────────────────────────────────────────────────────────────────
  ['Section 3 — Breakdown &amp; Root Cause', 'Bagian 3 — Breakdown &amp; Akar Masalah'],
  ['The 5 Gaps — Why They Existed, How They Were Fixed',
   '5 Kesenjangan — Kenapa Terjadi, Bagaimana Diperbaiki'],
  ['Root cause', 'Akar masalah'],
  ['Managers must open Tableau to find problems — no alert fires automatically',
   'Manajer harus buka Tableau untuk temukan masalah — tidak ada notifikasi yang muncul otomatis'],
  ['KPI health checked on every refresh; breaches pushed to Teams DM automatically',
   'Kesehatan KPI dicek setiap refresh; pelanggaran batas langsung dikirim ke Teams DM'],
  ['KPI data exported view by view into Excel, compiled by hand — 3–4 days per report',
   'Data KPI diekspor satu-satu ke Excel, disusun manual — 3–4 hari per laporan'],
  ['Data already combined in Snowflake; AI summary + chatbot → 3–4 hours (est.)',
   'Data sudah tergabung di Snowflake; ringkasan AI + chatbot → 3–4 jam (estimasi)'],
  ['Raw data downloaded from Metabase and rebuilt in team\'s own spreadsheet — refreshed manually',
   'Data mentah didownload dari Metabase dan dibuat ulang di spreadsheet tim — diperbarui secara manual'],
  ['Each KPI calculated once on Snowflake with one definition — one entry point, one set of filters',
   'Setiap KPI dihitung sekali di Snowflake dengan satu definisi — satu pintu masuk, satu set filter'],
  ['Daily board built by hand from static reports — no live view, no shared screen for PDCA meetings',
   'Papan harian dibuat manual dari laporan statis — tidak ada tampilan real-time, tidak ada layar bersama untuk rapat PDCA'],
  ['Live per-plant view, alerts and Monitor mode on plant TVs for the daily PDCA meeting',
   'Tampilan real-time per pabrik, notifikasi dan mode Monitor di TV pabrik untuk rapat PDCA harian'],
  ['Only licensed Creators can build; every change takes weeks;',
   'Hanya Creator berlisensi yang bisa membangun; setiap perubahan butuh berminggu-minggu;'],
  ['/year limits who gets access', '/tahun membatasi siapa yang bisa akses'],
  ['Owned codebase — changes ship in days, no per-seat cost, scale users freely',
   'Codebase milik sendiri — perubahan bisa dirilis dalam hitungan hari, tanpa biaya per kursi, tambah pengguna bebas'],

  // ── S4 ───────────────────────────────────────────────────────────────────
  ['Section 4 — Set Objective', 'Bagian 4 — Tetapkan Tujuan'],
  ['What This Project Must Achieve', 'Yang Harus Dicapai Proyek Ini'],
  ['Replace Tableau with a fully owned web application',
   'Ganti Tableau dengan aplikasi web yang sepenuhnya milik sendiri'],
  ['Build a Next.js web application on top of existing Snowflake and Azure AD infrastructure — eliminating vendor dependency while maintaining enterprise-grade security.',
   'Bangun aplikasi web Next.js di atas infrastruktur Snowflake dan Azure AD yang sudah ada — menghilangkan ketergantungan pada vendor sambil tetap menjaga keamanan level enterprise.'],
  ['Production-deployed, accessible to all team members via Azure AD SSO',
   'Sudah berjalan di production, bisa diakses semua anggota tim via Azure AD SSO'],
  ['Must reuse existing Snowflake data warehouse — no duplicate data pipeline',
   'Harus menggunakan Snowflake data warehouse yang sudah ada — tidak boleh duplikasi pipeline data'],
  ['One place for every KPI, built for daily management',
   'Satu tempat untuk semua KPI, dirancang untuk manajemen harian'],
  ['Every KPI (Lead Time, Output, Productivity, OEE, Yield Loss…) in one place, pulled live from Snowflake and filtered by plant and period — a daily visual system for the TQM PDCA cycle.',
   'Semua KPI (Lead Time, Output, Produktivitas, OEE, Yield Loss…) di satu tempat, langsung dari Snowflake, bisa difilter per pabrik dan periode — sistem visual harian untuk siklus PDCA TQM.'],
  ['All KPIs on one screen; Strategic + Tactical views and Monitor mode for the daily meeting',
   'Semua KPI di satu layar; tampilan Strategic + Tactical dan mode Monitor untuk rapat harian'],
  ['Snowflake auto-suspend requires graceful timeout handling (60s)',
   'Auto-suspend Snowflake memerlukan penanganan timeout yang baik (60 detik)'],
  ['Proactive alert delivery to Microsoft Teams', 'Pengiriman notifikasi proaktif ke Microsoft Teams'],
  ['When a KPI breaches its warning or critical threshold, the system sends a direct message to the relevant recipient in Teams — without requiring anyone to open the dashboard.',
   'Ketika KPI melewati batas peringatan atau kritis, sistem langsung kirim pesan ke penerima yang tepat di Teams — tanpa harus ada yang buka dashboard terlebih dahulu.'],
  ['All relevant recipients receive the right alert for their plant and KPI',
   'Semua penerima yang relevan mendapatkan notifikasi yang sesuai untuk pabrik dan KPI mereka'],
  ['Graph API token must be refreshed alongside NextAuth.js JWT rotation',
   'Token Graph API harus diperbarui bersama rotasi JWT NextAuth.js'],
  ['O1', 'T1'],
  ['O2', 'T2'],
  ['O3', 'T3'],
  ['Target', 'Target'],
  ['Constraint', 'Batasan'],

  // ── S6 ───────────────────────────────────────────────────────────────────
  ['Section 5 — Develop Improvement Project', 'Bagian 5 — Kembangkan Proyek Perbaikan'],
  ['What Was Built', 'Yang Dibangun'],
  ['Strategic (6 KPI cards) / Tactical (lead time per stage vs standard) · KPI trend charts with SPC control limits · Filter by plant &amp; period · Warning/Critical badges',
   'Strategic (6 kartu KPI) / Tactical (lead time per tahap vs standar) · Grafik tren KPI dengan batas kontrol SPC · Filter per pabrik &amp; periode · Badge Warning/Critical'],
  ['3-sentence auto summary · AI Risks panel · Chatbot with SQL tool-use · DeepSeek + Groq routing · KPI card highlighting',
   'Ringkasan 3 kalimat otomatis · Panel AI Risks · Chatbot dengan SQL tool-use · Routing DeepSeek + Groq · Highlight kartu KPI'],
  ['Computed on every refresh · Configurable thresholds · Dedup · 5-sec undo dismiss',
   'Dihitung setiap refresh · Batas bisa dikonfigurasi · Dedup · 5 detik untuk batalkan dismiss'],
  ['Direct DM via Graph API · Per-recipient, per-KPI · Fallback to webhook · Test connectivity',
   'DM langsung via Graph API · Per-penerima, per-KPI · Fallback ke webhook · Tes konektivitas'],
  ['Dedicated deep-dive: trend per stage, SKU scatter, Pareto (VA/NNVA/Waste), Top 10 SKU, distribution histogram, plant breakdown table',
   'Analisis mendalam khusus: tren per tahap, scatter SKU, Pareto (VA/NNVA/Waste), 10 SKU teratas, histogram distribusi, tabel breakdown per pabrik'],
  ['6 sections, 3 admin-gated · Server-sync Teams settings · Email via Resend · Azure AD roles',
   '6 bagian, 3 dibatasi admin · Sinkronisasi pengaturan Teams via server · Email via Resend · Role Azure AD'],
  ['Real-Time KPI Dashboard', 'Dashboard KPI Real-Time'],
  ['AI Intelligence', 'Kecerdasan AI'],
  ['Alert System', 'Sistem Notifikasi'],
  ['Teams Integration', 'Integrasi Teams'],
  ['Lead Time Analysis Page', 'Halaman Analisis Lead Time'],
  ['Settings &amp; Admin', 'Pengaturan &amp; Admin'],

  // ── S6R ──────────────────────────────────────────────────────────────────
  ['PO Lead Time Risk Score', 'Risk Score Lead Time PO'],
  ['What risk factors cause a PO to run late?', 'Faktor risiko apa yang membuat PO terlambat?'],

  // ── S6M ──────────────────────────────────────────────────────────────────
  ['How the Risk Score Is Calculated', 'Cara Menghitung Risk Score'],
  ['Starting point (day-4 baseline)', 'Titik awal (baseline hari ke-4)'],
  ['Component · what the data showed', 'Komponen · apa yang ditunjukkan data'],

  // ── S6b ──────────────────────────────────────────────────────────────────
  ['How the System Flags At-Risk POs', 'Bagaimana Sistem Mendeteksi PO Berisiko'],

  // ── S7R ──────────────────────────────────────────────────────────────────
  ['Section 6 — Result: Lead Time Risk Score', 'Bagian 6 — Hasil: Risk Score Lead Time'],
  ['Late POs Flagged Before They Are Late', 'PO Terlambat Terdeteksi Sebelum Benar-Benar Terlambat'],
  ['Backtest: trained on 12,601 POs released Jan–Jun 2026, tested on',
   'Backtest: dilatih pada 12.601 PO yang dirilis Jan–Jun 2026, diuji pada'],
  ['5,228 POs released 1 Jul – 9 Sep', '5.228 PO yang dirilis 1 Jul – 9 Sep'],
  ['that the model never saw.', 'yang belum pernah dilihat model.'],
  ['of late POs flagged in advance', 'PO terlambat terdeteksi lebih awal'],
  ['480 of 657 late POs reached ≥ 50% risk by day 8 · 326 already by day 4',
   '480 dari 657 PO terlambat mencapai risiko ≥ 50% sebelum hari ke-8 · 326 sudah dari hari ke-4'],
  ['average warning before breach', 'rata-rata peringatan sebelum batas terlewat'],
  ['time left to act before the PO passes 13 days after release',
   'waktu yang tersisa untuk bertindak sebelum PO melewati 13 hari sejak rilis'],
  ['Model accuracy on unseen POs', 'Akurasi model pada PO baru'],
  ['If you picked two POs at random — one late, one on-time — the model ranks the late one higher 82% of the time. 0.50 = random.',
   'Kalau kamu pilih dua PO secara acak — satu yang terlambat, satu yang tepat waktu — model mengurutkan yang terlambat lebih tinggi 82% dari waktu. 0,50 = acak.'],
  ['of High-risk flags are right', 'flag High-risk terbukti benar'],
  ['precision at Risk ≥ 70 · 13% of on-time POs raised a ≥ 50% flag at least once',
   'presisi pada Risiko ≥ 70 · 13% PO tepat waktu pernah dapat flag ≥ 50% setidaknya sekali'],
  ['Finding along the way', 'Temuan di Tengah Jalan'],
  ['Measured from', 'Diukur dari'],
  ['(the basis of the 13-day target), September lead time is',
   '(dasar target 13 hari), lead time September adalah'],
  ['and', 'dan'],
  ['of POs exceed 13 days. Measured from PO Created it is',
   'PO melewati 13 hari. Diukur dari PO Created adalah'],
  ['the extra', 'selisih'],
  ['days is Created → Released, an administration phase outside manufacturing.',
   'hari adalah Created → Released, fase administrasi di luar manufaktur.'],
  ['Limits &amp; next step', 'Keterbatasan &amp; langkah berikutnya'],
  ['Offline backtest — in-app list, AI narration and Teams alert are next. PO Released timestamp is a working hypothesis pending confirmation. POs still open at the data cut are excluded. Late rate fell from 24% to 13% between periods, so mid-range probabilities run high → recalibrate monthly.',
   'Backtest offline — daftar di aplikasi, narasi AI, dan notifikasi Teams menjadi langkah berikutnya. Timestamp PO Released masih hipotesis yang perlu dikonfirmasi. PO yang masih berjalan saat data dipotong tidak termasuk. Tingkat keterlambatan turun dari 24% ke 13% antar periode, sehingga probabilitas rentang menengah cenderung tinggi → perlu kalibrasi ulang bulanan.'],

  // ── S7A ──────────────────────────────────────────────────────────────────
  ['Section 6 — Result: Cost', 'Bagian 6 — Hasil: Perbandingan Biaya'],
  ['Cost: Tableau vs Web App', 'Biaya: Tableau vs Web App'],
  ['Net saving:', 'Penghematan bersih:'],
  ['Net annual saving vs Tableau Plus contract:', 'Penghematan tahunan vs kontrak Tableau Plus:'],
  ['AI API usage only: 300 users × 5 questions/workday, DeepSeek peak rates',
   'Hanya biaya pemakaian AI API: 300 pengguna × 5 pertanyaan/hari kerja, tarif puncak DeepSeek'],
  ['Snowflake and Azure AD: existing infrastructure', 'Snowflake dan Azure AD: infrastruktur yang sudah ada'],
  ['No per-seat cost — add users freely', 'Tanpa biaya per kursi — tambah pengguna bebas'],
  ['AI, alerts and Teams included', 'AI, notifikasi, dan Teams sudah termasuk'],

  // ── S7 ───────────────────────────────────────────────────────────────────
  ['Section 6 — Result of The Improvement', 'Bagian 6 — Hasil Perbaikan'],
  ['What Changed After the Project', 'Yang Berubah Setelah Proyek'],
  ['Before — Tableau', 'Sebelum — Tableau'],
  ['After — This App', 'Sesudah — Aplikasi Ini'],
  ['Manual check in Tableau. No scheduled refresh, no push.',
   'Cek manual di Tableau. Tidak ada refresh terjadwal, tidak ada push.'],
  ['Overview (Strategic + Tactical), Lead Time page and Monitor live from Snowflake. Filter by plant and period.',
   'Overview (Strategic + Tactical), halaman Lead Time, dan Monitor langsung dari Snowflake. Filter per pabrik dan periode.'],
  ['None. Problems found when someone happens to look.',
   'Tidak ada. Masalah baru ketahuan kalau ada yang kebetulan buka.'],
  ['Auto alert to Teams DM on threshold breach. Per-user, per-KPI. Deduplicated.',
   'Notifikasi otomatis ke Teams DM saat batas terlampaui. Per pengguna, per KPI. Terdeduplikasi.'],
  ['None. Managers read raw charts and draw their own conclusions.',
   'Tidak ada. Manajer membaca grafik mentah dan menarik kesimpulan sendiri.'],
  ['3-sentence AI summary every session. Chatbot queries Snowflake directly.',
   'Ringkasan AI 3 kalimat setiap sesi. Chatbot langsung query Snowflake.'],
  ['3–4 days per report: export view by view, compile in Excel, write the summary by hand.',
   '3–4 hari per laporan: ekspor satu-satu, susun di Excel, tulis ringkasan secara manual.'],
  ['~3–4 hours (estimate): data already combined, AI summary and chatbot answer follow-up questions.',
   '~3–4 jam (estimasi): data sudah tergabung, ringkasan AI dan chatbot menjawab pertanyaan lanjutan.'],
  ['Each KPI rebuilt in self-made reports from Metabase downloads — manual refresh, formulas per report.',
   'Setiap KPI dibuat ulang di laporan buatan sendiri dari download Metabase — refresh manual, rumus per laporan.'],
  ['One control tower: every KPI calculated once on Snowflake with one definition — one entry point, one set of filters.',
   'Satu control tower: setiap KPI dihitung sekali di Snowflake dengan satu definisi — satu pintu masuk, satu set filter.'],
  ['Daily board built manually from static reports.',
   'Papan harian dibuat manual dari laporan statis.'],
  ['Live daily visual system: alerts, drill-down, Monitor mode on plant TVs.',
   'Sistem visual harian real-time: notifikasi, drill-down, mode Monitor di TV pabrik.'],
  ['A PO shows as late only after it is late.',
   'PO baru terlihat terlambat setelah sudah benar-benar terlambat.'],
  ['Lead Time Risk Score flags 73% of late POs ~9 days before the 13-day breach (backtest).',
   'Risk Score Lead Time mendeteksi 73% PO terlambat ~9 hari sebelum melewati batas 13 hari (backtest).'],
  ['Weeks per change, Creator-only. No custom logic or integrations.',
   'Berminggu-minggu per perubahan, hanya Creator. Tidak ada logika custom atau integrasi.'],
  ['Days per change. Owned codebase — continuous improvement on our own timeline.',
   'Hitungan hari per perubahan. Codebase milik sendiri — perbaikan berkelanjutan sesuai jadwal kita.'],
  ['Restricted by license cost. Limited seats.', 'Dibatasi oleh biaya lisensi. Kursi terbatas.'],
  ['Azure AD SSO. No per-seat cost. Scale users freely.',
   'Azure AD SSO. Tanpa biaya per kursi. Tambah pengguna bebas.'],
  ['Net annual saving vs Tableau Plus contract', 'Penghematan tahunan vs kontrak Tableau Plus'],
  ['Tableau vs ~', 'Tableau vs ~'],
  ['estimated AI cost for 300 users. AI + Teams integration included, not as add-ons.',
   'estimasi biaya AI untuk 300 pengguna. AI + integrasi Teams sudah termasuk, bukan tambahan.'],

  // ── S8 ───────────────────────────────────────────────────────────────────
  ['Section 7 — Challenges', 'Bagian 7 — Tantangan dalam Pembangunan'],
  ['What Was Difficult to Build', 'Yang Sulit Dibangun'],
  ['Snowflake warehouses auto-suspend after inactivity. When the dashboard first loads, the warehouse may be suspended — causing a 30–60 second wait before the first query responds. This looked like the app was broken.',
   'Snowflake warehouse otomatis berhenti setelah tidak aktif. Saat dashboard pertama kali dibuka, warehouse mungkin sudah suspend — menyebabkan tunggu 30–60 detik sebelum query pertama bisa berjalan. Ini terlihat seperti aplikasi rusak.'],
  ['Implemented a 60-second timeout with a user-facing skeleton loading state. The KPI fetch waits gracefully and shows an animated placeholder while the warehouse wakes up.',
   'Menerapkan timeout 60 detik dengan tampilan skeleton loading yang terlihat pengguna. Pengambilan KPI menunggu dengan baik dan menampilkan placeholder animasi sementara warehouse menyala kembali.'],
  ['⚠ This is a known UX friction point — first load after inactivity is noticeably slow.',
   '⚠ Ini adalah titik gesekan UX yang diketahui — loading pertama setelah tidak aktif memang terasa lambat.'],
  ['All queries are written in Snowflake SQL. When running on ClickHouse, a translator',
   'Semua query ditulis dalam Snowflake SQL. Saat dijalankan di ClickHouse, sebuah translator'],
  ['converts syntax on the fly — but gaps in the rules cause queries to silently return 0 rows instead of throwing an error, making the bug look like missing data rather than a broken query.',
   'mengonversi sintaks secara langsung — tapi celah dalam aturannya menyebabkan query diam-diam mengembalikan 0 baris tanpa error, sehingga bug terlihat seperti data hilang bukan query yang rusak.'],
  ['Incrementally extended the translator:',
   'Secara bertahap memperluas translator:'],
  ['null handling, alias collision fixes, identifier case. A check script',
   'penanganan null, perbaikan tabrakan alias, kapitalisasi identifier. Script pengecekan'],
  ['now validates every query after changes.', 'sekarang memvalidasi setiap query setelah ada perubahan.'],
  ['⚠ Every new query pattern requires a new translator rule — silent 0-return bugs can still appear when a new SQL construct is introduced.',
   '⚠ Setiap pola query baru memerlukan aturan translator baru — bug yang diam-diam mengembalikan 0 masih bisa muncul saat ada konstruksi SQL baru yang diperkenalkan.'],
  ['Sending Teams DMs via Graph API requires specific OAuth scopes and a delegated token tied to the logged-in user. Setting up the correct permission chain without requiring tenant-level admin consent required significant trial and error.',
   'Mengirim DM Teams via Graph API memerlukan OAuth scope tertentu dan token yang terikat ke pengguna yang login. Menyiapkan rantai izin yang benar tanpa perlu persetujuan admin level tenant butuh banyak percobaan.'],
  ['Used delegated permissions (Chat.Create + ChatMessage.Send) that work with standard user consent. Implemented token refresh alongside NextAuth.js JWT rotation to keep Teams access active.',
   'Menggunakan delegated permissions (Chat.Create + ChatMessage.Send) yang bekerja dengan persetujuan pengguna standar. Menerapkan pembaruan token bersama rotasi JWT NextAuth.js untuk menjaga akses Teams tetap aktif.'],
  ['⚠ Token expiry edge cases still possible on very long sessions without activity.',
   '⚠ Edge case kedaluwarsa token masih mungkin terjadi pada sesi yang sangat panjang tanpa aktivitas.'],
  ['The Lead Time page started as static mock data. The source has no due-date column and only 3 stages (TIMBANG, OLAH, CUCI OLAH) have usable standard times, so "on-time" and "vs standard" had to be defined from what the data really holds.',
   'Halaman Lead Time awalnya dimulai dengan data mock statis. Sumbernya tidak punya kolom due-date dan hanya 3 tahap (TIMBANG, OLAH, CUCI OLAH) yang punya standar waktu yang bisa dipakai, jadi "tepat waktu" dan "vs standar" harus didefinisikan dari apa yang sebenarnya ada di data.'],
  ['Done for the Strategic view: KPI cards (VA / NNVA / Waste / Potential Saving), weekly trend per stage, SKU scatter, stage Pareto and Top 10 SKU all run on Snowflake. On-time = gross lead time ≤ 13 days. Overview Tactical adds stage vs standard and a per-plant breakdown.',
   'Selesai untuk tampilan Strategic: kartu KPI (VA / NNVA / Waste / Potensi Penghematan), tren mingguan per tahap, scatter SKU, Pareto tahap, dan 10 SKU teratas semuanya berjalan di Snowflake. Tepat waktu = gross lead time ≤ 13 hari. Overview Tactical menambahkan perbandingan tahap vs standar dan breakdown per pabrik.'],
  ['✓ Lead Time now runs on real Snowflake data.', '✓ Lead Time sekarang berjalan dengan data Snowflake nyata.'],
  ['Wiring Lead Time to Live Data', 'Menghubungkan Lead Time ke Data Nyata'],

  // ── S8T ──────────────────────────────────────────────────────────────────
  ['Project Timeline · Aug – Dec 2026', 'Timeline Proyek · Agt – Des 2026'],
  ['Project Timeline: 5 Months', 'Timeline Proyek: 5 Bulan'],
  ['We are here · Oct 13', 'Posisi kita · 13 Okt'],
  ['Snowflake data, Azure AD sign-in, Overview KPI cards',
   'Data Snowflake, login Azure AD, kartu KPI Overview'],
  ['AI Summary, chat, Teams alerts', 'Ringkasan AI, chat, notifikasi Teams'],
  ['Lead Time analysis on real Snowflake data', 'Analisis Lead Time dengan data Snowflake nyata'],
  ['Model keeps evolving as new business cases come in',
   'Model terus berkembang seiring datangnya kasus bisnis baru'],
  ['Factory Leaders invited · Lead Time, Output, Productivity live · OEE soon',
   'Factory Leaders diundang · Lead Time, Output, Produktivitas sudah live · OEE segera'],
  ['OEE table first, then OPE, Yield/Loss, RFT, Energy',
   'Tabel OEE dulu, lalu OPE, Yield/Loss, RFT, Energi'],
  ['UAT with plant managers, project complete', 'UAT dengan plant manager, proyek selesai'],
  ['Foundation', 'Pondasi'],
  ['AI &amp; Teams alerts', 'AI &amp; Notifikasi Teams'],
  ['Lead Time page', 'Halaman Lead Time'],
  ['Go-live phase 1', 'Go-live Fase 1'],
  ['OEE &amp; remaining KPIs', 'OEE &amp; KPI Lainnya'],
  ['UAT &amp; full rollout', 'UAT &amp; Rollout Penuh'],
  ['Mid Aug – Aug 31', 'Pertengahan Agt – 31 Agt'],
  ['Aug 31 – Sep 14', '31 Agt – 14 Sep'],
  ['Sep 16 – Oct 13', '16 Sep – 13 Okt'],
  ['Oct 4 – Dec · ongoing', '4 Okt – Des · sedang berjalan'],
  ['Oct 13 – 31', '13–31 Okt'],
  ['Late Oct – Nov', 'Akhir Okt – Nov'],
  ['Target: project complete by December 2026', 'Target: proyek selesai Desember 2026'],
  ['Done', 'Selesai'],
  ['In progress', 'Sedang berjalan'],
  ['Planned', 'Direncanakan'],

  // ── S9 ───────────────────────────────────────────────────────────────────
  ['Section 8 — What to Be Improved Later', 'Bagian 8 — Yang Akan Ditingkatkan'],
  ['Planned Next Steps &amp; Future Capabilities', 'Langkah Selanjutnya &amp; Kapabilitas Masa Depan'],
  ['Add a background cron job that checks KPI values on a schedule (e.g. every morning). Sends Teams DMs automatically — even if no one has opened the dashboard.',
   'Tambahkan cron job yang mengecek nilai KPI secara terjadwal (misal setiap pagi). Kirim Teams DM secara otomatis — meskipun tidak ada yang membuka dashboard.'],
  ['↳ Threshold system + Teams Graph API already live',
   '↳ Sistem threshold + Teams Graph API sudah berjalan'],
  ['Schedule a daily AI summary — yesterday\'s performance, anomalies, what needs attention — delivered to manager Teams DMs each morning.',
   'Jadwalkan ringkasan AI harian — performa kemarin, anomali, apa yang perlu diperhatikan — dikirim ke Teams DM manajer setiap pagi.'],
  ['↳ AI summary endpoint + Teams integration already live',
   '↳ Endpoint ringkasan AI + integrasi Teams sudah berjalan'],
  ['Create dedicated pages per plant at /dashboard/plant/[id] showing every KPI in a focused view. Enables per-plant investigation without global filtering.',
   'Buat halaman khusus per pabrik di /dashboard/plant/[id] yang menampilkan semua KPI dalam tampilan terfokus. Memungkinkan investigasi per pabrik tanpa perlu filter global.'],
  ['↳ Next.js dynamic routes + Snowflake per-plant queries already in place',
   '↳ Dynamic routes Next.js + query Snowflake per pabrik sudah tersedia'],
  ['Create a task directly from an alert — assign owner, set deadline, log root cause. Track resolution: Open → In Progress → Resolved.',
   'Buat tugas langsung dari notifikasi — tetapkan pemilik, atur deadline, catat akar masalah. Lacak penyelesaian: Terbuka → Sedang Dikerjakan → Selesai.'],
  ['↳ Modal components + API layer + Azure AD identity already live',
   '↳ Komponen modal + lapisan API + identitas Azure AD sudah berjalan'],
  ['Extend beyond binary admin/non-admin: Viewer / Analyst / Manager / Admin. Per-role default views and alert scopes.',
   'Perluas dari binary admin/non-admin: Viewer / Analyst / Manager / Admin. Tampilan default dan cakupan notifikasi per role.'],
  ['↳ Azure AD identity + admin flag system already in place',
   '↳ Identitas Azure AD + sistem flag admin sudah tersedia'],
  ['"Why did OEE drop?" → AI queries OEE, pack loss, lead time, productivity in parallel, identifies the dimension that changed, and explains the connection.',
   '"Kenapa OEE turun?" → AI query OEE, pack loss, lead time, produktivitas secara paralel, mengidentifikasi dimensi yang berubah, dan menjelaskan keterkaitannya.'],
  ['↳ Tool-use chatbot + multi-KPI Snowflake query pattern already live',
   '↳ Chatbot tool-use + pola query Snowflake multi-KPI sudah berjalan'],
  ['Forecast when a metric is likely to breach its threshold — alerting before the problem fully materializes rather than reacting after the fact.',
   'Prediksi kapan suatu metrik kemungkinan akan melewati batas — memberi peringatan sebelum masalah sepenuhnya terjadi, bukan bereaksi setelahnya.'],
  ['↳ Requires historical data accumulation + ML pipeline',
   '↳ Membutuhkan akumulasi data historis + pipeline ML'],
  ['Nothing in Short or Medium Term requires rebuilding existing architecture. All planned improvements are additive — built on top of what is already live and running.',
   'Tidak ada yang perlu membangun ulang arsitektur yang ada untuk jangka pendek maupun menengah. Semua peningkatan bersifat tambahan — dibangun di atas apa yang sudah berjalan.'],
  ['Proactive Scheduled Alerts', 'Notifikasi Terjadwal Proaktif'],
  ['Daily AI Digest to Teams', 'Ringkasan AI Harian ke Teams'],
  ['Plant-Level Drill-Down Pages', 'Halaman Drill-Down Per Pabrik'],
  ['Action &amp; Task Tracking from Alerts', 'Pelacakan Tindakan &amp; Tugas dari Notifikasi'],
  ['Multi-Tier Role-Based Access', 'Akses Berbasis Role Multi-Tingkat'],
  ['Root-Cause AI Investigation', 'Investigasi Akar Masalah oleh AI'],
  ['Predictive Alerts &amp; Pattern Recognition', 'Notifikasi Prediktif &amp; Pengenalan Pola'],
  ['Short Term', 'Jangka Pendek'],
  ['Medium Term', 'Jangka Menengah'],
  ['Long Term', 'Jangka Panjang'],
  ['Low effort', 'Upaya rendah'],
  ['Medium effort', 'Upaya menengah'],
  ['High effort', 'Upaya tinggi'],

  // ── S9L ──────────────────────────────────────────────────────────────────
  ['Section 9 — Learning Activities', 'Bagian 9 — Pembelajaran'],
  ['What I Learned', 'Yang Saya Pelajari'],
  ['Business Acumen', 'Pemahaman Bisnis'],
  ['Developed an end-to-end understanding of business processes',
   'Membangun pemahaman menyeluruh tentang proses bisnis dari awal hingga akhir'],
  ['Understood the production flow', 'Memahami alur produksi'],
  ['Continuously deepened business knowledge', 'Terus memperdalam pengetahuan bisnis'],
  ['Technical Skill', 'Keterampilan Teknis'],
  ['SQL for more complex data structures', 'SQL untuk struktur data yang lebih kompleks'],
  ['Tableau &amp; Metabase for dashboard design', 'Tableau &amp; Metabase untuk desain dashboard'],
  ['AI exploration and web dashboard development via Vercel',
   'Eksplorasi AI dan pengembangan dashboard web via Vercel'],
  ['Stakeholder management', 'Manajemen stakeholder'],
  ['Communication &amp; data storytelling', 'Komunikasi &amp; data storytelling'],
  ['Learned to navigate challenges, adapt to changing requirements, and continuously improve through feedback and experience',
   'Belajar menghadapi tantangan, beradaptasi dengan perubahan kebutuhan, dan terus berkembang lewat umpan balik dan pengalaman'],

  // ── S9DA / S9DB ──────────────────────────────────────────────────────────
  ['Daily Project — Work Output', 'Proyek Harian — Hasil Kerja'],
  ['Control Tower &amp; Lead Time Analysis', 'Control Tower &amp; Analisis Lead Time'],
  ['Dashboards and analytical outputs built to give plant managers real-time visibility into lead time performance.',
   'Dashboard dan output analitik yang dibangun untuk memberi manajer pabrik visibilitas real-time terhadap performa lead time.'],
  ['Operational Reports &amp; Incentive Tables', 'Laporan Operasional &amp; Tabel Insentif'],
  ['Structured reports consumed by operations and HR — translating lead time data into performance tracking and incentive calculations.',
   'Laporan terstruktur yang digunakan oleh operasional dan HR — mengubah data lead time menjadi pelacakan performa dan perhitungan insentif.'],

  // ── S9P ──────────────────────────────────────────────────────────────────
  ['Section 10 — Development Plans', 'Bagian 10 — Rencana Pengembangan Diri'],
  ['Where I Want to Grow Next', 'Ke Mana Saya Ingin Berkembang'],
  ['Go deeper into predictive modeling — from logistic regression to models that forecast KPI risk',
   'Mendalami pemodelan prediktif — dari regresi logistik hingga model yang memprediksi risiko KPI'],
  ['Use AI to build and explain models, not only to summarize dashboards',
   'Menggunakan AI untuk membangun dan menjelaskan model, bukan hanya merangkum dashboard'],
  ['Deploy, track and retrain models in production so predictions stay accurate over time',
   'Men-deploy, memantau, dan melatih ulang model di production agar prediksi tetap akurat dari waktu ke waktu'],
  ['Work closer with manufacturing, planning and IT to turn insights into agreed actions',
   'Bekerja lebih dekat dengan manufaktur, perencanaan, dan IT untuk mengubah insight menjadi tindakan yang disepakati'],
  ['Turn numbers into clear narratives that help leaders decide faster',
   'Mengubah angka menjadi narasi yang jelas agar pemimpin bisa memutuskan lebih cepat'],
  ['AI Beyond Reporting', 'AI Melampaui Pelaporan'],
  ['Cross-Functional Partnership', 'Kolaborasi Lintas Fungsi'],

  // ── S10 ──────────────────────────────────────────────────────────────────
  ['Real-time data. Proactive alerts. AI interpretation. Owned infrastructure.<br>\n    Built to grow — without rebuilding.',
   'Data real-time. Notifikasi proaktif. Interpretasi AI. Infrastruktur milik sendiri.<br>\n    Dibangun untuk berkembang — tanpa harus dibangun ulang.'],
  ['saved per year', 'dihemat per tahun'],
  ['reduction in data compilation time (est.)', 'pengurangan waktu kompilasi data (estimasi)'],
  ['of late POs detected in advance', 'PO terlambat terdeteksi lebih awal'],
  ['from Tableau', 'dari Tableau'],
  ['a system that thinks', 'sistem yang berpikir'],
];

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Build Indonesian HTML in memory
  console.log('Building Indonesian HTML…');
  let html = fs.readFileSync(HTML_FILE, 'utf8');

  // Sort by descending length so longer strings match before shorter substrings
  const sorted = [...TRANSLATIONS].sort((a, b) => b[0].length - a[0].length);
  for (const [en, id] of sorted) {
    html = html.split(en).join(id);
  }

  // Write temp file
  const tmpFile = path.join(ROOT, 'public', '_presentation-id-tmp.html');
  fs.writeFileSync(tmpFile, html, 'utf8');

  console.log('Launching Chromium…');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });

  const fileUrl = url.pathToFileURL(tmpFile).href;
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Switch to IDR
  await page.evaluate(() => { (window as any).toggleCur(); });

  await page.addStyleTag({ content: `
    .W { max-width: none !important; }
    .slide { padding: 36px 56px !important; }
    #nav, #badge, #cur-btn, #hint { display: none !important; }
  ` });

  const screenshots: Buffer[] = [];
  for (const id of SLIDE_IDS) {
    console.log(`  Capturing ${id}…`);
    await page.evaluate((slideId) => {
      document.querySelectorAll('*').forEach(el => {
        (el as HTMLElement).style.transition = 'none';
        (el as HTMLElement).style.animation = 'none';
      });
      ['nav','badge','cur-btn','hint'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.cssText += ';display:none !important;';
      });
      document.querySelectorAll('.slide').forEach(el => {
        (el as HTMLElement).style.cssText =
          'display:none !important;opacity:0 !important;transition:none !important;';
      });
      const target = document.getElementById(slideId);
      if (target) {
        (target as HTMLElement).style.cssText =
          'display:flex !important;opacity:1 !important;transform:none !important;transition:none !important;pointer-events:auto !important;';
      }
    }, id);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    await page.waitForTimeout(80);
    screenshots.push(await page.screenshot({ type: 'png', fullPage: false }));
  }

  await browser.close();
  fs.unlinkSync(tmpFile);
  console.log(`\nAll ${screenshots.length} slides captured.`);

  // Build PDF
  console.log('\nBuilding PDF…');
  const pdfDoc = await PDFDocument.create();
  const ptW = 960, ptH = 540;
  for (const buf of screenshots) {
    const img = await pdfDoc.embedPng(buf);
    const pg = pdfDoc.addPage([ptW, ptH]);
    pg.drawImage(img, { x: 0, y: 0, width: ptW, height: ptH });
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(OUT_PDF, pdfBytes);
  console.log(`PDF → ${OUT_PDF}`);
  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
