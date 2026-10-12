"use client";

import { useT } from "@zfunnel/i18n/react";
import { cn } from "@zfunnel/ui/lib/utils";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { SidebarNav } from "@/components/sidebar-nav";
import { useShell } from "./shell-provider";

/** Desktop sidebar: full width, or the icon-only rail when collapsed (remembered per browser). */
export function Sidebar({ switcher }: { switcher: React.ReactNode }) {
  const t = useT();
  const { workspaceSlug, collapsed, toggleCollapsed } = useShell();
  const Toggle = collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon;
  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col gap-4 overflow-y-auto border-e bg-sidebar transition-[width] duration-200 lg:flex",
        collapsed ? "w-16 px-2 py-4" : "w-64 p-4",
      )}
    >
      <div className={cn("flex items-center", collapsed ? "flex-col gap-3" : "gap-2")}>
        <Link href={`/${workspaceSlug}`} className={cn("py-1.5", collapsed ? "px-1" : "flex-1 px-2")}>
          <Logo className="text-[1.0625rem]" showText={!collapsed} />
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={t(collapsed ? "topbar.expandSidebar" : "topbar.collapseSidebar")}
          aria-pressed={collapsed}
          data-sidebar-toggle
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-brand-navy/[0.04] hover:text-foreground dark:hover:bg-white/[0.05]"
        >
          <Toggle className="size-4 rtl:-scale-x-100" />
        </button>
      </div>
      {!collapsed && switcher}
      <SidebarNav workspaceSlug={workspaceSlug} compact={collapsed} />
    </aside>
  );
}
