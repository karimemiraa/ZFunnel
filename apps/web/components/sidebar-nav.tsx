"use client";

import { cn } from "@zfunnel/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_MODULES, SETTINGS_MODULE, type NavModule } from "@/lib/nav";

function NavLink({ item, base, onNavigate }: { item: NavModule; base: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const href = item.segment ? `${base}/${item.segment}` : base;
  const active = item.segment ? pathname === href || pathname.startsWith(`${href}/`) : pathname === base;
  const Icon = item.icon;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.phase && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
          Soon
        </span>
      )}
    </Link>
  );
}

export function SidebarNav({ workspaceSlug, onNavigate }: { workspaceSlug: string; onNavigate?: () => void }) {
  const base = `/${workspaceSlug}`;
  return (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
      {NAV_MODULES.map((item) => (
        <NavLink key={item.segment} item={item} base={base} onNavigate={onNavigate} />
      ))}
      <div className="mt-auto pt-4">
        <NavLink item={SETTINGS_MODULE} base={base} onNavigate={onNavigate} />
      </div>
    </nav>
  );
}
