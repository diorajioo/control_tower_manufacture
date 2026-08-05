"use client";

import { LayoutGrid, Factory, CheckCircle2, Zap, FileText, Settings, LogOut, BarChart3 } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  return (
    <aside className="w-56 min-h-screen bg-brand-900 flex flex-col shrink-0 border-r border-brand-800">
      <div className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div className="bg-white/10 p-1.5 rounded-lg">
            <LayoutGrid size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">Control Tower</p>
            <p className="text-xs text-brand-300 leading-tight">Manufacture</p>
          </div>
        </div>
      </div>

      <nav className="px-3 py-2 flex flex-col gap-0.5 flex-1">
        <NavItem icon={BarChart3} label="Overview" active />
        <NavItem icon={Factory} label="Production" />
        <NavItem icon={CheckCircle2} label="Quality" />
        <NavItem icon={Zap} label="Energy" />
        <NavItem icon={FileText} label="Reports" />
      </nav>

      <div className="px-3 py-4 border-t border-brand-700/50 flex flex-col gap-0.5">
        <NavItem icon={Settings} label="Settings" />
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-brand-300/60 hover:text-red-300 hover:bg-red-900/30 transition-colors w-full text-left"
        >
          <LogOut size={16} />
          <span className="text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors w-full text-left",
        active
          ? "bg-white/10 text-white ring-1 ring-white/10"
          : "text-brand-200/60 hover:text-white hover:bg-white/10"
      )}
    >
      <Icon size={16} />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}