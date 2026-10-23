"use client";

import { createContext, useContext, useState } from "react";

export type Lang = "id" | "en";

// ── Translation dictionaries ───────────────────────────────────────────────────

const dict = {
  id: {
    // Sidebar
    nav_overview: "Overview",
    nav_production: "Production",
    nav_quality: "Quality",
    nav_energy: "Energy",
    nav_reports: "Reports",
    nav_settings: "Settings",
    nav_signout: "Sign Out",

    // Header
    header_plant_all: "All Plant",
    header_period_ytd: "Year-to-Date",
    header_period_30d: "30 Hari Terakhir",
    header_period_90d: "90 Hari Terakhir",
    header_period_6m: "6 Bulan Terakhir",
    header_data_daily: "Harian",
    header_data_weekly: "Mingguan",
    header_data_monthly: "Bulanan",
    header_view_strategic: "Strategis",
    header_view_tactical: "Taktis",
    header_last_updated: "Diperbarui",
    header_refresh: "Refresh",
    header_custom_range: "Rentang Kustom",
    header_apply: "Terapkan",

    // Section headers
    section_operation_kpis: "KPI Operasional",
    section_equipment_people: "Peralatan & SDM",
    section_trend_benchmark: "Tren & Benchmark",

    // KPI card titles
    card_leadtime: "Lead Time",
    card_yield: "Yield / Loss",
    card_rft: "Right First Time",
    card_output: "Output",
    card_oee: "OEE",
    card_ope: "OPE",
    card_productivity: "Produktivitas",

    // Lead Time card
    lt_gross: "Gross",
    lt_nett: "Nett",
    lt_daily: "Harian",
    lt_hourly: "Per Jam",
    lt_subtitle_gross: "Gross LT · PO dibuat → NDC terima",
    lt_subtitle_nett: "Nett LT · Waktu produksi aktual",
    lt_vs_prev: "vs periode sebelumnya",

    // Yield card
    yield_bulk_loss: "Bulk Loss",
    yield_pack_loss: "Pack Loss",
    yield_loss_volume: "kg bulk hilang",

    // RFT card
    rft_passed_rate: "First Time Passed Rate",
    rft_meets: "✓ Memenuhi target",
    rft_below: "! Di bawah target",

    // Output card
    output_fg: "Finished Goods dirilis",
    output_bulk: "Bulk Diterima",

    // OEE/OPE card
    oee_subtitle: "Overall Equipment Effectiveness",
    ope_subtitle: "Overall Plant Effectiveness",
    oee_performance: "Performa",
    oee_quality: "Kualitas",
    oee_vs_target: "vs target",
    oee_gap: "gap",
    oee_pts: "poin",

    // Productivity card
    prod_subtitle: "Hilir · Produktivitas E2E",
    prod_upstream: "Hulu",
    prod_downstream: "Hilir",
    prod_manhours: "Total manhours",
    prod_avg_operator: "Rata-rata operator/batch",

    // Badges / status
    badge_critical: "Kritis",
    badge_on_track: "On Track",
    badge_below_target: "Di Bawah Target",
    badge_meets_target: "Memenuhi Target",

    // Charts
    chart_metric_trend: "Tren Metrik",
    chart_subtitle_trend: "Lead Time per plant dengan batas kendali",
    chart_kpi_by_plant: "KPI per Plant",
    chart_subtitle_plant: "Lead Time · avg vs batas kendali",
    chart_plant: "Plant",
    chart_value: "Nilai",
    chart_status: "Status",
    chart_in_control: "Terkendali",
    chart_watch: "Perhatian",
    chart_tab_leadtime: "Lead Time",
    chart_tab_upstream: "Prod. Hulu",
    chart_tab_downstream: "Prod. Hilir",
    chart_tab_e2e: "Prod. E2E",
    chart_tab_output: "Output Diterima",
    chart_data_weeks: "data",
    chart_ucl: "BKA",
    chart_lcl: "BKB",
    chart_mean: "Rata-rata",

    // Alert panel
    alert_title: "Notifikasi Aktif",
    alert_dismiss: "Tutup",
    alert_undo: "Batalkan",
    alert_dismissed: "Notifikasi dihapus",

    // AI Summary
    ai_generating: "Menganalisis data KPI...",
    ai_regenerate: "Perbarui",

    // Settings nav
    settings_title: "Pengaturan",
    settings_profil: "Profil",
    settings_tampilan: "Tampilan",
    settings_notifikasi: "Notifikasi",
    settings_threshold: "Alert & Threshold",
    settings_integrasi: "Integrasi",
    settings_admin: "Admin",

    // Settings — Profil
    profil_title: "Profil Pengguna",
    profil_name: "Nama",
    profil_email: "Email",
    profil_jabatan: "Jabatan",
    profil_jabatan_placeholder: "Masukkan jabatan Anda",
    profil_save: "Simpan",
    profil_saved: "Tersimpan",

    // Settings — Tampilan
    tampilan_title: "Tampilan",
    tampilan_timezone: "Zona Waktu",
    tampilan_plant: "Plant Default",
    tampilan_datalevel: "Level Data Default",
    tampilan_language: "Bahasa",
    tampilan_lang_id: "Bahasa Indonesia",
    tampilan_lang_en: "English",
    tampilan_save: "Simpan",
    tampilan_saved: "Tersimpan",

    // Settings — Admin
    admin_title: "Manajemen Admin",
    admin_desc: "Kelola pengguna yang memiliki akses ke pengaturan Notifikasi dan Threshold.",
    admin_add_placeholder: "Tambah email admin...",
    admin_add: "Tambah",
    admin_remove: "Hapus",
    admin_you: "Anda",
    admin_warning: "Daftar admin disimpan di browser ini. Tambahkan admin baru di setiap perangkat yang digunakan.",

    // Access restricted
    access_restricted: "Akses Dibatasi",
    access_restricted_desc: "Bagian ini hanya tersedia untuk admin. Hubungi admin untuk mendapatkan akses.",

    // Common
    common_save: "Simpan",
    common_saved: "Tersimpan",
    common_cancel: "Batal",
    common_loading: "Memuat...",
    common_no_data: "Belum ada data",
    unit_million: "juta",
    header_data_updated: "Sinkron terakhir",
    header_ago: "lalu",

    // Common actions
    action_apply: "Terapkan",
    action_discard: "Batalkan",
    action_refresh: "Perbarui",
    action_send: "Kirim",
    action_clear_selection: "Hapus Pilihan",
    action_show_more: "Lihat Selengkapnya",
    action_open_page: "Buka halaman",
    action_regenerate: "Perbarui",
    action_dismiss: "Tutup",
    action_undo: "Batalkan",

    // Unit / scale toggles
    toggle_days: "Hari",
    toggle_hours: "Jam",
    toggle_gross: "Gross",
    toggle_nett: "Nett",
    toggle_weekly: "Mingguan",
    toggle_monthly: "Bulanan",
    toggle_quarterly: "Kuartalan",
    toggle_overall: "Keseluruhan",
    toggle_by_plant: "Per Plant",
    toggle_group_process: "Group Process",
    toggle_process: "Proses",
    toggle_par: "Par",
    toggle_seq: "Seq",
    toggle_strategic: "Strategis",
    toggle_tactical: "Taktis",
    toggle_e2e: "E2E",
    toggle_mixing: "Mixing",
    toggle_filpac: "Filpac",
    toggle_oee: "OEE",
    toggle_oee_sku: "OEE SKU",
    toggle_po_created: "PO Created",
    toggle_po_released: "PO Released",

    // Status / badges
    status_on_track: "Sesuai Target",
    status_at_risk: "Berisiko",
    status_off_track: "Melewati Target",
    status_no_data: "Tidak Ada Data",
    status_all_normal: "Semua KPI dalam batas normal",

    // Card / section labels
    label_target: "Target",
    label_target_undefined: "Target belum ditetapkan",
    label_vs_prior: "vs periode sebelumnya",
    label_pos: "PO",
    label_completed_period: "selesai dalam periode",
    label_trend_mom: "Tren MoM",
    label_last_data_load: "Pemuatan data terakhir",
    label_live: "Live",

    // Table headers
    th_plant: "Plant",
    th_gross: "Gross",
    th_nett: "Nett",
    th_on_time: "Tepat Waktu",
    th_activity: "Aktivitas",
    th_line: "Line",
    th_sku: "SKU",
    th_variant: "Varian",
    th_process: "Proses",
    th_days: "Hari",
    th_pos: "PO",
    th_count: "Jumlah",
    th_share: "Porsi",

    // Filter labels
    filter_scope: "Scope",
    filter_basis: "Basis",
    filter_unit: "Unit",
    filter_po_no: "No. PO",
    filter_activity: "Aktivitas",
    filter_line_category: "Kategori Line",
    filter_line: "Line",
    filter_sku_group: "SKU Group",
    filter_sku: "SKU",
    filter_variant: "Varian",
    filter_plant: "Plant",
    filter_period: "Periode",
    filter_start: "Tanggal Mulai",
    filter_end: "Tanggal Akhir",
    filter_resolution: "Resolusi",
    filter_view: "Tampilan",
    filter_lt_from: "Lead time dari",

    // Tabs
    tab_analysis: "Analisis",
    tab_pareto: "Pareto",
    tab_ranking: "Peringkat",

    // Empty / loading
    empty_no_data: "Tidak ada data",
    empty_loading: "Memuat…",
    empty_select_period: "Pilih periode",
    empty_coming_soon: "Segera hadir",

    // Section titles
    section_lt_composition: "Komposisi Lead Time",
    section_lt_breakdown_plant: "Rincian Lead Time per Plant",
    section_lt_stage: "Lead Time per Tahap",
    section_lt_distribution: "Distribusi Lead Time",
    section_va_nnva: "VA · NNVA · UNVA",
    section_at_risk_pos: "PO Berisiko",
    section_kpi_alerts: "KPI Alerts",
    section_predicted_risk: "Diprediksi Berisiko",
    section_already_late: "Sudah Melewati Target",

    // Scorecard
    sc_total_pos: "Total PO",
    sc_median: "Median",
    sc_p25: "Persentil 25",
    sc_p75: "Persentil 75",
    sc_p90: "Persentil 90",
    sc_max: "Maksimum",
    sc_min: "Minimum",
    sc_avg: "Rata-rata",

    // Lang toggle
    lang_toggle_switch_to: "Beralih ke",

    // Monitor
    monitor_mode: "Mode Monitor",
    monitor_mode_full: "Mode monitor — tampilan layar penuh",

    // Toast / Teams
    teams_sent: "Terkirim ke Teams!",
    teams_failed: "Gagal — periksa konfigurasi",
    teams_sending: "Mengirim…",
    teams_send: "Kirim ke Teams",
    teams_need_attention: "KPI butuh perhatian",
    teams_no_active: "Tidak ada notifikasi aktif",

    // Chart / misc
    chart_target: "Target",
    chart_actual: "Aktual",
    chart_standard: "Standar",
    chart_others: "Lainnya",
    chart_total: "Total",
    chart_all_plants: "All Plant",

    // Output section (Tactical)
    output_trend_title: "Output Trend (Aktual vs Theoretical Output)",
    output_trend_tooltip: "Output FG dalam juta pcs. Garis teoretis akan muncul setelah data perencanaan terhubung.",
    output_trend_no_data: "Tidak ada data untuk periode ini",
    output_bulk_coming_soon: "Bulk output trend — segera hadir",
    output_line_title: "Top Line by Output",
    output_line_tooltip: "FG yang dirilis per lini produksi, diurutkan berdasarkan output aktual. Theoretical output dan gap akan tersedia setelah data perencanaan terhubung.",
    output_line_bulk_coming_soon: "Bulk line table — segera hadir",
    output_line_th_qty_po: "Qty PO",
    output_line_th_qty_real: "Qty Real (pcs)",
    output_line_th_theoretical: "Teoretis (pcs)",
    output_line_th_gap: "Gap",
    output_line_th_pct_contrib: "% Kontrib.",
    output_fg_card_title: "Total FG & Ketercapaian",
    output_fg_label_total: "Total",
    output_fg_label_achievement: "Ketercapaian",
    output_fg_unit_mpcs: "juta pcs",
    output_fg_footer: "Theoretical output: N/A",
    output_count_title: "Total SKU & PO FG",
    output_count_avg: "Rata-rata",
    output_pie_plant: "Output per Plant",
    output_pie_form: "Output per Bentuk",
    output_legend_theoretical: "Theoretical output",
  },

  en: {
    // Sidebar
    nav_overview: "Overview",
    nav_production: "Production",
    nav_quality: "Quality",
    nav_energy: "Energy",
    nav_reports: "Reports",
    nav_settings: "Settings",
    nav_signout: "Sign Out",

    // Header
    header_plant_all: "All Plant",
    header_period_ytd: "Year-to-Date",
    header_period_30d: "Last 30 Days",
    header_period_90d: "Last 90 Days",
    header_period_6m: "Last 6 Months",
    header_data_daily: "Daily",
    header_data_weekly: "Weekly",
    header_data_monthly: "Monthly",
    header_view_strategic: "Strategic",
    header_view_tactical: "Tactical",
    header_last_updated: "Updated",
    header_refresh: "Refresh",
    header_custom_range: "Custom Range",
    header_apply: "Apply",

    // Section headers
    section_operation_kpis: "Operation KPIs",
    section_equipment_people: "Equipment & People",
    section_trend_benchmark: "Trend & Benchmark",

    // KPI card titles
    card_leadtime: "Lead Time",
    card_yield: "Yield / Loss",
    card_rft: "Right First Time",
    card_output: "Output",
    card_oee: "OEE",
    card_ope: "OPE",
    card_productivity: "Productivity",

    // Lead Time card
    lt_gross: "Gross",
    lt_nett: "Nett",
    lt_daily: "Daily",
    lt_hourly: "Hourly",
    lt_subtitle_gross: "Gross LT · PO Created → NDC Receive",
    lt_subtitle_nett: "Nett LT · Actual on-line time",
    lt_vs_prev: "vs previous period",

    // Yield card
    yield_bulk_loss: "Bulk Loss",
    yield_pack_loss: "Pack Loss",
    yield_loss_volume: "kg bulk loss",

    // RFT card
    rft_passed_rate: "First Time Passed Rate",
    rft_meets: "✓ Meets target",
    rft_below: "! Below target",

    // Output card
    output_fg: "Finished Goods released",
    output_bulk: "Accepted Bulk",

    // OEE/OPE card
    oee_subtitle: "Overall Equipment Effectiveness",
    ope_subtitle: "Overall Plant Effectiveness",
    oee_performance: "Performance",
    oee_quality: "Quality",
    oee_vs_target: "vs target",
    oee_gap: "gap",
    oee_pts: "pts",

    // Productivity card
    prod_subtitle: "Downstream · E2E productivity",
    prod_upstream: "Upstream",
    prod_downstream: "Downstream",
    prod_manhours: "Manhours logged",
    prod_avg_operator: "Avg operator/batch",

    // Badges / status
    badge_critical: "Critical",
    badge_on_track: "On Track",
    badge_below_target: "Below Target",
    badge_meets_target: "Meets Target",

    // Charts
    chart_metric_trend: "Metric Trend",
    chart_subtitle_trend: "Lead Time per plant with control limits",
    chart_kpi_by_plant: "KPI by Plant",
    chart_subtitle_plant: "Lead Time · avg vs control limits",
    chart_plant: "Plant",
    chart_value: "Value",
    chart_status: "Status",
    chart_in_control: "In control",
    chart_watch: "Watch",
    chart_tab_leadtime: "Lead Time",
    chart_tab_upstream: "Upstream Prod.",
    chart_tab_downstream: "Downstream Prod.",
    chart_tab_e2e: "E2E Prod.",
    chart_tab_output: "Accepted Output",
    chart_data_weeks: "data",
    chart_ucl: "UCL",
    chart_lcl: "LCL",
    chart_mean: "Mean",

    // Alert panel
    alert_title: "Active Alerts",
    alert_dismiss: "Dismiss",
    alert_undo: "Undo",
    alert_dismissed: "Alert dismissed",

    // AI Summary
    ai_generating: "Analyzing KPI data...",
    ai_regenerate: "Regenerate",

    // Settings nav
    settings_title: "Settings",
    settings_profil: "Profile",
    settings_tampilan: "Display",
    settings_notifikasi: "Notifications",
    settings_threshold: "Alert & Threshold",
    settings_integrasi: "Integrations",
    settings_admin: "Admin",

    // Settings — Profil
    profil_title: "User Profile",
    profil_name: "Name",
    profil_email: "Email",
    profil_jabatan: "Job Title",
    profil_jabatan_placeholder: "Enter your job title",
    profil_save: "Save",
    profil_saved: "Saved",

    // Settings — Tampilan
    tampilan_title: "Display",
    tampilan_timezone: "Timezone",
    tampilan_plant: "Default Plant",
    tampilan_datalevel: "Default Data Level",
    tampilan_language: "Language",
    tampilan_lang_id: "Bahasa Indonesia",
    tampilan_lang_en: "English",
    tampilan_save: "Save",
    tampilan_saved: "Saved",

    // Settings — Admin
    admin_title: "Admin Management",
    admin_desc: "Manage users who have access to Notification and Threshold settings.",
    admin_add_placeholder: "Add admin email...",
    admin_add: "Add",
    admin_remove: "Remove",
    admin_you: "You",
    admin_warning: "The admin list is stored in this browser. Add new admins on each device used.",

    // Access restricted
    access_restricted: "Access Restricted",
    access_restricted_desc: "This section is only available to admins. Contact an admin to get access.",

    // Common
    common_save: "Save",
    common_saved: "Saved",
    common_cancel: "Cancel",
    common_loading: "Loading...",
    common_no_data: "No data yet",
    unit_million: "million",
    header_data_updated: "Last sync",
    header_ago: "ago",

    // Common actions
    action_apply: "Apply",
    action_discard: "Discard",
    action_refresh: "Refresh",
    action_send: "Send",
    action_clear_selection: "Clear selection",
    action_show_more: "Show more",
    action_open_page: "Open page",
    action_regenerate: "Regenerate",
    action_dismiss: "Dismiss",
    action_undo: "Undo",

    // Unit / scale toggles
    toggle_days: "Days",
    toggle_hours: "Hours",
    toggle_gross: "Gross",
    toggle_nett: "Nett",
    toggle_weekly: "Weekly",
    toggle_monthly: "Monthly",
    toggle_quarterly: "Quarterly",
    toggle_overall: "Overall",
    toggle_by_plant: "By plant",
    toggle_group_process: "Group Process",
    toggle_process: "Process",
    toggle_par: "Par",
    toggle_seq: "Seq",
    toggle_strategic: "Strategic",
    toggle_tactical: "Tactical",
    toggle_e2e: "E2E",
    toggle_mixing: "Mixing",
    toggle_filpac: "Filpac",
    toggle_oee: "OEE",
    toggle_oee_sku: "OEE SKU",
    toggle_po_created: "PO Created",
    toggle_po_released: "PO Released",

    // Status / badges
    status_on_track: "On Track",
    status_at_risk: "At Risk",
    status_off_track: "Off Track",
    status_no_data: "No Data",
    status_all_normal: "All KPIs within normal range",

    // Card / section labels
    label_target: "Target",
    label_target_undefined: "Target not defined",
    label_vs_prior: "vs prior period",
    label_pos: "POs",
    label_completed_period: "completed in period",
    label_trend_mom: "Trend MoM",
    label_last_data_load: "Last data load",
    label_live: "Live",

    // Table headers
    th_plant: "Plant",
    th_gross: "Gross",
    th_nett: "Nett",
    th_on_time: "On-time",
    th_activity: "Activity",
    th_line: "Line",
    th_sku: "SKU",
    th_variant: "Variant",
    th_process: "Process",
    th_days: "Days",
    th_pos: "POs",
    th_count: "Count",
    th_share: "Share",

    // Filter labels
    filter_scope: "Scope",
    filter_basis: "Basis",
    filter_unit: "Unit",
    filter_po_no: "PO No.",
    filter_activity: "Activity",
    filter_line_category: "Line category",
    filter_line: "Line",
    filter_sku_group: "SKU group",
    filter_sku: "SKU",
    filter_variant: "Variant",
    filter_plant: "Plant",
    filter_period: "Period",
    filter_start: "Start date",
    filter_end: "End date",
    filter_resolution: "Resolution",
    filter_view: "View",
    filter_lt_from: "Lead time from",

    // Tabs
    tab_analysis: "Analysis",
    tab_pareto: "Pareto",
    tab_ranking: "Ranking",

    // Empty / loading
    empty_no_data: "No data",
    empty_loading: "Loading…",
    empty_select_period: "Select a period",
    empty_coming_soon: "Coming soon",

    // Section titles
    section_lt_composition: "Lead time composition",
    section_lt_breakdown_plant: "Lead time breakdown per plant",
    section_lt_stage: "Lead time per stage",
    section_lt_distribution: "Lead time distribution",
    section_va_nnva: "VA · NNVA · UNVA",
    section_at_risk_pos: "At-Risk POs",
    section_kpi_alerts: "KPI Alerts",
    section_predicted_risk: "Predicted at risk",
    section_already_late: "Already late",

    // Scorecard
    sc_total_pos: "Total POs",
    sc_median: "Median",
    sc_p25: "Percentile 25",
    sc_p75: "Percentile 75",
    sc_p90: "Percentile 90",
    sc_max: "Maximum",
    sc_min: "Minimum",
    sc_avg: "Average",

    // Lang toggle
    lang_toggle_switch_to: "Switch to",

    // Monitor
    monitor_mode: "Monitor mode",
    monitor_mode_full: "Monitor mode — full screen view",

    // Toast / Teams
    teams_sent: "Sent to Teams!",
    teams_failed: "Failed — check config",
    teams_sending: "Sending…",
    teams_send: "Send to Teams",
    teams_need_attention: "Need Attention",
    teams_no_active: "No active alerts",

    // Chart / misc
    chart_target: "Target",
    chart_actual: "Actual",
    chart_standard: "Standard",
    chart_others: "Others",
    chart_total: "Total",
    chart_all_plants: "All Plant",

    // Output section (Tactical)
    output_trend_title: "Output Trend (Actual vs Theoretical Output)",
    output_trend_tooltip: "Finished goods output in million pcs. The theoretical line will appear once planning data is connected.",
    output_trend_no_data: "No data for selected period",
    output_bulk_coming_soon: "Bulk output trend — coming soon",
    output_line_title: "Top Line by Output",
    output_line_tooltip: "Finished goods released per production line, sorted by actual output. Theoretical output and gap will appear once planning data is connected.",
    output_line_bulk_coming_soon: "Bulk line table — coming soon",
    output_line_th_qty_po: "Qty PO",
    output_line_th_qty_real: "Qty Real (pcs)",
    output_line_th_theoretical: "Theoretical (pcs)",
    output_line_th_gap: "Gap",
    output_line_th_pct_contrib: "% Contrib.",
    output_fg_card_title: "Total FG & Achievement",
    output_fg_label_total: "Total",
    output_fg_label_achievement: "Achievement",
    output_fg_unit_mpcs: "M pcs",
    output_fg_footer: "Theoretical output: N/A",
    output_count_title: "Total SKU & PO FG",
    output_count_avg: "Avg",
    output_pie_plant: "Output per Plant",
    output_pie_form: "Output by Form",
    output_legend_theoretical: "Theoretical output",
  },
} as const;

export type TranslationKey = keyof typeof dict.en;

// ── Context ────────────────────────────────────────────────────────────────────

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: "en",
  setLang: () => {},
  t: (key) => dict.en[key] as string,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "en";
    try {
      const v = localStorage.getItem("ct-lang");
      return v === "id" || v === "en" ? v : "en";
    } catch { return "en"; }
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("ct-lang", l); } catch {}
  };

  const t = (key: TranslationKey): string => (dict[lang][key] as string) ?? (dict.en[key] as string);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

/** Alias for useI18n — kept for ergonomic `const { t } = useT()` call sites. */
export function useT() {
  return useContext(I18nContext);
}