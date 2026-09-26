"use client";

import { Suspense, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "next-auth";
import {
  User, Monitor, Bell, SlidersHorizontal, Database,
  Plus, X, RotateCcw, Send, Check, Loader2, Mail, MessageSquare,
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

interface TeamsNotifSettings {
  enabled: boolean;
  recipients: RecipientConfig[];
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

// UI language is fixed to English (2026-09-26) — the language picker is hidden.
const SHOW_LANGUAGE_PICKER = false;

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

const DEFAULT_TEAMS_NOTIF: TeamsNotifSettings = {
  enabled: false,
  recipients: [],
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
  language: "en",
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

function loadTeamsNotif(): TeamsNotifSettings {
  try {
    const raw = localStorage.getItem("ct-teams-settings");
    if (!raw) return DEFAULT_TEAMS_NOTIF;
    const p = JSON.parse(raw) as Partial<TeamsNotifSettings & { recipients: (string | RecipientConfig)[] }>;
    const recipients: RecipientConfig[] = (p.recipients ?? []).map((r) =>
      typeof r === "string" ? { email: r, kpis: { ...ALL_KPIS_ON } } : r
    );
    return { ...DEFAULT_TEAMS_NOTIF, enabled: p.enabled ?? false, recipients };
  } catch { return DEFAULT_TEAMS_NOTIF; }
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
  const [teamsNotif, setTeamsNotif] = useState<TeamsNotifSettings>(DEFAULT_TEAMS_NOTIF);
  const [thresholds, setThresholds] = useState<ThresholdSettings>(DEFAULT_THRESHOLDS);
  const [display, setDisplay] = useState<DisplaySettings>(DEFAULT_DISPLAY);
  const [jabatan, setJabatan] = useState("");
  const [admins, setAdmins] = useState<string[]>([]);

  useEffect(() => {
    setNotif(loadNotif());
    setThresholds(loadThresholds());
    setDisplay(loadDisplay());
    setJabatan(localStorage.getItem("ct-user-jabatan") ?? "");

    // Load Teams settings from server so all devices stay in sync
    fetch("/api/settings/teams")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setTeamsNotif(data);
          localStorage.setItem("ct-teams-settings", JSON.stringify(data));
        } else {
          setTeamsNotif(loadTeamsNotif());
        }
      })
      .catch(() => setTeamsNotif(loadTeamsNotif()));
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
    <div className="flex-1 overflow-y-auto bg-slate-100">
      {/* Page header + horizontal tabs */}
      <div className="bg-slate-100 border-b border-slate-200 px-8 pt-7 pb-0">
        <h1 className="text-[20px] font-bold text-slate-900 leading-tight">Settings</h1>
        <p className="text-[12px] text-slate-500 mt-0.5 mb-4">
          Manage preferences, notifications, and alert thresholds for your dashboard.
        </p>
        <div className="flex gap-0.5">
          {SECTIONS
            .filter(({ id }) => id !== "admin" || isAdmin)
            .map(({ id, tKey, icon: Icon, adminOnly }) => {
              const locked = adminOnly && !isAdmin;
              return (
                <button
                  key={id}
                  onClick={() => go(id)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2.5 text-[12.5px] font-medium rounded-t-lg border-b-2 transition-colors",
                    active === id
                      ? "border-[#1e4076] text-[#1e4076] bg-white/70"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  )}
                >
                  <Icon size={13} />
                  {t(tKey)}
                  {locked && <Lock size={10} className="text-slate-300 shrink-0" />}
                </button>
              );
            })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-8 py-8">
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
                teamsNotif={teamsNotif}
                setTeamsNotif={setTeamsNotif}
                onSaveTeams={() => {
                  fetch("/api/settings/teams", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(teamsNotif),
                  }).catch(() => {});
                  localStorage.setItem("ct-teams-settings", JSON.stringify(teamsNotif));
                }}
              />
            ) : (
              <AdminOnly title="Notifications" />
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
  icon,
  iconBg,
  description,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  description?: string;
}) {
  return (
    <div className={cn("bg-white rounded-xl border border-slate-200 overflow-hidden", className)}>
      {(title || icon) && (
        <div className={cn("px-5 py-4 border-b border-slate-100", icon && "flex items-center gap-3")}>
          {icon && (
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: iconBg ?? "#EFF6FF" }}>
              {icon}
            </div>
          )}
          <div>
            {title && <p className="text-[13px] font-semibold text-slate-800">{title}</p>}
            {description && <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>}
          </div>
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
      {saved ? <><Check size={14} />Saved</> : "Save Changes"}
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
      {/* Gradient profile card */}
      <div
        className="rounded-xl border border-blue-200 px-6 py-5 flex items-center gap-4"
        style={{ background: "linear-gradient(135deg, #EFF6FF, #EEF2FF)" }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 text-xl font-bold"
          style={{ background: "linear-gradient(135deg, #DBEAFE, #E0E7FF)", color: "#1e4076" }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-[15px]">{name}</p>
          <p className="text-[12px] text-slate-500 mt-0.5">{email}</p>
        </div>
        {jabatan && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold shrink-0"
            style={{ background: "white", color: "#1e4076", border: "1px solid #BFDBFE" }}
          >
            <Shield size={11} />
            {jabatan}
          </div>
        )}
      </div>

      <Card
        title="Account Information"
        description="Managed by Azure Active Directory"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1e4076" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        }
        iconBg="#EFF6FF"
      >
        <div className="space-y-4">
          <Field label="Name">
            <ReadOnly value={name} />
          </Field>
          <Field label="Email">
            <ReadOnly value={email} />
          </Field>
          <Field label="Job Title">
            <input
              type="text"
              value={jabatan}
              onChange={(e) => setJabatan(e.target.value)}
              placeholder="e.g. Plant Manager"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
            />
          </Field>
        </div>

        <div className="mt-5 flex items-center gap-1.5 text-xs text-slate-400">
          <AlertCircle size={12} />
          <span>Name and email are managed through Microsoft Azure AD</span>
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
      <SectionTitle title="Display" description="Display preferences and default filters" />

      <Card title="Timezone">
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

      {/* Language picker hidden: UI language is fixed to English (2026-09-26). */}
      {SHOW_LANGUAGE_PICKER && (
      <Card title="Language">
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
      )}

      <Card title="Default Filters">
        <div className="space-y-4">
          <Field label="Default Plant">
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

          <Field label="Default Data View">
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
                  {level === "Daily" ? "Daily" : "Hourly"}
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
        <p className="text-sm font-semibold text-gray-800 mb-1">Access Restricted</p>
        <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
          Only admins can change these settings. Contact an admin to request access.
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
      setEmailError("Invalid email format");
      return;
    }
    if (admins.includes(t)) {
      setEmailError("This email is already an admin");
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
      <SectionTitle title="Admin" description="Manage who has admin access" />

      <Card title="Admin List">
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                placeholder="name@paracorpgroup.com"
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
              Add
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
                      <p className="text-xs text-brand-500 leading-none mt-0.5">You</p>
                    )}
                  </div>
                </div>
                {email !== currentEmail && (
                  <button
                    onClick={() => remove(email)}
                    disabled={admins.length <= 1}
                    className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30"
                    aria-label={`Remove admin ${email}`}
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
          Admin data is stored locally on this device. Changes only apply to this browser and device.
        </p>
      </div>
    </div>
  );
}

// ── Notifikasi ────────────────────────────────────────────────────────────────

function NotifikasiSection({
  notif, setNotif, onSave,
  teamsNotif, setTeamsNotif, onSaveTeams,
}: {
  notif: NotifSettings;
  setNotif: (n: NotifSettings) => void;
  onSave: () => void;
  teamsNotif: TeamsNotifSettings;
  setTeamsNotif: (n: TeamsNotifSettings) => void;
  onSaveTeams: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"email" | "teams">("email");
  return (
    <div className="space-y-5">
      <SectionTitle title="Notifications" description="Configure how notifications are sent when alerts fire" />
      <div className="flex rounded-lg border border-gray-100 bg-gray-50 p-1 gap-1">
        {(["email", "teams"] as const).map((tab) => {
          const Icon = tab === "email" ? Mail : MessageSquare;
          const label = tab === "email" ? "Email" : "Microsoft Teams";
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors",
                activeTab === tab
                  ? "bg-white text-gray-800 shadow-sm border border-gray-100"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </div>
      {activeTab === "email" ? (
        <EmailTab notif={notif} setNotif={setNotif} onSave={onSave} />
      ) : (
        <TeamsTab teamsNotif={teamsNotif} setTeamsNotif={setTeamsNotif} onSave={onSaveTeams} />
      )}
    </div>
  );
}

function EmailTab({
  notif, setNotif, onSave,
}: {
  notif: NotifSettings;
  setNotif: (n: NotifSettings) => void;
  onSave: () => void;
}) {
  const set = (patch: Partial<NotifSettings>) => setNotif({ ...notif, ...patch });

  // Auto-persist the enabled toggle immediately so it survives page refresh
  const setEnabled = (v: boolean) => {
    const updated = { ...notif, enabled: v };
    setNotif(updated);
    localStorage.setItem("ct-notification-settings", JSON.stringify(updated));
  };
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [testState, setTestState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");

  const addEmail = () => {
    const t = emailInput.trim().toLowerCase();
    if (!t) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
      setEmailError("Invalid email format");
      return;
    }
    if (notif.recipients.some((r) => r.email === t)) {
      setEmailError("Email already added");
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
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      setTestState("success");
      setTestMsg(`Email sent to ${notif.recipients.length} recipient(s)`);
      setTimeout(() => setTestState("idle"), 3500);
    } catch (err) {
      setTestMsg(err instanceof Error ? err.message : "Failed to send");
      setTestState("error");
      setTimeout(() => setTestState("idle"), 6000);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Enable Email Notifications</p>
            <p className="text-xs text-gray-500 mt-0.5">Send an email when an alert fires or a metric needs attention</p>
          </div>
          <Toggle checked={notif.enabled} onChange={setEnabled} />
        </div>
      </Card>

      <div className={cn("space-y-4", !notif.enabled && "opacity-40 pointer-events-none")}>
        <Card title="Email Recipients">
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  placeholder="name@paracorpgroup.com"
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
                Add
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
                        aria-label={`Remove ${recipient.email}`}
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
              <p className="text-sm text-gray-400 text-center py-1">No recipients yet</p>
            )}
          </div>
        </Card>

        <Card title="Delivery Mode">
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "immediate" as const, label: "Immediate", desc: "Send as soon as an alert fires" },
              { value: "daily_digest" as const, label: "Daily Digest", desc: "Send once per day" },
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
              <span className="text-sm text-gray-600">Send every day at</span>
              <input
                type="time"
                value={notif.digestTime}
                onChange={(e) => set({ digestTime: e.target.value })}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          )}
        </Card>

        {testState === "error" && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{testMsg || "Failed to send. Make sure RESEND_API_KEY is configured."}</span>
          </div>
        )}
        {testState === "success" && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
            <Check size={15} className="shrink-0" />
            <span>{testMsg}</span>
          </div>
        )}
      </div>

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
            <><Loader2 size={14} className="animate-spin" />Sending…</>
          ) : (
            <><Send size={14} />Send Test Email</>
          )}
        </button>
        <SaveButton onSave={onSave} />
      </div>
    </div>
  );
}

function TeamsTab({
  teamsNotif, setTeamsNotif, onSave,
}: {
  teamsNotif: TeamsNotifSettings;
  setTeamsNotif: (n: TeamsNotifSettings) => void;
  onSave: () => void;
}) {
  const set = (patch: Partial<TeamsNotifSettings>) => setTeamsNotif({ ...teamsNotif, ...patch });

  // Persist enabled toggle immediately to server + localStorage cache
  const setEnabled = (v: boolean) => {
    const updated = { ...teamsNotif, enabled: v };
    setTeamsNotif(updated);
    localStorage.setItem("ct-teams-settings", JSON.stringify(updated));
    fetch("/api/settings/teams", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    }).catch(() => {});
  };
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [testState, setTestState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");

  const addEmail = () => {
    const t = emailInput.trim().toLowerCase();
    if (!t) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
      setEmailError("Invalid email format");
      return;
    }
    if (teamsNotif.recipients.some((r) => r.email === t)) {
      setEmailError("Email already added");
      return;
    }
    set({ recipients: [...teamsNotif.recipients, { email: t, kpis: { ...ALL_KPIS_ON } }] });
    setEmailInput("");
    setEmailError("");
  };

  const removeRecipient = (email: string) =>
    set({ recipients: teamsNotif.recipients.filter((r) => r.email !== email) });

  const toggleKpi = (email: string, kpi: KpiKey) =>
    set({
      recipients: teamsNotif.recipients.map((r) =>
        r.email === email ? { ...r, kpis: { ...r.kpis, [kpi]: !r.kpis[kpi] } } : r
      ),
    });

  const handleTest = async () => {
    if (testState === "loading") return;
    setTestState("loading");
    setTestMsg("");
    try {
      const recipients = teamsNotif.recipients.length > 0 ? teamsNotif.recipients : undefined;
      const res = await fetch("/api/notifications/teams/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; hint?: string; sent?: number };
      if (!res.ok) {
        const hint = data.hint === "sign-out-signin"
          ? " Try signing out and back in to refresh Teams permissions."
          : "";
        throw new Error((data.error ?? "Failed to send") + hint);
      }
      const count = data.sent ?? teamsNotif.recipients.length;
      setTestState("success");
      setTestMsg(`Test message sent to ${count} recipient(s)`);
      setTimeout(() => setTestState("idle"), 3500);
    } catch (err) {
      setTestMsg(err instanceof Error ? err.message : "Failed to send");
      setTestState("error");
      setTimeout(() => setTestState("idle"), 6000);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Enable Teams Notifications</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Send a Teams DM when an alert fires, for the metrics each recipient selects
            </p>
          </div>
          <Toggle checked={teamsNotif.enabled} onChange={setEnabled} />
        </div>
      </Card>

      <div className={cn("space-y-4", !teamsNotif.enabled && "opacity-40 pointer-events-none")}>
        <Card title="Teams Recipients">
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MessageSquare size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  placeholder="name@paracorpgroup.com"
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
                Add
              </button>
            </div>
            {emailError && <p className="text-xs text-red-500">{emailError}</p>}
            {teamsNotif.recipients.length > 0 ? (
              <ul className="space-y-2">
                {teamsNotif.recipients.map((recipient) => (
                  <li key={recipient.email} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-sm font-medium text-gray-700">{recipient.email}</span>
                      <button
                        onClick={() => removeRecipient(recipient.email)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        aria-label={`Remove ${recipient.email}`}
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
              <p className="text-sm text-gray-400 text-center py-1">No recipients yet</p>
            )}
          </div>
        </Card>

        <div className="flex items-start gap-2.5 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
          <MessageSquare size={14} className="text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-700 leading-relaxed">
            Alerts are sent as soon as they fire. Each recipient only gets DMs for the metrics they select.
          </p>
        </div>

        {testState === "error" && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{testMsg || "Failed to send. Make sure TEAMS_REFRESH_TOKEN is configured in Vercel."}</span>
          </div>
        )}
        {testState === "success" && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
            <Check size={15} className="shrink-0" />
            <span>{testMsg}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-5 border-t border-gray-100">
        <button
          onClick={handleTest}
          disabled={testState === "loading"}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-all",
            testState === "loading"
              ? "border-gray-200 text-gray-500 cursor-wait"
              : "border-gray-300 text-gray-700 hover:bg-gray-50"
          )}
        >
          {testState === "loading" ? (
            <><Loader2 size={14} className="animate-spin" />Sending…</>
          ) : (
            <><Send size={14} />Send Test Teams Message</>
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
          description="Thresholds that trigger alerts on the dashboard and in email notifications"
        />
        <button
          onClick={() => setThresholds(DEFAULT_THRESHOLDS)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors shrink-0 mt-1"
        >
          <RotateCcw size={11} />
          Reset all
        </button>
      </div>

      <div className="space-y-4">
        <ThresholdCard
          label="Lead Time"
          description="Lead time rises more than X% vs prior period"
          onReset={() => resetKpi("leadTime")}
        >
          <ThreshRow label="Warning" color="amber" desc="Rises more than">
            <NumericInput value={thresholds.leadTime.warning} onChange={(v) => upd("leadTime", "warning", v)} unit="%" min={0} />
          </ThreshRow>
          <ThreshRow label="Critical" color="red" desc="Rises more than">
            <NumericInput value={thresholds.leadTime.critical} onChange={(v) => upd("leadTime", "critical", v)} unit="%" min={0} />
          </ThreshRow>
        </ThresholdCard>

        <ThresholdCard
          label="Bulk Loss"
          description="Absolute bulk loss exceeds X%"
          onReset={() => resetKpi("bulkLoss")}
        >
          <ThreshRow label="Warning" color="amber" desc="Above">
            <NumericInput value={thresholds.bulkLoss.absWarning} onChange={(v) => upd("bulkLoss", "absWarning", v)} unit="%" min={0} />
          </ThreshRow>
          <ThreshRow label="Critical" color="red" desc="Above">
            <NumericInput value={thresholds.bulkLoss.absCritical} onChange={(v) => upd("bulkLoss", "absCritical", v)} unit="%" min={0} />
          </ThreshRow>
        </ThresholdCard>

        <ThresholdCard
          label="Pack Loss"
          description="Absolute pack loss exceeds X%"
          onReset={() => resetKpi("packLoss")}
        >
          <ThreshRow label="Warning" color="amber" desc="Above">
            <NumericInput value={thresholds.packLoss.absWarning} onChange={(v) => upd("packLoss", "absWarning", v)} unit="%" min={0} />
          </ThreshRow>
          <ThreshRow label="Critical" color="red" desc="Above">
            <NumericInput value={thresholds.packLoss.absCritical} onChange={(v) => upd("packLoss", "absCritical", v)} unit="%" min={0} />
          </ThreshRow>
        </ThresholdCard>

        <ThresholdCard
          label="Right First Time"
          description="RFT % falls below X%"
          onReset={() => resetKpi("rft")}
        >
          <ThreshRow label="Warning" color="amber" desc="Below">
            <NumericInput value={thresholds.rft.warning} onChange={(v) => upd("rft", "warning", v)} unit="%" min={0} max={100} />
          </ThreshRow>
          <ThreshRow label="Critical" color="red" desc="Below">
            <NumericInput value={thresholds.rft.critical} onChange={(v) => upd("rft", "critical", v)} unit="%" min={0} max={100} />
          </ThreshRow>
        </ThresholdCard>

        <ThresholdCard
          label="OEE"
          description="OEE % falls below X%"
          onReset={() => resetKpi("oee")}
        >
          <ThreshRow label="Warning" color="amber" desc="Below">
            <NumericInput value={thresholds.oee.warning} onChange={(v) => upd("oee", "warning", v)} unit="%" min={0} max={100} />
          </ThreshRow>
          <ThreshRow label="Critical" color="red" desc="Below">
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
      <SectionTitle title="Integrations" description="Connection status for external data sources" />

      <Card title="Snowflake Data Warehouse">
        <div className="mb-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Connected
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