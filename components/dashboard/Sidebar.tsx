"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Factory, CheckCircle2, Zap, FileText, Settings, LogOut, BarChart3 } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const INACTIVITY_MS = 15 * 60 * 1000;

const NAV_ITEMS: { icon: React.ElementType; tKey: TranslationKey; href: string }[] = [
  { icon: BarChart3,    tKey: "nav_overview",   href: "/dashboard" },
  { icon: Factory,      tKey: "nav_production", href: "/dashboard/production" },
  { icon: CheckCircle2, tKey: "nav_quality",    href: "/dashboard/quality" },
  { icon: Zap,          tKey: "nav_energy",     href: "/dashboard/energy" },
  { icon: FileText,     tKey: "nav_reports",    href: "/dashboard/reports" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => signOut({ callbackUrl: "/login" }), INACTIVITY_MS);
    };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, []);

  return (
    <aside className="w-56 h-screen bg-[#0e0c1e] flex flex-col shrink-0 border-r border-white/[0.04] overflow-hidden">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-900/50 shrink-0">
            <Factory size={14} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-white leading-none tracking-tight">Control Tower</p>
            <p className="text-[11px] text-indigo-300/50 leading-none mt-0.5 tracking-wide">Manufacture</p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-white/[0.06] mb-4" />

      {/* Nav */}
      <nav className="px-3 flex flex-col gap-0.5 flex-1">
        <p className="text-[10px] font-semibold text-white/20 tracking-widest uppercase px-3 mb-2">Menu</p>
        {NAV_ITEMS.map(({ icon, tKey, href }) => (
          <NavItem
            key={href}
            icon={icon}
            label={t(tKey)}
            href={href}
            active={pathname === href}
          />
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-5">
        <div className="h-px bg-white/[0.06] mb-3" />
        <NavItem
          icon={Settings}
          label={t("nav_settings")}
          href="/dashboard/settings"
          active={pathname === "/dashboard/settings"}
        />
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-0.5 flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/25 hover:text-red-300 hover:bg-red-500/[0.08] transition-all duration-150 w-full text-left"
        >
          <LogOut size={14} strokeWidth={1.75} />
          <span className="text-[13px] font-medium">{t("nav_signout")}</span>
        </button>
      </div>
    </aside>
  );
}

function NavItem({
  icon: Icon,
  label,
  href,
  active,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 w-full group",
        active
          ? "bg-white/[0.09] text-white"
          : "text-white/35 hover:text-white/65 hover:bg-white/[0.05]"
      )}
    >
      <Icon
        size={14}
        strokeWidth={active ? 2.5 : 1.75}
        className="shrink-0"
      />
      <span className={cn("text-[13px] tracking-tight flex-1", active ? "font-semibold" : "font-medium")}>
        {label}
      </span>
      {active && (
        <span className="w-1 h-4 rounded-full bg-indigo-400/70 shrink-0" />
      )}
    </Link>
  );
}
