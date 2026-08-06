"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Bell, Mail, Plus, X, RotateCcw, Send, ChevronDown, ChevronUp, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThresholdSet {
  leadTime: { warning: number; critical: number };
  bulkLoss: { absWarning: number; absCritical: number };
  packLoss: { absWarning: number; absCritical: number };
  rft: { warning: number; critical: number };
  oee: { warning: number; critical: number };
}

interface NotificationSettings {
  enabled: boolean;
  recipients: string[];
  mode: "immediate" | "daily_digest";
  kpis: {
    leadTime: boolean;
    bulkLoss: boolean;
    packLoss: boolean;
    rft: boolean;
    oee: boolean;
  };
  thresholds: ThresholdSet;
}

const DEFAULT_THRESHOLDS: ThresholdSet = {
  leadTime: { warning: 5, critical: 15 },
  bulkLoss: { absWarning: 3, absCritical: 5 },
  packLoss: { absWarning: 1, absCritical: 2 },
  rft: { warning: 95, critical: 90 },
  oee: { warning: 65, critical: 55 },
};

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  recipients: [],
  mode: "immediate",
  kpis: { leadTime: true, bulkLoss: true, packLoss: true, rft: true, oee: true },
  thresholds: DEFAULT_THRESHOLDS,
};

const STORAGE_KEY = "ct-notification-settings";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
        checked ? "bg-brand-600" : "bg-gray-200"
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4.5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{children}</h2>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white rounded-xl border border-gray-100 p-5", className)}>
      {children}
    </div>
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
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) onChange(n);
        }}
        className="w-16 text-sm text-center border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
      />
      {unit && <span className="text-xs text-gray-400">{unit}</span>}
    </div>
  );
}

const KPI_LABELS: Record<keyof NotificationSettings["kpis"], string> = {
  leadTime: "Lead Time",
  bulkLoss: "Bulk Loss",
  packLoss: "Pack Loss",
  rft: "Right First Time",
  oee: "OEE",
};

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [saved, setSaved] = useState(false);
  const [expandedKpi, setExpandedKpi] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
        setSettings((prev) => ({
          ...prev,
          ...parsed,
          thresholds: { ...DEFAULT_THRESHOLDS, ...parsed.thresholds },
          kpis: { ...prev.kpis, ...parsed.kpis },
        }));
      }
    } catch {
      // ignore
    }
  }, []);

  const save = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [settings]);

  const update = (patch: Partial<NotificationSettings>) =>
    setSettings((prev) => ({ ...prev, ...patch }));

  const addEmail = () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Format email tidak valid");
      return;
    }
    if (settings.recipients.includes(trimmed)) {
      setEmailError("Email sudah ditambahkan");
      return;
    }
    update({ recipients: [...settings.recipients, trimmed] });
    setEmailInput("");
    setEmailError("");
  };

  const removeEmail = (email: string) =>
    update({ recipients: settings.recipients.filter((r) => r !== email) });

  const updateThreshold = (
    kpi: keyof ThresholdSet,
    field: string,
    value: number
  ) => {
    setSettings((prev) => ({
      ...prev,
      thresholds: {
        ...prev.thresholds,
        [kpi]: { ...(prev.thresholds[kpi] as Record<string, number>), [field]: value },
      },
    }));
  };

  const resetThreshold = (kpi: keyof ThresholdSet) => {
    setSettings((prev) => ({
      ...prev,
      thresholds: { ...prev.thresholds, [kpi]: DEFAULT_THRESHOLDS[kpi] },
    }));
  };

  if (status === "loading") return null;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-800">Pengaturan</h1>
        <p className="text-sm text-gray-500 mt-0.5">Konfigurasi notifikasi dan ambang batas alert</p>
      </div>

      {/* Notification master toggle */}
      <section>
        <SectionHeader>Notifikasi Email</SectionHeader>
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-50 rounded-lg">
                <Bell size={16} className="text-brand-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Aktifkan Notifikasi</p>
                <p className="text-xs text-gray-500 mt-0.5">Kirim email saat ada alert atau metrik bermasalah</p>
              </div>
            </div>
            <Toggle checked={settings.enabled} onChange={(v) => update({ enabled: v })} />
          </div>
        </Card>
      </section>

      {/* Recipients */}
      <section className={cn(!settings.enabled && "opacity-40 pointer-events-none")}>
        <SectionHeader>Penerima Email</SectionHeader>
        <Card className="space-y-4">
          {/* Add email input */}
          <div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  placeholder="nama@perusahaan.com"
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
            {emailError && <p className="text-xs text-red-500 mt-1.5">{emailError}</p>}
          </div>

          {/* Recipient list */}
          {settings.recipients.length > 0 ? (
            <ul className="space-y-2">
              {settings.recipients.map((email) => (
                <li key={email} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-700">{email}</span>
                  <button
                    onClick={() => removeEmail(email)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    aria-label={`Hapus ${email}`}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 text-center py-2">Belum ada penerima ditambahkan</p>
          )}
        </Card>
      </section>

      {/* Delivery mode */}
      <section className={cn(!settings.enabled && "opacity-40 pointer-events-none")}>
        <SectionHeader>Mode Pengiriman</SectionHeader>
        <Card>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "immediate" as const, label: "Langsung", desc: "Kirim segera saat alert muncul" },
              { value: "daily_digest" as const, label: "Ringkasan Harian", desc: "Kirim sekali per hari pukul 07.00" },
            ].map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => update({ mode: value })}
                className={cn(
                  "text-left p-3.5 rounded-xl border-2 transition-colors",
                  settings.mode === value
                    ? "border-brand-500 bg-brand-50"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                )}
              >
                <p className={cn("text-sm font-semibold", settings.mode === value ? "text-brand-700" : "text-gray-700")}>
                  {label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        </Card>
      </section>

      {/* KPI toggles + thresholds */}
      <section className={cn(!settings.enabled && "opacity-40 pointer-events-none")}>
        <SectionHeader>KPI & Ambang Batas</SectionHeader>
        <div className="space-y-2">
          {(Object.keys(KPI_LABELS) as Array<keyof NotificationSettings["kpis"]>).map((kpi) => {
            const isOn = settings.kpis[kpi];
            const isExpanded = expandedKpi === kpi;

            return (
              <Card key={kpi} className="p-0 overflow-hidden">
                {/* KPI row */}
                <div className="flex items-center gap-3 px-5 py-3.5">
                  <Toggle
                    checked={isOn}
                    onChange={(v) => update({ kpis: { ...settings.kpis, [kpi]: v } })}
                  />
                  <span className={cn("text-sm font-medium flex-1", isOn ? "text-gray-800" : "text-gray-400")}>
                    {KPI_LABELS[kpi]}
                  </span>
                  <button
                    onClick={() => setExpandedKpi(isExpanded ? null : kpi)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <span>Ambang batas</span>
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>

                {/* Threshold editor */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/60 space-y-3">
                    <ThresholdEditor
                      kpi={kpi}
                      thresholds={settings.thresholds}
                      onUpdate={updateThreshold}
                    />
                    <button
                      onClick={() => resetThreshold(kpi)}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <RotateCcw size={11} />
                      Reset ke default
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* Action bar */}
      <div className="flex items-center justify-between pt-2 pb-8">
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed"
          title="Backend belum tersedia"
        >
          <Send size={14} />
          Kirim Test Email
        </button>
        <button
          onClick={save}
          className={cn(
            "flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-all",
            saved
              ? "bg-green-500 text-white"
              : "bg-brand-600 text-white hover:bg-brand-700"
          )}
        >
          {saved ? (
            <>
              <Check size={14} />
              Tersimpan
            </>
          ) : (
            "Simpan Pengaturan"
          )}
        </button>
      </div>
    </div>
  );
}

function ThresholdEditor({
  kpi,
  thresholds,
  onUpdate,
}: {
  kpi: keyof NotificationSettings["kpis"];
  thresholds: ThresholdSet;
  onUpdate: (kpi: keyof ThresholdSet, field: string, value: number) => void;
}) {
  if (kpi === "leadTime") {
    return (
      <div className="space-y-2">
        <ThresholdRow
          label="Peringatan"
          color="amber"
          description="Lead time naik >"
        >
          <NumericInput
            value={thresholds.leadTime.warning}
            onChange={(v) => onUpdate("leadTime", "warning", v)}
            unit="%"
            min={0}
          />
        </ThresholdRow>
        <ThresholdRow
          label="Kritis"
          color="red"
          description="Lead time naik >"
        >
          <NumericInput
            value={thresholds.leadTime.critical}
            onChange={(v) => onUpdate("leadTime", "critical", v)}
            unit="%"
            min={0}
          />
        </ThresholdRow>
      </div>
    );
  }

  if (kpi === "bulkLoss") {
    return (
      <div className="space-y-2">
        <ThresholdRow label="Peringatan" color="amber" description="Bulk loss >">
          <NumericInput
            value={thresholds.bulkLoss.absWarning}
            onChange={(v) => onUpdate("bulkLoss", "absWarning", v)}
            unit="%"
            min={0}
          />
        </ThresholdRow>
        <ThresholdRow label="Kritis" color="red" description="Bulk loss >">
          <NumericInput
            value={thresholds.bulkLoss.absCritical}
            onChange={(v) => onUpdate("bulkLoss", "absCritical", v)}
            unit="%"
            min={0}
          />
        </ThresholdRow>
      </div>
    );
  }

  if (kpi === "packLoss") {
    return (
      <div className="space-y-2">
        <ThresholdRow label="Peringatan" color="amber" description="Pack loss >">
          <NumericInput
            value={thresholds.packLoss.absWarning}
            onChange={(v) => onUpdate("packLoss", "absWarning", v)}
            unit="%"
            min={0}
          />
        </ThresholdRow>
        <ThresholdRow label="Kritis" color="red" description="Pack loss >">
          <NumericInput
            value={thresholds.packLoss.absCritical}
            onChange={(v) => onUpdate("packLoss", "absCritical", v)}
            unit="%"
            min={0}
          />
        </ThresholdRow>
      </div>
    );
  }

  if (kpi === "rft") {
    return (
      <div className="space-y-2">
        <ThresholdRow label="Peringatan" color="amber" description="RFT di bawah">
          <NumericInput
            value={thresholds.rft.warning}
            onChange={(v) => onUpdate("rft", "warning", v)}
            unit="%"
            min={0}
            max={100}
          />
        </ThresholdRow>
        <ThresholdRow label="Kritis" color="red" description="RFT di bawah">
          <NumericInput
            value={thresholds.rft.critical}
            onChange={(v) => onUpdate("rft", "critical", v)}
            unit="%"
            min={0}
            max={100}
          />
        </ThresholdRow>
      </div>
    );
  }

  if (kpi === "oee") {
    return (
      <div className="space-y-2">
        <ThresholdRow label="Peringatan" color="amber" description="OEE di bawah">
          <NumericInput
            value={thresholds.oee.warning}
            onChange={(v) => onUpdate("oee", "warning", v)}
            unit="%"
            min={0}
            max={100}
          />
        </ThresholdRow>
        <ThresholdRow label="Kritis" color="red" description="OEE di bawah">
          <NumericInput
            value={thresholds.oee.critical}
            onChange={(v) => onUpdate("oee", "critical", v)}
            unit="%"
            min={0}
            max={100}
          />
        </ThresholdRow>
      </div>
    );
  }

  return null;
}

function ThresholdRow({
  label,
  color,
  description,
  children,
}: {
  label: string;
  color: "amber" | "red";
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium w-20 justify-center",
          color === "amber" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
        )}
      >
        {label}
      </span>
      <span className="text-xs text-gray-500 flex-1">{description}</span>
      {children}
    </div>
  );
}