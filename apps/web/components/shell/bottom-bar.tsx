"use client";

import { useT } from "@zfunnel/i18n/react";
import { cn } from "@zfunnel/ui/lib/utils";
import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { findModule, navText, type NavModule } from "@/lib/nav";
import { useShell } from "./shell-provider";

const TABS = ["", "funnels", "orders", "inbox"].map((s) => findModule(s)!);

function Tab({ item }: { item: NavModule }) {
  const t = useT();
  const pathname = usePathname();
  const { workspaceSlug, poll } = useShell();
  const href = item.segment ? `/${workspaceSlug}/${item.segment}` : `/${workspaceSlug}`;
  const active = item.segment ? pathname.startsWith(href) : pathname === href;
  const badge = item.badge === "inbox" ? (poll?.inbox ?? 0) : item.badge === "orders" ? (poll?.orders ?? 0) : 0;
  const Icon = item.icon;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium",
        active ? "text-brand-orange-text" : "text-muted-foreground",
      )}
    >
      <span className="relative">
        <Icon className="size-5" />
        {badge > 0 && (
          <span className="absolute -end-2 -top-1 min-w-4 rounded-full bg-brand-orange px-1 text-[10px] leading-4 font-semibold text-white tabular-nums">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className="max-w-full truncate px-1">{navText(t, item.segment, "label")}</span>
    </Link>
  );
}

/** Thumb-reach navigation on phones (ROADMAP 8.1). The full menu stays in the top bar. */
export function BottomBar() {
  const t = useT();
  const { setPaletteOpen } = useShell();
  return (
    <nav
      aria-label={t("topbar.bottomBar")}
      data-bottom-bar
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <Tab item={TABS[0]!} />
      <Tab item={TABS[1]!} />
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium text-muted-foreground"
      >
        <SearchIcon className="size-5" />
        <span>{t("topbar.search")}</span>
      </button>
      <Tab item={TABS[2]!} />
      <Tab item={TABS[3]!} />
    </nav>
  );
}
