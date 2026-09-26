"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid, Bell, Timer, Package, User, ShieldCheck, Zap, Gauge, Route,
  FileText, Sparkles, Settings, UserCog, GraduationCap, LogOut, type LucideIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { computeAlerts } from "@/lib/alerts";

const INACTIVITY_MS = 15 * 60 * 1000;

type NavItem = {
  icon: LucideIcon;
  label: string;
  /** No href = page not built yet → looks and hovers like a link, but clicking does nothing */
  href?: string;
  badge?: "alerts" | "beta";
  accent?: boolean;
};

// Groups are separated by a divider. Items without href have no page yet.
const NAV_GROUPS: NavItem[][] = [
  [
    { icon: LayoutGrid, label: "Overview",     href: "/dashboard" },
    { icon: Bell,       label: "Alert Center", badge: "alerts" },
  ],
  [
    { icon: Timer,       label: "Lead Time",           href: "/lead-time" },
    { icon: Package,     label: "Output" },
    { icon: User,        label: "Productivity" },
    { icon: ShieldCheck, label: "Yield" },
    { icon: Zap,         label: "Energy" },
    { icon: Gauge,       label: "OEE" },
    { icon: Route,       label: "Root Cause Analysis" },
  ],
  [
    { icon: FileText, label: "Reports" },
    { icon: Sparkles, label: "AI Fusion", badge: "beta", accent: true },
  ],
];

const FOOTER_ITEMS: NavItem[] = [
  { icon: Settings,      label: "Settings",        href: "/dashboard/settings" },
  { icon: UserCog,       label: "User Management" },
  { icon: GraduationCap, label: "Guide" },
];

/** Active alert count for the user's current filters — same source as the Overview alerts. */
function useAlertCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let f = {
      plant:     "All Plant",
      startDate: `${new Date().getFullYear()}-01-01`,
      endDate:   new Date().toISOString().split("T")[0],
      period:    "YTD",
    };
    try {
      const stored = localStorage.getItem("ct-filters");
      if (stored) f = { ...f, ...JSON.parse(stored) };
    } catch { /* ignore */ }
    const params = new URLSearchParams({ plant: f.plant, startDate: f.startDate, endDate: f.endDate, period: f.period });
    fetch(`/api/dashboard/kpi?${params}`)
      .then((r) => r.json())
      .then((k) => {
        if (!k?.leadTime) return;
        setCount(computeAlerts({
          leadTime:       { value: k.leadTime?.grossDays ?? 0, trend: k.leadTime?.grossTrend ?? null },
          yield:          { bulkLossPct: k.yield?.bulkLossPct ?? 0, packLossPct: k.yield?.packLossPct ?? 0, bulkLossTrend: k.yield?.bulkLossTrend ?? null, packLossTrend: k.yield?.packLossTrend ?? null },
          rightFirstTime: { value: k.rightFirstTime?.value ?? 100, trend: k.rightFirstTime?.trend ?? null },
          oee:            { value: k.oee?.value ?? 100, trend: k.oee?.trend ?? null },
        }).length);
      })
      .catch(() => { /* no badge */ });
  }, []);
  return count;
}

function NavRow({ item, pathname, alertCount }: { item: NavItem; pathname: string | null; alertCount: number }) {
  const { icon: Icon, label, href, badge, accent } = item;
  const active = href === "/dashboard"
    ? pathname === "/dashboard"
    : !!href && (pathname === href || (pathname?.startsWith(href + "/") ?? false));

  const content = (
    <>
      <Icon size={15} strokeWidth={active ? 2 : 1.6} className="shrink-0" />
      <span className={cn("text-[13px] flex-1 leading-none truncate", active ? "font-bold" : "font-normal")}>
        {label}
      </span>
      {badge === "alerts" && alertCount > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-[5px] border border-[#fbd5d1] bg-[#fef4f3] text-[#d92d20] text-[10px] font-bold leading-none flex items-center justify-center tabular-nums">
          {alertCount}
        </span>
      )}
      {badge === "beta" && (
        <span className="px-1.5 py-[3px] rounded-[5px] bg-[#f1ecfd] text-[#6d3fd6] text-[9px] font-bold tracking-[0.08em] leading-none">
          BETA
        </span>
      )}
    </>
  );

  const base = "flex items-center gap-2.5 px-2.5 py-2 rounded-lg w-full";

  if (!href) {
    return (
      <div
        title="Coming soon"
        aria-disabled="true"
        className={cn(
          base, "cursor-default select-none transition-colors duration-150",
          accent ? "text-[#6d3fd6] hover:bg-[#f7f4fe]" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        base, "transition-colors duration-150",
        active ? "bg-[#E9EFF8] text-[#143665]" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
      )}
    >
      {content}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const alertCount = useAlertCount();
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
    <aside className="w-56 h-screen bg-white flex flex-col shrink-0 border-r border-slate-200 overflow-hidden">
      {/* Logo */}
      {/* Height = full Header (top bar + filter row, published by Header as --app-header-h) so the
          nav starts level with the page content. No bottom border. */}
      <div
        className="shrink-0 px-4 flex items-center"
        style={{ height: "var(--app-header-h, 101px)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/paragon-corp.98d5977b.png" alt="Paragon Corp" className="w-full h-auto" />
      </div>

      <nav className="px-2.5 pt-3 flex flex-col flex-1 overflow-y-auto">
        {NAV_GROUPS.map((group, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {i > 0 && <div className="h-px bg-slate-100 my-2.5 mx-1" />}
            {group.map((item) => (
              <NavRow key={item.label} item={item} pathname={pathname} alertCount={alertCount} />
            ))}
          </div>
        ))}
      </nav>

      <div className="px-2.5 pb-4 flex flex-col gap-0.5">
        <div className="h-px bg-slate-100 mb-2 mx-1" />
        {FOOTER_ITEMS.map((item) => (
          <NavRow key={item.label} item={item} pathname={pathname} alertCount={alertCount} />
        ))}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-150 w-full text-left"
        >
          <LogOut size={15} strokeWidth={1.6} className="shrink-0" />
          <span className="text-[13px] leading-none">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
