"use client";

import { cn } from "@zfunnel/ui/lib/utils";
import { Tooltip } from "@zfunnel/ui/tooltip";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@zfunnel/i18n/react";
import type { MessageKey } from "@zfunnel/i18n";
import { ChevronDownIcon, PinIcon, PinOffIcon } from "lucide-react";
import { findModule, NAV_GROUPS, navText, OVERVIEW_MODULE, SETTINGS_MODULE, type NavModule } from "@/lib/nav";
import { useShell } from "./shell/shell-provider";

/** Badge count for a module, from the shell poll. */
function useBadge(item: NavModule) {
  const { poll } = useShell();
  if (!item.badge || !poll) return 0;
  return item.badge === "inbox" ? poll.inbox : poll.orders;
}

function NavLink({
  item,
  base,
  onNavigate,
  compact,
  pinnable,
}: {
  item: NavModule;
  base: string;
  onNavigate?: () => void;
  compact: boolean;
  pinnable: boolean;
}) {
  const pathname = usePathname();
  const t = useT();
  const { pins, togglePin } = useShell();
  const badge = useBadge(item);
  const href = item.segment ? `${base}/${item.segment}` : base;
  const active = item.segment ? pathname === href || pathname.startsWith(`${href}/`) : pathname === base;
  const Icon = item.icon;
  const label = navText(t, item.segment, "label");
  const pinned = pins.includes(item.segment);
  const badgeLabel =
    badge > 0 ? t(item.badge === "inbox" ? "topbar.unreadInbox" : "topbar.newOrders", { count: badge }) : undefined;

  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={compact ? (badgeLabel ? `${label}, ${badgeLabel}` : label) : undefined}
      data-nav={item.segment || "overview"}
      className={cn(
        "relative flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors",
        compact ? "justify-center px-2" : "px-3",
        active
          ? "bg-brand-navy/[0.06] font-semibold text-brand-navy before:absolute before:inset-y-1.5 before:start-0 before:w-[3px] before:rounded-full before:bg-brand-orange dark:bg-white/[0.08] dark:text-white"
          : "text-muted-foreground hover:bg-brand-navy/[0.04] hover:text-foreground dark:hover:bg-white/[0.05]",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active && "text-brand-orange-text")} />
      {!compact && <span className="flex-1 truncate">{label}</span>}
      {!compact && item.phase && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
          {t("shell.soon")}
        </span>
      )}
      {badge > 0 &&
        (compact ? (
          <span className="absolute end-1 top-1 size-2 rounded-full bg-brand-orange" aria-hidden />
        ) : (
          <span
            className="min-w-5 rounded-full bg-brand-orange px-1.5 text-center text-[11px] leading-5 font-semibold text-white tabular-nums"
            title={badgeLabel}
            data-badge={item.badge}
          >
            <span aria-hidden>{badge > 99 ? "99+" : badge}</span>
            <span className="sr-only">{badgeLabel}</span>
          </span>
        ))}
    </Link>
  );

  if (compact)
    return (
      <Tooltip label={badgeLabel ? `${label} · ${badgeLabel}` : label} side="right">
        {link}
      </Tooltip>
    );
  if (!pinnable) return link;
  return (
    <div className="group/nav relative">
      {link}
      <button
        type="button"
        onClick={() => togglePin(item.segment)}
        aria-label={t(pinned ? "topbar.unpin" : "topbar.pin", { name: label })}
        aria-pressed={pinned}
        className={cn(
          "absolute end-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover/nav:opacity-100 hover:text-foreground focus-visible:opacity-100",
          badge > 0 && "group-hover/nav:bg-sidebar",
        )}
      >
        {pinned ? <PinOffIcon className="size-3.5" /> : <PinIcon className="size-3.5" />}
      </button>
    </div>
  );
}

function GroupHeader({
  id,
  label,
  open,
  onToggle,
}: {
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={`nav-group-${id}`}
      aria-label={t("topbar.toggleGroup", { group: label })}
      data-group-toggle={id}
      className="flex w-full items-center gap-1 rounded px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase transition-colors hover:text-foreground"
    >
      <span className="flex-1 text-start">{label}</span>
      <ChevronDownIcon className={cn("size-3.5 transition-transform", !open && "-rotate-90 rtl:rotate-90")} />
    </button>
  );
}

/**
 * Grouped sidebar (ROADMAP 8.1): Overview, pinned favorites, the five groups, Settings at the bottom.
 * `compact` renders the icon-only rail; the mobile drawer always renders the full list.
 */
export function SidebarNav({
  workspaceSlug,
  onNavigate,
  compact = false,
}: {
  workspaceSlug: string;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const base = `/${workspaceSlug}`;
  const t = useT();
  const { closedGroups, toggleGroup, pins } = useShell();
  const pinned = pins.map(findModule).filter((m): m is NavModule => !!m);
  const common = { base, onNavigate, compact };
  return (
    <nav className="flex flex-1 flex-col gap-0.5" aria-label={t("shell.mainNav")}>
      <NavLink item={OVERVIEW_MODULE} {...common} pinnable={false} />
      {pinned.length > 0 && (
        <div role="group" aria-label={t("topbar.groups.favorites")} data-group="favorites">
          {compact ? (
            <div className="mx-2 my-2 border-t" />
          ) : (
            <div className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
              {t("topbar.groups.favorites")}
            </div>
          )}
          {pinned.map((item) => (
            <NavLink key={`pin-${item.segment}`} item={item} {...common} pinnable />
          ))}
        </div>
      )}
      {NAV_GROUPS.map((group) => {
        const label = t(`topbar.groups.${group.id}` as MessageKey);
        const open = compact || !closedGroups.includes(group.id);
        return (
          <div key={group.id} role="group" aria-label={label} data-group={group.id}>
            {compact ? (
              <div className="mx-2 my-2 border-t" />
            ) : (
              <GroupHeader id={group.id} label={label} open={open} onToggle={() => toggleGroup(group.id)} />
            )}
            {open && (
              <div id={`nav-group-${group.id}`} className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavLink key={item.segment} item={item} {...common} pinnable />
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="mt-auto pt-4">
        <NavLink item={SETTINGS_MODULE} {...common} pinnable={false} />
      </div>
    </nav>
  );
}
