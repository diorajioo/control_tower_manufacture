"use client";

// Sidebar hidden / shown — one state for every page, remembered in localStorage.
// Only the menu collapses (animated); the navy logo block with the toggle button is ONE fixed element in the
// top-left corner that never moves. State = html[data-sidebar="collapsed"], set before the first paint by
// app/layout.tsx; the CSS in app/globals.css animates the sidebar width and, with the same duration and easing,
// the top bar's left padding, so the top bar content stays still while the menu slides away.

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "ct-sidebar-collapsed";

export function setSidebarCollapsed(collapsed: boolean) {
  try { localStorage.setItem(KEY, collapsed ? "1" : "0"); } catch { /* this page view only */ }
  if (collapsed) document.documentElement.dataset.sidebar = "collapsed";
  else delete document.documentElement.dataset.sidebar;
}

const isCollapsed = () => document.documentElement.dataset.sidebar === "collapsed";

/** 224 × 52 navy block fixed top-left: hide/show button (left of the logo) + Paragon Corp logo. Rendered once, by the Sidebar. */
export function SidebarBrand({ className }: { className?: string }) {
  return (
    <div className={cn("fixed top-0 left-0 z-40 w-56 h-[52px] flex items-center gap-2 pl-2 pr-4 bg-[#1E4076]", className)}>
      <button
        onClick={() => setSidebarCollapsed(!isCollapsed())}
        aria-label="Show or hide sidebar"
        title="Show or hide sidebar"
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white/75 hover:text-white hover:bg-white/15 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        {/* Icon follows the state through CSS (.ct-icon-*), no re-render needed */}
        <PanelLeftClose size={17} strokeWidth={1.75} className="ct-icon-close" />
        <PanelLeftOpen size={17} strokeWidth={1.75} className="ct-icon-open" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/paragon-corp-white.e705509b.png" alt="Paragon Corp" className="w-36 h-auto" />
    </div>
  );
}
