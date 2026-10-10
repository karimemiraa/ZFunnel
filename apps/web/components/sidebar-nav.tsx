"use client";

import { cn } from "@zfunnel/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@zfunnel/i18n/react";
import { NAV_MODULES, navText, SETTINGS_MODULE, type NavModule } from "@/lib/nav";

function NavLink({ item, base, onNavigate }: { item: NavModule; base: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useT();
  const href = item.segment ? `${base}/${item.segment}` : base;
  const active = item.segment ? pathname === href || pathname.startsWith(`${href}/`) : pathname === base;
  const Icon = item.icon;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-brand-navy/[0.06] font-semibold text-brand-navy before:absolute before:inset-y-1.5 before:start-0 before:w-[3px] before:rounded-full before:bg-brand-orange dark:bg-white/[0.08] dark:text-white"
          : "text-muted-foreground hover:bg-brand-navy/[0.04] hover:text-foreground dark:hover:bg-white/[0.05]",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active && "text-brand-orange-text")} />
      <span className="flex-1">{navText(t, item.segment, "label")}</span>
      {item.phase && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
          {t("shell.soon")}
        </span>
      )}
    </Link>
  );
}

export function SidebarNav({ workspaceSlug, onNavigate }: { workspaceSlug: string; onNavigate?: () => void }) {
  const base = `/${workspaceSlug}`;
  const t = useT();
  return (
    <nav className="flex flex-1 flex-col gap-0.5" aria-label={t("shell.mainNav")}>
      {NAV_MODULES.map((item) => (
        <NavLink key={item.segment} item={item} base={base} onNavigate={onNavigate} />
      ))}
      <div className="mt-auto pt-4">
        <NavLink item={SETTINGS_MODULE} base={base} onNavigate={onNavigate} />
      </div>
    </nav>
  );
}
