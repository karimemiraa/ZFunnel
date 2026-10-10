"use client";

import { useT } from "@zfunnel/i18n/react";
import { cn } from "@zfunnel/ui/lib/utils";
import { BuildingIcon, LayoutDashboardIcon, ScrollTextIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", key: "overview", icon: LayoutDashboardIcon },
  { href: "/admin/organizations", key: "organizations", icon: BuildingIcon },
  { href: "/admin/users", key: "users", icon: UsersIcon },
  { href: "/admin/audit", key: "audit", icon: ScrollTextIcon },
] as const;

export function AdminNav() {
  const t = useT();
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label={t("admin.title")}>
      {ITEMS.map(({ href, key, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {t(`admin.nav.${key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
