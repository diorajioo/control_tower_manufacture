"use client";

import { LayoutGrid, Factory, CheckCircle2, Zap, FileText, Settings, LogOut, BarChart3 } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  return (
    <aside className="w-56 min-h-screen bg-[#f0eeff] flex flex-col shrink-0 border-r border-purple-100">
      <div className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div className="bg-brand-600 p-1.5 rounded-lg shadow-sm">
            <LayoutGrid size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">Control Tower</p>
            <p className="text-xs text-gray-400 leading-tight">Manufacture</p>
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

      <div className="px-3 py-4 border-t border-purple-100 flex flex-col gap-0.5">
        <NavItem icon={Settings} label="Settings" />
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-400 hover:text-red-600 hover:bg-red-50 transition-colors w-full text-left"
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
          ? "bg-brand-600 text-white shadow-sm"
          : "text-indigo-400 hover:text-purple-900 hover:bg-purple-100"
      )}
    >
      <Icon size={16} />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
