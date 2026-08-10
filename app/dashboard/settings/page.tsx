"use client";

import { Suspense, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "next-auth";
import {
  User, Monitor, Bell, SlidersHorizontal, Database,
  Plus, X, RotateCcw, Send, Check, Loader2, Mail,
  Clock, AlertCircle, Lock, Shield,
} from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { cn } from "@/lib/utils";
import { useI18n, type TranslationKey } from "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────────────────────────

type KpiKey = "leadTime" | "bulkLoss" | "packLoss" | "rft" | "oee";

interface RecipientConfig {
  email: string;
  kpis: Record<KpiKey, boolean>;
}

interface NotifSettings {
  enabled: boolean;
  recipients: RecipientConfig[];
  mode: "immediate" | "daily_digest";
  digestTime: string;
}

interface ThresholdSettings {
  leadTime: { warning: number; critical: number };
  bulkLoss: { absWarning: number; absCritical: number };
  packLoss: { absWarning: number; absCritical: number };
  rft: { warning: number; critical: number };
  oee: { warning: number; critical: number };
}

interface DisplaySettings {
  timezone: "WIB" | "WITA" | "WIT";
  defaultPlant: string;
  defaultDataLevel: "Daily" | "Hourly";
  language: "id" | "en";
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const KPI_CHIPS: Record<KpiKey, string> = {
  leadTime: "Lead Time",
  bulkLoss: "Bulk Loss",
  packLoss: "Pack Loss",
  rft: "RFT",
  oee: "OEE",
};

const ALL_KPIS_ON: Record<KpiKey, boolean> = {
  leadTime: true, bulkLoss: true, packLoss: true, rft: true, oee: true,
};

const DEFAULT_NOTIF: NotifSettings = {
  enabled: false,
  recipients: [],
  mode: "immediate",
  digestTime: "07:00",
};

const DEFAULT_THRESHOLDS: ThresholdSettings = {
  leadTime: { warning: 5, critical: 15 },
  bulkLoss: { absWarning: 3, absCritical: 5 },
  packLoss: { absWarning: 1, absCritical: 2 },
  rft: { warning: 95, critical: 90 },
  oee: { warning: 65, critical: 55 },
};

const DEFAULT_DISPLAY: DisplaySettings = {
  timezone: "WIB",
  defaultPlant: "All Plant",
  defaultDataLevel: "Daily",
  language: "id",
};

// ── Storage ───────────────────────────────────────────────────────────────────

function loadNotif(): NotifSettings {
  try {
    const raw = localStorage.getItem("ct-notification-settings");
    if (!raw) return DEFAULT_NOTIF;
    const p = JSON.parse(raw) as Partial<NotifSettings & { recipients: (string | RecipientConfig)[]; kpis: Record<KpiKey, boolean> }>;
    // Migrate old string[] recipients → RecipientConfig[]
    const recipients: RecipientConfig[] = (p.recipients ?? []).map((r) =>
      typeof r === "string" ? { email: r, kpis: { ...ALL_KPIS_ON } } : r
    );
    // Strip legacy fields (kpis, recipients) before spreading so TS doesn't complain
    const { kpis: _kpis, recipients: _r, ...rest } = p;
    return { ...DEFAULT_NOTIF, ...rest, recipients };
  } catch { return DEFAULT_NOTIF; }
}

function loadThresholds(): ThresholdSettings {
  try {
    const raw = localStorage.getItem("ct-alert-thresholds");
    if (!raw) return DEFAULT_THRESHOLDS;
    const p = JSON.parse(raw) as Partial<ThresholdSettings>;
    return {
      leadTime: { ...DEFAULT_THRESHOLDS.leadTime, ...p.leadTime },
      bulkLoss: { ...DEFAULT_THRESHOLDS.bulkLoss, ...p.bulkLoss },
      packLoss: { ...DEFAULT_THRESHOLDS.packLoss, ...p.packLoss },
      rft: { ...DEFAULT_THRESHOLDS.rft, ...p.rft },
      oee: { ...DEFAULT_THRESHOLDS.oee, ...p.oee },
    };
  } catch { return DEFAULT_THRESHOLDS; }
}

function loadAdmins(currentEmail: string): string[] {
  try {
    const raw = localStorage.getItem("ct-admins");
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    if (Array.isArray(list) && list.length > 0) return list;
  } catch { /* ignore */ }
  const initial = [currentEmail];
  localStorage.setItem("ct-admins", JSON.stringify(initial));
  return initial;
}

function loadDisplay(): DisplaySettings {
  try {
    const raw = localStorage.getItem("ct-display-settings");
    if (!raw) return DEFAULT_DISPLAY;
    return { ...DEFAULT_DISPLAY, ...JSON.parse(raw) };
  } catch { return DEFAULT_DISPLAY; }
}

// ── Page entry ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status === "loading") return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f7ff]">
      <Sidebar />
      <Suspense fallback={null}>
        <SettingsShell />
      </Suspense>
    </div>
  );
}

// ── Section nav config ────────────────────────────────────────────────────────

const SECTIONS: { id: "profil"|"tampilan"|"notifikasi"|"threshold"|"integrasi"|"admin"; tKey: TranslationKey; icon: React.ElementType; adminOnly: boolean }[] = [
  { id: "profil",      tKey: "settings_profil",      icon: User,              adminOnly: false },
  { id: "tampilan",    tKey: "settings_tampilan",    icon: Monitor,           adminOnly: false },
  { id: "notifikasi",  tKey: "settings_notifikasi",  icon: Bell,              adminOnly: true  },
  { id: "threshold",   tKey: "settings_threshold",   icon: SlidersHorizontal, adminOnly: true  },
  { id: "integrasi",   tKey: "settings_integrasi",   icon: Database,          adminOnly: false },
  { id: "admin",       tKey: "settings_admin",       icon: Shield,            adminOnly: true  },
];

type SectionId = typeof SECTIONS[number]["id"];

// ── Shell ─────────────────────────────────────────────────────────────────────

function SettingsShell() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = (searchParams.get("s") as SectionId) || "profil";
  const { t, setLang } = useI18n();

  const [notif, setNotif] = useState<NotifSettings>(DEFAULT_NOTIF);
  const [thresholds, setThresholds] = useState<ThresholdSettings>(DEFAULT_THRESHOLDS);
  const [display, setDisplay] = useState<DisplaySettings>(DEFAULT_DISPLAY);
  const [jabatan, setJabatan] = useState("");
  const [admins, setAdmins] = useState<string[]>([]);

  useEffect(() => {
    setNotif(loadNotif());
    setThresholds(loadThresholds());
    setDisplay(loadDisplay());
    setJabatan(localStorage.getItem("ct-user-jabatan") ?? "");
  }, []);

  useEffect(() => {
    const email = session?.user?.email;
    if (!email) return;
    setAdmins(loadAdmins(email));
  }, [session?.user?.email]);

  const isAdmin = !!session?.user?.email && admins.includes(session.user.email);
  const saveAdmins = (list: string[]) => {
    setAdmins(list);
    localStorage.setItem("ct-admins", JSON.stringify(list));
  };

  const go = (s: SectionId) =>
    router.push(`/dashboard/settings?s=${s}`, { scroll: false });

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Inner left nav */}
      <nav className="w-48 shrink-0 bg-white border-r border-gray-100 flex flex-col py-6 px-2 gap-0.5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
          {t("settings_title")}
        </p>
        {SECTIONS
          .filter(({ id }) => id !== "admin" || isAdmin)
          .map(({ id, tKey, icon: Icon, adminOnly }) => {
            const locked = adminOnly && !isAdmin;
            return (
              <button
                key={id}
                onClick={() => go(id)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-left",
                  active === id
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                )}
              >
                <Icon size={15} />
                <span className="flex-1">{t(tKey)}</span>
                {locked && <Lock size={11} className="text-gray-300 shrink-0" />}
              </button>
            );
          })}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-8 py-8">
          {active === "profil" && (
            <ProfilSection
              session={session}
              jabatan={jabatan}
              setJabatan={setJabatan}
              onSave={() => localStorage.setItem("ct-user-jabatan", jabatan)}
            />
          )}
          {active === "tampilan" && (
            <TampilanSection
              display={display}
              setDisplay={setDisplay}
              onSave={() => localStorage.setItem("ct-display-settings", JSON.stringify(display))}
              onLangChange={setLang}
            />
          )}
          {active === "notifikasi" && (
            isAdmin ? (
              <NotifikasiSection
                notif={notif}
                setNotif={setNotif}
                onSave={() => localStorage.setItem("ct-notification-settings", JSON.stringify(notif))}
              />
            ) : (
              <AdminOnly title="Notifikasi" />
            )
          )}
          {active === "threshold" && (
            isAdmin ? (
              <ThresholdSection
                thresholds={thresholds}
                setThresholds={setThresholds}
                onSave={() => localStorage.setItem("ct-alert-thresholds", JSON.stringify(thresholds))}
              />
            ) : (
              <AdminOnly title="Alert & Threshold" />
            )
          )}
          {active === "integrasi" && <IntegrasiSection />}
          {active === "admin" && isAdmin && (
            <AdminSection
              admins={admins}
              currentEmail={session?.user?.email ?? ""}
              onSave={saveAdmins}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-2xl font-bold text-gray-800">{title}</h1>
      {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
    </div>
  );
}

function Card({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-white rounded-xl border border-gray-100 overflow-hidden", className)}>
      {title && (
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">{title}</p>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function SaveButton({ onSave }: { onSave: () => void }) {
  const [saved, setSaved] = useState(false);
  const handle = () => {
    onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };
  return (
    <button
      onClick={handle}
      className={cn(
        "flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-all",
        saved ? "bg-green-500 text-white" : "bg-brand-600 text-white hover:bg-brand-700"
      )}
    >
      {saved ? <><Check size={14} />Tersimpan</> : "Simpan Perubahan"}
    </button>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
        checked ? "bg-brand-600" : "bg-gray-200"
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

function NumericInput({
  value,
  onChange,
  unit,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) onChange(n);
        }}
        className="w-16 text-sm text-center border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
      />
      {unit && <span className="text-xs text-gray-400">{unit}</span>}
    </div>
  );
}

// ── Profil ────────────────────────────────────────────────────────────────────

function ProfilSection({
  session,
  jabatan,
  setJabatan,
  onSave,
}: {
  session: Session | null;
  jabatan: string;
  setJabatan: (v: string) => void;
  onSave: () => void;
}) {
  const name = session?.user?.name ?? "—";
  const email = session?.user?.email ?? "—";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-5">
      <SectionTitle title="Profil" description="Informasi akun Anda" />

      <Card>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
            <span className="font-display text-xl font-bold text-brand-600">{initials}</span>
          </div>
          <div>
            <p className="font-semibold text-gray-800">{name}</p>
            <p className="text-sm text-gray-500">{email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <Field label="Nama">
            <ReadOnly value={name} />
          </Field>
          <Field label="Email">
            <ReadOnly value={email} />
          </Field>
          <Field label="Jabatan">
            <input
              type="text"
              value={jabatan}
              onChange={(e) => setJabatan(e.target.value)}
              placeholder="cth. Plant Manager"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
            />
          </Field>
        </div>

        <div className="mt-5 flex items-center gap-1.5 text-xs text-gray-400">
          <AlertCircle size={12} />
          <span>Nama dan email dikelola melalui Microsoft Azure AD</span>
        </div>
      </Card>

      <div className="flex justify-end">
        <SaveButton onSave={onSave} />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function ReadOnly({ value }: { value: string }) {
  return (
    <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
      {value}
    </p>
  );
}

// ── Tampilan ──────────────────────────────────────────────────────────────────

function TampilanSection({
  display,
  setDisplay,
  onSave,
  onLangChange,
}: {
  display: DisplaySettings;
  setDisplay: (d: DisplaySettings) => void;
  onSave: () => void;
  onLangChange?: (lang: "id" | "en") => void;
}) {
  const set = (patch: Partial<DisplaySettings>) => setDisplay({ ...display, ...patch });

  return (
    <div className="space-y-5">
      <SectionTitle title="Tampilan" description="Preferensi tampilan dan filter default" />

      <Card title="Zona Waktu">
        <div className="grid grid-cols-3 gap-2">
          {(["WIB", "WITA", "WIT"] as const).map((tz) => (
            <button
              key={tz}
              onClick={() => set({ timezone: tz })}
              className={cn(
                "text-center py-3 rounded-xl border-2 transition-colors",
                display.timezone === tz
                  ? "border-brand-500 bg-brand-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <p
                className={cn(
                  "text-sm font-bold",
                  display.timezone === tz ? "text-brand-700" : "text-gray-700"
                )}
              >
                {tz}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {tz === "WIB" ? "UTC+7" : tz === "WITA" ? "UTC+8" : "UTC+9"}
              </p>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Bahasa / Language">
        <div className="grid grid-cols-2 gap-3">
          {([
            { value: "id" as const, label: "Bahasa Indonesia", flag: "🇮🇩", sub: "Indonesia" },
            { value: "en" as const, label: "English",           flag: "🇬🇧", sub: "United Kingdom" },
          ] as const).map(({ value, label, flag, sub }) => (
            <button
              key={value}
              onClick={() => { set({ language: value }); onLangChange?.(value); }}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-colors",
                display.language === value
                  ? "border-brand-500 bg-brand-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <span className="text-2xl leading-none">{flag}</span>
              <div>
                <p className={cn("text-sm font-semibold", display.language === value ? "text-brand-700" : "text-gray-700")}>
                  {label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Filter Default">
        <div className="space-y-4">
          <Field label="Plant Default">
            <select
              value={display.defaultPlant}
              onChange={(e) => set({ defaultPlant: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {["All Plant", "Plant 1", "Plant 2", "Plant 3", "Plant 4", "Plant 5", "Plant 6"].map(
                (p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                )
              )}
            </select>
          </Field>

          <Field label="Tampilan Data Default">
            <div className="flex gap-2">
              {(["Daily", "Hourly"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => set({ defaultDataLevel: level })}
                  className={cn(
                    "flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-colors",
                    display.defaultDataLevel === level
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  )}
                >
                  {level === "Daily" ? "Harian" : "Per Jam"}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <SaveButton onSave={onSave} />
      </div>
    </div>
  );
}

// ── AdminOnly ─────────────────────────────────────────────────────────────────

function AdminOnly({ title }: { title: string }) {
  return (
    <div className="space-y-5">
      <SectionTitle title={title} />
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Lock size={22} className="text-gray-400" />
        </div>
        <p className="text-sm font-semibold text-gray-800 mb-1">Akses Dibatasi</p>
        <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
          Hanya admin yang dapat mengubah pengaturan ini. Hubungi admin untuk meminta akses.
        </p>
      </div>
    </div>
  );
}

// ── AdminSection ──────────────────────────────────────────────────────────────

function AdminSection({
  admins,
  currentEmail,
  onSave,
}: {
  admins: string[];
  currentEmail: string;
  onSave: (list: string[]) => void;
}) {
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");

  const add = () => {
    const t = emailInput.trim().toLowerCase();
    if (!t) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
      setEmailError("Format email tidak valid");
      return;
    }
    if (admins.includes(t)) {
      setEmailError("Email sudah terdaftar sebagai admin");
      return;
    }
    onSave([...admins, t]);
    setEmailInput("");
    setEmailError("");
  };

  const remove = (email: string) => {
    if (admins.length <= 1) return;
    onSave(admins.filter((e) => e !== email));
  };

  return (
    <div className="space-y-5">
      <SectionTitle title="Admin" description="Kelola siapa saja yang memiliki akses admin" />

      <Card title="Daftar Admin">
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                placeholder="nama@paracorpgroup.com"
                value={emailInput}
                onChange={(e) => { setEmailInput(e.target.value); setEmailError(""); }}
                onKeyDown={(e) => e.key === "Enter" && add()}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              />
            </div>
            <button
              onClick={add}
              className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              <Plus size={14} />
              Tambah
            </button>
          </div>
          {emailError && <p className="text-xs text-red-500">{emailError}</p>}

          <ul className="space-y-2 mt-1">
            {admins.map((email) => (
              <li key={email} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-brand-600">{email[0].toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">{email}</p>
                    {email === currentEmail && (
                      <p className="text-xs text-brand-500 leading-none mt-0.5">Anda</p>
                    )}
                  </div>
                </div>
                {email !== currentEmail && (
                  <button
                    onClick={() => remove(email)}
                    disabled={admins.length <= 1}
                    className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30"
                    aria-label={`Hapus admin ${email}`}
                  >
                    <X size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
        <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 leading-relaxed">
          Data admin disimpan secara lokal di perangkat ini. Perubahan hanya berlaku pada browser dan perangkat yang sama.
        </p>
      </div>
    </div>
  );
}

// ── Notifikasi ────────────────────────────────────────────────────────────────

function NotifikasiSection({
  notif,
  setNotif,
  onSave,
}: {
  notif: NotifSettings;
  setNotif: (n: NotifSettings) => void;
  onSave: () => void;
}) {
  const set = (patch: Partial<NotifSettings>) => setNotif({ ...notif, ...patch });
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [testState, setTestState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");

  const addEmail = () => {
    const t = emailInput.trim().toLowerCase();
    if (!t) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
      setEmailError("Format email tidak valid");
      return;
    }
    if (notif.recipients.some((r) => r.email === t)) {
      setEmailError("Email sudah ditambahkan");
      return;
    }
    set({ recipients: [...notif.recipients, { email: t, kpis: { ...ALL_KPIS_ON } }] });
    setEmailInput("");
    setEmailError("");
  };

  const removeRecipient = (email: string) =>
    set({ recipients: notif.recipients.filter((r) => r.email !== email) });

  const toggleKpi = (email: string, kpi: KpiKey) =>
    set({
      recipients: notif.recipients.map((r) =>
        r.email === email ? { ...r, kpis: { ...r.kpis, [kpi]: !r.kpis[kpi] } } : r
      ),
    });

  const handleTest = async () => {
    if (!notif.recipients.length || testState === "loading") return;
    setTestState("loading");
    setTestMsg("");
    try {
      const res = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: notif.recipients.map((r) => r.email) }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal mengirim");
      setTestState("success");
      setTestMsg(`Email terkirim ke ${notif.recipients.length} penerima`);
      setTimeout(() => setTestState("idle"), 3500);
    } catch (err) {
      setTestMsg(err instanceof Error ? err.message : "Gagal mengirim");
      setTestState("error");
      setTimeout(() => setTestState("idle"), 6000);
    }
  };

  return (
    <div className="space-y-5">
      <SectionTitle title="Notifikasi" description="Konfigurasi pengiriman email saat alert terjadi" />

      {/* Master toggle */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Aktifkan Notifikasi Email</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Kirim email saat ada alert atau metrik bermasalah
            </p>
          </div>
          <Toggle checked={notif.enabled} onChange={(v) => set({ enabled: v })} />
        </div>
      </Card>

      <div className={cn("space-y-4", !notif.enabled && "opacity-40 pointer-events-none")}>
        {/* Recipients with per-recipient KPI chips */}
        <Card title="Penerima Email">
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  placeholder="nama@paracorpgroup.com"
                  value={emailInput}
                  onChange={(e) => { setEmailInput(e.target.value); setEmailError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && addEmail()}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                />
              </div>
              <button
                onClick={addEmail}
                className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
              >
                <Plus size={14} />
                Tambah
              </button>
            </div>
            {emailError && <p className="text-xs text-red-500">{emailError}</p>}

            {notif.recipients.length > 0 ? (
              <ul className="space-y-2">
                {notif.recipients.map((recipient) => (
                  <li key={recipient.email} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-sm font-medium text-gray-700">{recipient.email}</span>
                      <button
                        onClick={() => removeRecipient(recipient.email)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        aria-label={`Hapus ${recipient.email}`}
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(KPI_CHIPS) as KpiKey[]).map((kpi) => (
                        <button
                          key={kpi}
                          onClick={() => toggleKpi(recipient.email, kpi)}
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-full border transition-colors",
                            recipient.kpis[kpi]
                              ? "bg-brand-50 text-brand-700 border-brand-200"
                              : "bg-white text-gray-400 border-gray-200 line-through"
                          )}
                        >
                          {KPI_CHIPS[kpi]}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 text-center py-1">Belum ada penerima</p>
            )}
          </div>
        </Card>

        {/* Mode */}
        <Card title="Mode Pengiriman">
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "immediate" as const, label: "Langsung", desc: "Kirim segera saat alert muncul" },
              { value: "daily_digest" as const, label: "Ringkasan Harian", desc: "Kirim satu kali per hari" },
            ].map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => set({ mode: value })}
                className={cn(
                  "text-left p-4 rounded-xl border-2 transition-colors",
                  notif.mode === value ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-gray-300"
                )}
              >
                <p className={cn("text-sm font-semibold", notif.mode === value ? "text-brand-700" : "text-gray-700")}>
                  {label}
                </p>
                <p className="text-xs text-gray-500 mt-1">{desc}</p>
              </button>
            ))}
          </div>

          {notif.mode === "daily_digest" && (
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
              <Clock size={14} className="text-gray-400 shrink-0" />
              <span className="text-sm text-gray-600">Kirim setiap hari pukul</span>
              <input
                type="time"
                value={notif.digestTime}
                onChange={(e) => set({ digestTime: e.target.value })}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          )}
        </Card>

        {/* Test status messages */}
        {testState === "error" && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{testMsg || "Gagal mengirim. Pastikan RESEND_API_KEY sudah dikonfigurasi."}</span>
          </div>
        )}
        {testState === "success" && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
            <Check size={15} className="shrink-0" />
            <span>{testMsg}</span>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between pt-5 border-t border-gray-100">
        <button
          onClick={handleTest}
          disabled={!notif.enabled || !notif.recipients.length || testState === "loading"}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-all",
            !notif.enabled || !notif.recipients.length
              ? "border-gray-200 text-gray-400 cursor-not-allowed"
              : testState === "loading"
              ? "border-gray-200 text-gray-500 cursor-wait"
              : "border-gray-300 text-gray-700 hover:bg-gray-50"
          )}
        >
          {testState === "loading" ? (
            <><Loader2 size={14} className="animate-spin" />Mengirim...</>
          ) : (
            <><Send size={14} />Kirim Test Email</>
          )}
        </button>
        <SaveButton onSave={onSave} />
      </div>
    </div>
  );
}

// ── Alert & Threshold ─────────────────────────────────────────────────────────

function ThresholdSection({
  thresholds,
  setThresholds,
  onSave,
}: {
  thresholds: ThresholdSettings;
  setThresholds: (t: ThresholdSettings) => void;
  onSave: () => void;
}) {
  const upd = (kpi: keyof ThresholdSettings, field: string, value: number) =>
    setThresholds({
      ...thresholds,
      [kpi]: { ...(thresholds[kpi] as Record<string, number>), [field]: value },
    });

  const resetKpi = (kpi: keyof ThresholdSettings) =>
    setThresholds({ ...thresholds, [kpi]: DEFAULT_THRESHOLDS[kpi] });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between mb-6">
        <SectionTitle
          title="Alert & Threshold"
          description="Ambang batas yang memicu alert di dashboard dan email notifikasi"
        />
        <button
          onClick={() => setThresholds(DEFAULT_THRESHOLDS)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors shrink-0 mt-1"
        >
          <RotateCcw size={11} />
          Reset semua
        </button>
      </div>

      <div className="space-y-4">
        <ThresholdCard
          label="Lead Time"
          description="Lead time naik lebih dari X% vs periode sebelumnya"
          onReset={() => resetKpi("leadTime")}
        >
          <ThreshRow label="Peringatan" color="amber" desc="Naik lebih dari">
            <NumericInput value={thresholds.leadTime.warning} onChange={(v) => upd("leadTime", "warning", v)} unit="%" min={0} />
          </ThreshRow>
          <ThreshRow label="Kritis" color="red" desc="Naik lebih dari">
            <NumericInput value={thresholds.leadTime.critical} onChange={(v) => upd("leadTime", "critical", v)} unit="%" min={0} />
          </ThreshRow>
        </ThresholdCard>

        <ThresholdCard
          label="Bulk Loss"
          description="Bulk loss absolut melampaui X%"
          onReset={() => resetKpi("bulkLoss")}
        >
          <ThreshRow label="Peringatan" color="amber" desc="Di atas">
            <NumericInput value={thresholds.bulkLoss.absWarning} onChange={(v) => upd("bulkLoss", "absWarning", v)} unit="%" min={0} />
          </ThreshRow>
          <ThreshRow label="Kritis" color="red" desc="Di atas">
            <NumericInput value={thresholds.bulkLoss.absCritical} onChange={(v) => upd("bulkLoss", "absCritical", v)} unit="%" min={0} />
          </ThreshRow>
        </ThresholdCard>

        <ThresholdCard
          label="Pack Loss"
          description="Pack loss absolut melampaui X%"
          onReset={() => resetKpi("packLoss")}
        >
          <ThreshRow label="Peringatan" color="amber" desc="Di atas">
            <NumericInput value={thresholds.packLoss.absWarning} onChange={(v) => upd("packLoss", "absWarning", v)} unit="%" min={0} />
          </ThreshRow>
          <ThreshRow label="Kritis" color="red" desc="Di atas">
            <NumericInput value={thresholds.packLoss.absCritical} onChange={(v) => upd("packLoss", "absCritical", v)} unit="%" min={0} />
          </ThreshRow>
        </ThresholdCard>

        <ThresholdCard
          label="Right First Time"
          description="RFT % jatuh di bawah X%"
          onReset={() => resetKpi("rft")}
        >
          <ThreshRow label="Peringatan" color="amber" desc="Di bawah">
            <NumericInput value={thresholds.rft.warning} onChange={(v) => upd("rft", "warning", v)} unit="%" min={0} max={100} />
          </ThreshRow>
          <ThreshRow label="Kritis" color="red" desc="Di bawah">
            <NumericInput value={thresholds.rft.critical} onChange={(v) => upd("rft", "critical", v)} unit="%" min={0} max={100} />
          </ThreshRow>
        </ThresholdCard>

        <ThresholdCard
          label="OEE"
          description="OEE % jatuh di bawah X%"
          onReset={() => resetKpi("oee")}
        >
          <ThreshRow label="Peringatan" color="amber" desc="Di bawah">
            <NumericInput value={thresholds.oee.warning} onChange={(v) => upd("oee", "warning", v)} unit="%" min={0} max={100} />
          </ThreshRow>
          <ThreshRow label="Kritis" color="red" desc="Di bawah">
            <NumericInput value={thresholds.oee.critical} onChange={(v) => upd("oee", "critical", v)} unit="%" min={0} max={100} />
          </ThreshRow>
        </ThresholdCard>
      </div>

      <div className="flex justify-end pt-2">
        <SaveButton onSave={onSave} />
      </div>
    </div>
  );
}

function ThresholdCard({
  label,
  description,
  onReset,
  children,
}: {
  label: string;
  description: string;
  onReset: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="flex items-start justify-between px-5 py-3 border-b border-gray-100">
        <div>
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
        >
          <RotateCcw size={10} />
          Reset
        </button>
      </div>
      <div className="px-5 py-4 space-y-2.5">{children}</div>
    </div>
  );
}

function ThreshRow({
  label,
  color,
  desc,
  children,
}: {
  label: string;
  color: "amber" | "red";
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium w-20 shrink-0",
          color === "amber" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
        )}
      >
        {label}
      </span>
      <span className="text-xs text-gray-500 flex-1">{desc}</span>
      {children}
    </div>
  );
}

// ── Integrasi ─────────────────────────────────────────────────────────────────

function IntegrasiSection() {
  return (
    <div className="space-y-5">
      <SectionTitle title="Integrasi" description="Status koneksi ke sumber data eksternal" />

      <Card title="Snowflake Data Warehouse">
        <div className="mb-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Terhubung
          </span>
        </div>
        <div className="space-y-0">
          {[
            { label: "Account",   value: "yb58945.ap-southeast-3.aws" },
            { label: "Region",    value: "AP Southeast 3 (Jakarta)"    },
            { label: "Database",  value: "MIGRATION"                   },
            { label: "Schema",    value: "CONTROL_TOWER"               },
            { label: "Warehouse", value: "COMPUTE_WH"                  },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0"
            >
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {label}
              </span>
              <span className="text-sm text-gray-700 font-mono">{value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}