"use client";

import { useState } from "react";

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="text-[10px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-colors"
    >
      {copied ? "copied!" : "copy"}
    </button>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  id,
  title,
  badge,
  badgeColor = "indigo",
  children,
}: {
  id: string;
  title: string;
  badge?: string;
  badgeColor?: "indigo" | "sky" | "emerald" | "amber" | "rose" | "violet" | "teal";
  children: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-100 text-indigo-700",
    sky:    "bg-sky-100 text-sky-700",
    emerald:"bg-emerald-100 text-emerald-700",
    amber:  "bg-amber-100 text-amber-700",
    rose:   "bg-rose-100 text-rose-700",
    violet: "bg-violet-100 text-violet-700",
    teal:   "bg-teal-100 text-teal-700",
  };
  const border: Record<string, string> = {
    indigo: "border-indigo-300",
    sky:    "border-sky-300",
    emerald:"border-emerald-300",
    amber:  "border-amber-300",
    rose:   "border-rose-300",
    violet: "border-violet-300",
    teal:   "border-teal-300",
  };
  return (
    <section id={id} className="scroll-mt-8">
      <div className={`flex items-center gap-3 mb-4 pb-3 border-b-2 ${border[badgeColor]}`}>
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
        {badge && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[badgeColor]}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

// ─── Sub-metric block ─────────────────────────────────────────────────────────
function Metric({
  name,
  table,
  dateCol,
  formula,
  note,
  sql,
}: {
  name: string;
  table: string | string[];
  dateCol: string | string[];
  formula: string;
  note?: string;
  sql: string;
}) {
  const tables = Array.isArray(table) ? table : [table];
  const cols   = Array.isArray(dateCol) ? dateCol : [dateCol];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* header */}
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-semibold text-slate-700 text-sm">{name}</h3>
      </div>

      {/* meta grid */}
      <div className="grid grid-cols-3 gap-px bg-slate-100 border-b border-slate-100">
        <div className="bg-white px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Source table</p>
          {tables.map((t) => (
            <code key={t} className="block text-xs font-mono text-slate-700">{t}</code>
          ))}
        </div>
        <div className="bg-white px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Date filter column</p>
          {cols.map((c) => (
            <code key={c} className="block text-xs font-mono text-indigo-600">{c}</code>
          ))}
        </div>
        <div className="bg-white px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Formula</p>
          <p className="text-xs text-slate-700 leading-relaxed">{formula}</p>
        </div>
      </div>

      {/* note */}
      {note && (
        <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
          {note}
        </div>
      )}

      {/* sql */}
      <div className="relative">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-800">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">SQL</span>
          <CopyBtn text={sql.trim()} />
        </div>
        <pre className="bg-slate-900 text-slate-200 text-[11px] font-mono leading-relaxed px-5 py-4 overflow-x-auto whitespace-pre">
          {sql.trim()}
        </pre>
      </div>
    </div>
  );
}

// ─── TOC link ─────────────────────────────────────────────────────────────────
function TocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="block text-sm text-slate-500 hover:text-indigo-600 hover:translate-x-0.5 transition-all py-0.5"
    >
      {children}
    </a>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function QueryDocsPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* top bar */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-30">
        <div>
          <h1 className="text-base font-bold text-slate-800">Query Reference</h1>
          <p className="text-xs text-slate-400">Control Tower Manufacturing — single source of truth untuk semua logic KPI</p>
        </div>
        <span className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-medium border border-indigo-100">
          lib/queries.ts
        </span>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-10 flex gap-10">

        {/* ── Sidebar TOC ── */}
        <aside className="w-52 shrink-0">
          <div className="sticky top-20 space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Filter Global</p>
              <TocLink href="#period-filter">Period Filter Logic</TocLink>
              <TocLink href="#plant-filter">Plant Filter</TocLink>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">KPI Cards</p>
              <TocLink href="#lead-time">Lead Time</TocLink>
              <TocLink href="#rft">Right First Time</TocLink>
              <TocLink href="#yield">Yield / Loss</TocLink>
              <TocLink href="#output">Output</TocLink>
              <TocLink href="#oee">OEE</TocLink>
              <TocLink href="#productivity">Productivity</TocLink>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Sparklines</p>
              <TocLink href="#sparklines">OEE Weekly & E2E Weekly</TocLink>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 space-y-12">

          {/* ══ PERIOD FILTER ══════════════════════════════════════════════════ */}
          <Section id="period-filter" title="Period Filter Logic" badge="Global — semua query pakai ini" badgeColor="indigo">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                <h3 className="font-semibold text-slate-700 text-sm">periodDateWhere(col, period, startDate, endDate)</h3>
              </div>
              <div className="px-5 py-4 text-sm text-slate-600 leading-relaxed space-y-3">
                <p>
                  Setiap query pakai fungsi ini buat ngasilin WHERE clause untuk kolom tanggal.
                  Semua periode pakai <code className="bg-slate-100 px-1 rounded text-indigo-700">CURRENT_DATE()</code> dari Snowflake server
                  supaya tidak ada timezone drift dari browser.
                </p>
                <p>Custom date range (pilih manual dari date picker) pakai parameterized bind <code className="bg-slate-100 px-1 rounded text-indigo-700">?::DATE</code>.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-500 uppercase text-[10px] tracking-wider">
                      <th className="text-left px-5 py-2 font-semibold">Period pilihan</th>
                      <th className="text-left px-5 py-2 font-semibold">SQL yang dihasilkan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ["YTD",        "{col}::DATE BETWEEN DATE_TRUNC('year', CURRENT_DATE()) AND CURRENT_DATE()"],
                      ["30D",        "{col}::DATE BETWEEN DATEADD('day',-30, CURRENT_DATE()) AND CURRENT_DATE()"],
                      ["90D",        "{col}::DATE BETWEEN DATEADD('day',-90, CURRENT_DATE()) AND CURRENT_DATE()"],
                      ["6M",         "{col}::DATE BETWEEN DATEADD('month',-6, CURRENT_DATE()) AND CURRENT_DATE()"],
                      ["Today",      "{col}::DATE = CURRENT_DATE()"],
                      ["This Week",  "Tanggal yang week-nya sama dengan week sekarang (DAYOFWEEKISO)"],
                      ["Last Week",  "Tanggal yang week-nya sama dengan week lalu"],
                      ["This Month", "DATE_TRUNC('month', {col}) = DATE_TRUNC('month', CURRENT_DATE())"],
                      ["Last Month", "DATE_TRUNC('month', {col}) = DATE_TRUNC('month', DATEADD('month',-1, CURRENT_DATE()))"],
                      ["Custom",     "{col}::DATE BETWEEN ?::DATE AND ?::DATE  ← nilai dari date picker"],
                    ].map(([p, sql]) => (
                      <tr key={p} className="bg-white hover:bg-slate-50">
                        <td className="px-5 py-2.5">
                          <span className="font-mono font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{p}</span>
                        </td>
                        <td className="px-5 py-2.5 font-mono text-slate-700">{sql}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div id="plant-filter" className="scroll-mt-8 bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                <h3 className="font-semibold text-slate-700 text-sm">Plant Filter</h3>
              </div>
              <div className="px-5 py-4 text-sm text-slate-600 space-y-2">
                <p>Kalau user pilih "All Plant" → filter plant <strong>tidak diapply</strong>, semua pabrik masuk.</p>
                <p>Kalau pilih pabrik tertentu → ditambahkan <code className="bg-slate-100 px-1 rounded text-indigo-700">AND PLANT = &#39;xxx&#39;</code> ke WHERE clause.</p>
                <p className="text-xs text-slate-400">Kolom default: <code>PLANT</code>. Beberapa query pakai nama kolom berbeda, sudah di-handle per query.</p>
              </div>
            </div>
          </Section>

          {/* ══ LEAD TIME ═══════════════════════════════════════════════════════ */}
          <Section id="lead-time" title="Lead Time" badge="CT_MANUF_LEADTIME" badgeColor="sky">
            <p className="text-sm text-slate-500">
              Mengukur berapa lama sebuah Process Order FG selesai — dari pertama masuk (PO) sampai diterima di NDC (RECEIVE NDC).
              Ada dua versi: <strong>Gross</strong> (total kalender) dan <strong>Nett</strong> (hanya waktu aktual kerja).
            </p>

            <Metric
              name="Gross Lead Time (hari)"
              table="MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME"
              dateCol="PO_FG_DONE_DATE"
              formula="AVG( DATEDIFF(menit, mulai_PO, selesai_NDC) ) / 1440"
              note="Satu baris per PROCESS_ORDER_FG. Hanya PO yang punya kedua titik waktu (PO start & NDC stop) yang dihitung."
              sql={`
-- Hitung durasi setiap PO dari ACTIVITY='PO' sampai ACTIVITY='RECEIVE NDC'
-- lalu rata-ratakan semua PO dalam periode, konversi menit → hari

SELECT AVG(gross_minutes) / 1440.0 AS AVG_GROSS_DAYS
FROM (
  SELECT
    PROCESS_ORDER_FG,
    DATEDIFF('minute',
      MIN(CASE WHEN ACTIVITY = 'PO'          THEN ACTIVITY_START END),
      MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP  END)
    ) AS gross_minutes
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
  WHERE {period_filter_on_PO_FG_DONE_DATE}
    AND {plant_filter}
  GROUP BY PROCESS_ORDER_FG
  HAVING
    MIN(CASE WHEN ACTIVITY = 'PO'          THEN ACTIVITY_START END) IS NOT NULL
    AND MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP  END) IS NOT NULL
) sub
`}
            />

            <Metric
              name="Nett Lead Time (hari)"
              table="MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME"
              dateCol="PO_FG_DONE_DATE"
              formula="AVG( SUM(NET_LEADTIME) per PO ) / 1440"
              note="Hanya baris dengan ACTIVITY_TYPE = 'ACTUAL' dan LINE_CATEGORY IS NOT NULL yang dihitung — ini yang setara dengan definisi Tableau."
              sql={`
-- Sum NET_LEADTIME per PO (hanya aktivitas aktual yang punya line category)
-- lalu rata-ratakan semua PO, konversi menit → hari

SELECT AVG(nett_minutes) / 1440.0 AS AVG_NETT_DAYS
FROM (
  SELECT
    PROCESS_ORDER_FG,
    SUM(NET_LEADTIME) AS nett_minutes
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
  WHERE {period_filter_on_PO_FG_DONE_DATE}
    AND ACTIVITY_TYPE = 'ACTUAL'
    AND LINE_CATEGORY IS NOT NULL
    AND {plant_filter}
  GROUP BY PROCESS_ORDER_FG
) sub
`}
            />

            <Metric
              name="Lead Time by Position (breakdown per posisi)"
              table="MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME"
              dateCol="PO_FG_DONE_DATE"
              formula="AVG( SUM(NET_LEADTIME) per PO per POSITION ) / 60 → jam"
              sql={`
-- Nett: sum menit per PO per posisi → rata-rata jam per posisi
SELECT POSITION, AVG(pos_minutes) / 60.0 AS AVG_HOURS
FROM (
  SELECT PROCESS_ORDER_FG, POSITION, SUM(NET_LEADTIME) AS pos_minutes
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
  WHERE {period_filter_on_PO_FG_DONE_DATE}
    AND ACTIVITY_TYPE = 'ACTUAL'
    AND {plant_filter}
  GROUP BY PROCESS_ORDER_FG, POSITION
) sub
GROUP BY POSITION
ORDER BY AVG_HOURS DESC
LIMIT 10

-- Gross: datediff min-max per PO per posisi → rata-rata jam
SELECT POSITION, AVG(pos_minutes) / 60.0 AS AVG_HOURS
FROM (
  SELECT PROCESS_ORDER_FG, POSITION,
    DATEDIFF('minute', MIN(ACTIVITY_START), MAX(ACTIVITY_STOP)) AS pos_minutes
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
  WHERE {period_filter_on_PO_FG_DONE_DATE}
    AND {plant_filter}
  GROUP BY PROCESS_ORDER_FG, POSITION
) sub
GROUP BY POSITION
ORDER BY AVG_HOURS DESC
LIMIT 10
`}
            />
          </Section>

          {/* ══ RIGHT FIRST TIME ════════════════════════════════════════════════ */}
          <Section id="rft" title="Right First Time (RFT)" badge="CT_MANUF_LEADTIME" badgeColor="emerald">
            <p className="text-sm text-slate-500">
              Persentase aktivitas yang langsung benar tanpa adjustment. Kalau ada ACTIVITY = 'ADJUST' artinya ada rework/koreksi.
              Makin tinggi RFT, makin bagus. Ini setara formula Tableau: <em>SUM(IF ACTIVITY ≠ "ADJUST" THEN 1 ELSE 0) / COUNT(ACTIVITY)</em>.
            </p>
            <Metric
              name="RFT %"
              table="MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME"
              dateCol="PO_FG_DONE_DATE"
              formula="Jumlah aktivitas non-ADJUST / Total aktivitas × 100"
              sql={`
SELECT
  COUNT(CASE WHEN ACTIVITY <> 'ADJUST' THEN 1 END) * 100.0
    / NULLIF(COUNT(ACTIVITY), 0) AS RFT_PCT
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
WHERE {period_filter_on_PO_FG_DONE_DATE}
  AND {plant_filter}
`}
            />
          </Section>

          {/* ══ YIELD / LOSS ════════════════════════════════════════════════════ */}
          <Section id="yield" title="Yield / Loss" badge="2 tabel berbeda" badgeColor="amber">
            <p className="text-sm text-slate-500">
              Ada dua jenis loss: <strong>Pack Loss</strong> dari proses pengemasan, dan <strong>Bulk Loss</strong> dari proses pengolahan.
              Keduanya pakai tabel dan kolom tanggal yang berbeda.
            </p>

            <Metric
              name="Pack Loss % (packaging)"
              table="MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS"
              dateCol="KEMAS_COMPLETED_AT"
              formula="SUM(QTY_FG_RETUR) / SUM(QTY_TOTAL) × 100"
              note="QTY_FG_RETUR = qty yang dikembalikan/reject. QTY_TOTAL = total qty yang dikemas."
              sql={`
SELECT
  SUM(QTY_FG_GOOD)  AS total_good,
  SUM(QTY_FG_RETUR) AS total_retur,
  SUM(QTY_TOTAL)    AS total_qty
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
WHERE {period_filter_on_KEMAS_COMPLETED_AT}
  AND {plant_filter}

-- Kalkulasi di aplikasi:
-- pack_loss_pct = total_retur / total_qty * 100
`}
            />

            <Metric
              name="Bulk Loss % & Bulk Loss Kg (pengolahan)"
              table="DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH"
              dateCol="CORRECTION_DATE"
              formula="(THEORETICAL_QUANTITY − REALIZATION_QUANTITY) / THEORETICAL_QUANTITY × 100"
              note="Filter plant TIDAK diapply di sini karena tabel ini belum punya kolom PLANT yang terhubung. Bulk Loss Kg = selisih absolut kalau theoretical > realization."
              sql={`
SELECT
  SUM(REALIZATION_QUANTITY) AS total_realization,
  SUM(THEORETICAL_QUANTITY) AS total_theoretical
FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
WHERE {period_filter_on_CORRECTION_DATE}

-- Kalkulasi di aplikasi:
-- bulk_loss_pct = ABS((theoretical - realization) / theoretical) * 100
-- bulk_loss_kg  = theoretical - realization  (hanya kalau theoretical > realization)
`}
            />
          </Section>

          {/* ══ OUTPUT ══════════════════════════════════════════════════════════ */}
          <Section id="output" title="Output" badge="2 tabel berbeda" badgeColor="teal">
            <p className="text-sm text-slate-500">
              Total produksi dalam periode. Diukur dua cara: <strong>Bulk</strong> (kg dari pengolahan) dan <strong>FG</strong> (pcs dari pengemasan).
              Keduanya pakai <code className="bg-slate-100 px-1 rounded">CORRECTION_DATE</code> sebagai filter tanggal.
            </p>

            <Metric
              name="Bulk Output (kg)"
              table="DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH"
              dateCol="CORRECTION_DATE"
              formula="SUM(REALIZATION_QUANTITY)"
              sql={`
SELECT SUM(REALIZATION_QUANTITY) AS total_bulk_kg
FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
WHERE {period_filter_on_CORRECTION_DATE}
`}
            />

            <Metric
              name="FG Output (pcs)"
              table="DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG"
              dateCol="CORRECTION_DATE"
              formula="SUM(QUANTITY)"
              sql={`
SELECT SUM(QUANTITY) AS total_fg_pcs
FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG
WHERE {period_filter_on_CORRECTION_DATE}
`}
            />
          </Section>

          {/* ══ OEE ═════════════════════════════════════════════════════════════ */}
          <Section id="oee" title="OEE (Overall Equipment Effectiveness)" badge="CT_MANUF_KEMAS" badgeColor="violet">
            <p className="text-sm text-slate-500">
              OEE = Quality × Performance. Dua komponen ini dihitung per row di CT_MANUF_KEMAS, lalu di-average per pabrik.
              Nilai ditampilkan per plant dan di-average lagi untuk angka keseluruhan.
            </p>

            <Metric
              name="OEE, Quality, Performance per Plant"
              table="MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS"
              dateCol="KEMAS_COMPLETED_AT"
              formula={`Quality = QTY_FG_GOOD / QTY_TOTAL\nPerformance = MIN(PRODUCTIVITY / ACTIVITY_PRODUCTIVITY_STD, 1.0)\nOEE = Quality × Performance`}
              note="Performance di-cap di 1.0 (100%) dengan LEAST() — tidak mungkin lebih dari 100%. Kalau QTY_TOTAL = 0 atau STD = 0, nilainya dianggap 0."
              sql={`
SELECT
  PLANT,

  -- Quality: berapa persen qty yang bagus dari total
  AVG(
    CASE WHEN QTY_TOTAL > 0
    THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL
    ELSE 0 END
  ) * 100 AS QUALITY,

  -- Performance: produktivitas actual vs standar (max 100%)
  AVG(
    CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
    THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0)
    ELSE 0 END
  ) * 100 AS PERFORMANCE,

  -- OEE = Quality × Performance per baris, lalu di-average
  AVG(
    (CASE WHEN QTY_TOTAL > 0
      THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL
      ELSE 0 END)
    *
    (CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
      THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0)
      ELSE 0 END)
  ) * 100 AS OEE

FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
WHERE {period_filter_on_KEMAS_COMPLETED_AT}
  AND {plant_filter}
GROUP BY PLANT
`}
            />
          </Section>

          {/* ══ PRODUCTIVITY ════════════════════════════════════════════════════ */}
          <Section id="productivity" title="Productivity" badge="3 tabel" badgeColor="rose">
            <p className="text-sm text-slate-500">
              Tiga jenis produktivitas: E2E (end-to-end dari kolom pre-computed), Downstream (kemasan), dan Upstream (pengolahan dengan LOD Tableau 3-level).
            </p>

            <Metric
              name="E2E Productivity"
              table="MIGRATION.CONTROL_TOWER.CT_MANUF_E2E"
              dateCol="KEMAS_COMPLETED_AT"
              formula="AVG(E2E_PRODUCTIVITY) — kolom sudah dihitung di sumber"
              note="E2E_PRODUCTIVITY sudah ada sebagai kolom pre-computed. Kita cukup rata-ratakan nilainya."
              sql={`
SELECT AVG(E2E_PRODUCTIVITY) AS avg_e2e_prod
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
WHERE {period_filter_on_KEMAS_COMPLETED_AT}
  AND {plant_filter}
`}
            />

            <Metric
              name="Downstream Productivity (kemasan)"
              table="MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS"
              dateCol="KEMAS_COMPLETED_AT"
              formula="AVG per PO dari: SUM(QTY_FG_GOOD) / SUM(jam_kerja) / MAX(operator)"
              note="Matching Tableau LOD: {FIXED [PROCESS_ORDER_FG]: SUM/SUM/MAX}. Hanya baris dengan leadtime > 0 dan operator > 0 yang masuk."
              sql={`
SELECT AVG(po_prod) AS avg_downstream_prod
FROM (
  SELECT
    PROCESS_ORDER_FG,

    -- Untuk setiap PO: total qty bagus dibagi total jam kerja dibagi max operator
    SUM(QTY_FG_GOOD)
      / NULLIF(SUM(LEADTIME_IN_MINUTE) / 60.0, 0)
      / NULLIF(MAX(OPERATOR_COUNT), 0) AS po_prod

  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
  WHERE {period_filter_on_KEMAS_COMPLETED_AT}
    AND LEADTIME_IN_MINUTE > 0
    AND OPERATOR_COUNT > 0
    AND {plant_filter}
  GROUP BY PROCESS_ORDER_FG
) sub
`}
            />

            <Metric
              name="Upstream Productivity (pengolahan) — 3-level LOD"
              table="MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH"
              dateCol="OLAH_COMPLETED_AT"
              formula="AVG per SFG dari: MAX(release_bulk) / (SUM(leadtime_jam) / SUM(operator))"
              note={[
                "Matching Tableau LOD: {FIXED [Process Order SFG]: MAX(Release_Bulk) / (SUM(Leadtime)/60) / SUM(Operator)}",
                "Dihitung 3 tahap: Level 1 = per activity_id, Level 2 = per posisi, Level 3 = per SFG. Setelah dapat nilai per SFG, baru di-average.",
              ].join("\n")}
              sql={`
-- LEVEL 1: per activity — ambil nilai bulk/leadtime/operator dari baris yang punya release_bulk
WITH activity_lvl AS (
  SELECT
    PROCESS_ORDER_SFG,
    POSITION,
    ACTIVITY,
    ACTIVITY_ID,
    MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN RELEASE_BULK END)        AS release_bulk_sfg,
    MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN LEADTIME_IN_MINUTE END)  AS leadtime_per_act,
    MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN OPERATOR_COUNT END)      AS operator_per_act
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH
  WHERE {period_filter_on_OLAH_COMPLETED_AT}
    AND {plant_filter}
  GROUP BY PROCESS_ORDER_SFG, POSITION, ACTIVITY, ACTIVITY_ID
),

-- LEVEL 2: per posisi — sum leadtime & operator dari semua activity di posisi itu
position_lvl AS (
  SELECT
    PROCESS_ORDER_SFG,
    MAX(release_bulk_sfg)   AS release_bulk_sfg,
    SUM(leadtime_per_act)   AS leadtime_sum,
    SUM(operator_per_act)   AS operator_per_position
  FROM activity_lvl
  GROUP BY PROCESS_ORDER_SFG, POSITION
),

-- LEVEL 3: per SFG — sum semua posisi
sfg_lvl AS (
  SELECT
    PROCESS_ORDER_SFG,
    MAX(release_bulk_sfg)        AS max_release_bulk,
    SUM(leadtime_sum)            AS total_leadtime_min,
    SUM(operator_per_position)   AS total_operators
  FROM position_lvl
  GROUP BY PROCESS_ORDER_SFG
)

-- HASIL AKHIR: produktivitas per SFG → rata-rata
SELECT
  AVG(
    CASE WHEN total_leadtime_min > 0 AND total_operators > 0
    THEN max_release_bulk / (total_leadtime_min / 60.0) / total_operators
    END
  ) AS avg_upstream_prod
FROM sfg_lvl
WHERE max_release_bulk > 0
`}
            />

            <Metric
              name="Productivity Details (Manhours & Operator)"
              table="MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS"
              dateCol="KEMAS_COMPLETED_AT"
              formula="Total manhours = SUM(jam_kerja × operator) | Avg operator = AVG(OPERATOR_COUNT)"
              sql={`
SELECT
  ROUND(SUM(LEADTIME_IN_MINUTE / 60.0 * OPERATOR_COUNT)) AS total_manhours,
  ROUND(AVG(OPERATOR_COUNT))                              AS avg_operators
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
WHERE {period_filter_on_KEMAS_COMPLETED_AT}
  AND LEADTIME_IN_MINUTE > 0
  AND OPERATOR_COUNT > 0
  AND {plant_filter}
`}
            />
          </Section>

          {/* ══ SPARKLINES ══════════════════════════════════════════════════════ */}
          <Section id="sparklines" title="Sparklines (Data Mingguan)" badge="untuk grafik kecil di card" badgeColor="indigo">
            <p className="text-sm text-slate-500">
              Data ini dipakai untuk grafik sparkline kecil di dalam KPI cards. Sama persis logikanya dengan KPI utama, tapi di-group per minggu.
            </p>

            <Metric
              name="OEE Weekly"
              table="MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS"
              dateCol="KEMAS_COMPLETED_AT"
              formula="AVG(Quality × Performance) per minggu × 100 — sama persis dengan OEE card"
              sql={`
SELECT
  DATE_TRUNC('week', KEMAS_COMPLETED_AT::DATE) AS week,
  AVG(
    (CASE WHEN QTY_TOTAL > 0
      THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL
      ELSE 0 END)
    *
    (CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
      THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0)
      ELSE 0 END)
  ) * 100 AS oee
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
WHERE {period_filter_on_KEMAS_COMPLETED_AT}
  AND {plant_filter}
GROUP BY 1
ORDER BY 1
`}
            />

            <Metric
              name="E2E Productivity Weekly"
              table="MIGRATION.CONTROL_TOWER.CT_MANUF_E2E"
              dateCol="KEMAS_COMPLETED_AT"
              formula="AVG(E2E_PRODUCTIVITY) per minggu"
              sql={`
SELECT
  DATE_TRUNC('week', KEMAS_COMPLETED_AT::DATE) AS week,
  AVG(E2E_PRODUCTIVITY) AS avg_prod
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
WHERE {period_filter_on_KEMAS_COMPLETED_AT}
  AND {plant_filter}
GROUP BY 1
ORDER BY 1
`}
            />
          </Section>

          {/* footer */}
          <div className="border-t border-slate-200 pt-6 text-xs text-slate-400 space-y-1">
            <p>Source: <code className="font-mono bg-slate-100 px-1 rounded">lib/queries.ts</code> — update halaman ini setiap ada perubahan query.</p>
            <p>Filter placeholder <code className="font-mono bg-slate-100 px-1 rounded">{"{period_filter_on_COL}"}</code> dan <code className="font-mono bg-slate-100 px-1 rounded">{"{plant_filter}"}</code> diganti otomatis di runtime berdasarkan pilihan user.</p>
          </div>

        </main>
      </div>
    </div>
  );
}