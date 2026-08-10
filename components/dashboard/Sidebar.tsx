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
  { icon: BarChart3, tKey: "nav_overview", href: "/dashboard" },
  { icon: Factory, tKey: "nav_production", href: "/dashboard/production" },
  { icon: CheckCircle2, tKey: "nav_quality", href: "/dashboard/quality" },
  { icon: Zap, tKey: "nav_energy", href: "/dashboard/energy" },
  { icon: FileText, tKey: "nav_reports", href: "/dashboard/reports" },
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
    <aside className="w-56 min-h-screen bg-brand-900 flex flex-col shrink-0 border-r border-brand-800">
      <div className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div className="bg-brand-600 p-2 rounded-xl shadow-sm">
            <Factory size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">Control Tower</p>
            <p className="text-xs text-brand-300 leading-tight">Manufacture</p>
          </div>
        </div>
      </div>

      <nav className="px-3 py-2 flex flex-col gap-0.5 flex-1">
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

      <div className="px-3 py-4 border-t border-brand-700/50 flex flex-col gap-0.5">
        <NavItem
          icon={Settings}
          label={t("nav_settings")}
          href="/dashboard/settings"
          active={pathname === "/dashboard/settings"}
        />
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-brand-300/60 hover:text-red-300 hover:bg-red-900/30 transition-colors w-full text-left"
        >
          <LogOut size={16} />
          <span className="text-sm font-medium">{t("nav_signout")}</span>
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
        "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors w-full",
        active
          ? "bg-white/10 text-white ring-1 ring-white/10"
          : "text-brand-200/60 hover:text-white hover:bg-white/10"
      )}
    >
      <Icon size={16} />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}