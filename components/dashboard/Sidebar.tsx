"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Clock, BarChart3, Users, Zap, Settings, LogOut, Activity } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const INACTIVITY_MS = 15 * 60 * 1000;


const NAV_ITEMS = [
  { icon: LayoutGrid, label: "Strategic",     href: "/dashboard" },
  { icon: Clock,      label: "Lead Time",    href: "/lead-time" },
  { icon: BarChart3,  label: "Output",       href: "/dashboard/output" },
  { icon: Users,      label: "Productivity", href: "/dashboard/productivity" },
  { icon: Activity,   label: "OEE",          href: "/dashboard/oee" },
  { icon: Zap,        label: "Energy",       href: "/dashboard/energy" },
] as const;

export function Sidebar() {
  const pathname = usePathname();
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
      <div className="px-4 pt-5 pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/paragon-corp.98d5977b.png" alt="Paragon Corp" className="w-full h-auto" />
      </div>

      <div className="mx-4 h-px bg-slate-100 mb-3" />

      <div className="px-4 mb-1.5">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em]">Menu</p>
      </div>

      <nav className="px-2.5 flex flex-col gap-0.5 flex-1">
        {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
          const active = href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === href || (pathname?.startsWith(href + "/") ?? false);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-2 px-2.5 py-[7px] rounded-[10px] transition-all duration-150 w-full",
                active
                  ? "bg-[#D3DEEE] text-[#143665]"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              )}
            >
              <Icon size={13} strokeWidth={active ? 2.25 : 1.75} className="shrink-0" />
              <span className={cn("text-[12.5px] tracking-tight flex-1 leading-none", active ? "font-semibold" : "font-medium")}>
                {label}
              </span>
              {active && <span className="w-[3px] h-3.5 rounded-full bg-[#215AA8] shrink-0" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-2.5 pb-4">
        <div className="h-px bg-slate-100 mb-2 mx-0.5" />
        <Link
          href="/dashboard/settings"
          className={cn(
            "relative flex items-center gap-2 px-2.5 py-[7px] rounded-[10px] transition-all duration-150 w-full",
            pathname === "/dashboard/settings"
              ? "bg-[#D3DEEE] text-[#143665]"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          )}
        >
          <Settings size={13} strokeWidth={pathname === "/dashboard/settings" ? 2.25 : 1.75} className="shrink-0" />
          <span className={cn("text-[12.5px] tracking-tight flex-1 leading-none", pathname === "/dashboard/settings" ? "font-semibold" : "font-medium")}>
            Settings
          </span>
          {pathname === "/dashboard/settings" && <span className="w-[3px] h-3.5 rounded-full bg-[#215AA8] shrink-0" />}
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-0.5 flex items-center gap-2 px-2.5 py-[7px] rounded-[10px] text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-150 w-full text-left"
        >
          <LogOut size={13} strokeWidth={1.75} />
          <span className="text-[12.5px] font-medium tracking-tight">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
