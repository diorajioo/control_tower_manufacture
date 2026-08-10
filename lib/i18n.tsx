"use client";

import { createContext, useContext, useEffect, useState } from "react";

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
  lang: "id",
  setLang: () => {},
  t: (key) => dict.id[key] as string,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("id");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ct-display-settings");
      if (raw) {
        const parsed = JSON.parse(raw) as { language?: Lang };
        if (parsed.language === "en" || parsed.language === "id") {
          setLangState(parsed.language);
        }
      }
    } catch { /* ignore */ }

    // Listen for changes made in the settings page (same tab)
    const handler = (e: StorageEvent) => {
      if (e.key === "ct-display-settings" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as { language?: Lang };
          if (parsed.language === "en" || parsed.language === "id") {
            setLangState(parsed.language);
          }
        } catch { /* ignore */ }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    // Persist into existing display settings
    try {
      const raw = localStorage.getItem("ct-display-settings");
      const existing = raw ? JSON.parse(raw) : {};
      localStorage.setItem("ct-display-settings", JSON.stringify({ ...existing, language: l }));
      // Dispatch so other tabs pick it up
      window.dispatchEvent(new StorageEvent("storage", {
        key: "ct-display-settings",
        newValue: JSON.stringify({ ...existing, language: l }),
      }));
    } catch { /* ignore */ }
  };

  const t = (key: TranslationKey): string => (dict[lang][key] as string) ?? (dict.id[key] as string);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}