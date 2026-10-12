"use client";

import { Button } from "@zfunnel/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@zfunnel/ui/dropdown-menu";
import { useIntlLocale, useT } from "@zfunnel/i18n/react";
import type { T } from "@zfunnel/i18n";
import { cn } from "@zfunnel/ui/lib/utils";
import {
  BellIcon,
  CalendarCheckIcon,
  CheckCheckIcon,
  CircleAlertIcon,
  MessageCircleIcon,
  ReceiptIcon,
  UserPlusIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { ShellNotification } from "@/lib/shell-actions";
import { useShell } from "./shell-provider";

const ICONS = {
  order: ReceiptIcon,
  payment_failed: CircleAlertIcon,
  lead: UserPlusIcon,
  chat: MessageCircleIcon,
  booking: CalendarCheckIcon,
} as const;

const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");

/** Notification text, rendered in the viewer's language from the stored type + data. */
export function notificationText(t: T, n: ShellNotification) {
  const name = str(n.data.name) || t("notifications.someone");
  const number = str(n.data.number);
  switch (n.type) {
    case "order":
      return n.data.name ? t("notifications.order", { number, name }) : t("notifications.orderNoName", { number });
    case "payment_failed":
      return t("notifications.paymentFailed", { number });
    case "lead":
      return n.data.form
        ? t("notifications.leadForm", { name, form: str(n.data.form) })
        : t("notifications.lead", { name });
    case "chat":
      return t("notifications.chat", { name });
    case "booking":
      return t("notifications.booking", { name, calendar: str(n.data.calendar) });
  }
}

export function notificationHref(ws: string, n: ShellNotification) {
  const base = `/${ws}`;
  switch (n.type) {
    case "order":
    case "payment_failed":
      if (n.entityId) return `${base}/orders/${n.entityId}`;
      return n.data.number ? `${base}/orders?q=${encodeURIComponent(str(n.data.number))}` : `${base}/orders`;
    case "lead":
      return n.entityId ? `${base}/contacts/${n.entityId}` : `${base}/contacts`;
    case "chat":
      return n.entityId ? `${base}/inbox?c=${n.entityId}` : `${base}/inbox`;
    case "booking":
      return n.data.calendarId ? `${base}/calendars/${str(n.data.calendarId)}?tab=upcoming` : `${base}/calendars`;
  }
}

function useRelativeTime() {
  const locale = useIntlLocale();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  return (iso: string) => {
    const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
    const a = Math.abs(s);
    if (a < 60) return rtf.format(s, "second");
    if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
    if (a < 86_400) return rtf.format(Math.round(s / 3600), "hour");
    return rtf.format(Math.round(s / 86_400), "day");
  };
}

/** Top-bar bell (ROADMAP 8.5i): unread count, the latest 20 events, "mark all read". */
export function NotificationsBell() {
  const t = useT();
  const ago = useRelativeTime();
  const { workspaceSlug, poll, markRead, refreshPoll } = useShell();
  const [open, setOpen] = useState(false);
  const unread = poll?.unread ?? 0;
  const items = poll?.notifications ?? [];
  const label =
    unread > 0
      ? `${t("notifications.open")}, ${t("notifications.unread", { count: unread })}`
      : t("notifications.open");

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) refreshPoll();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={label} data-notifications-bell>
          <BellIcon />
          {unread > 0 && (
            <span
              className="absolute -end-0.5 -top-0.5 min-w-4 rounded-full bg-brand-orange px-1 text-[10px] leading-4 font-semibold text-white tabular-nums"
              data-unread={unread}
              aria-hidden
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <span className="text-sm font-semibold">{t("notifications.title")}</span>
          <button
            type="button"
            onClick={() => markRead()}
            disabled={unread === 0}
            className="flex items-center gap-1 rounded text-xs font-medium text-brand-orange-text transition-opacity hover:underline disabled:opacity-40 disabled:hover:no-underline"
          >
            <CheckCheckIcon className="size-3.5" /> {t("notifications.markAllRead")}
          </button>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-balance text-muted-foreground">{t("notifications.empty")}</p>
        ) : (
          <ul className="max-h-[min(26rem,70dvh)] overflow-y-auto py-1" data-notifications-list>
            {items.map((n) => {
              const Icon = ICONS[n.type] ?? BellIcon;
              return (
                <li key={n.id}>
                  <Link
                    href={notificationHref(workspaceSlug, n)}
                    onClick={() => {
                      setOpen(false);
                      if (!n.read) markRead([n.id]);
                    }}
                    data-read={n.read || undefined}
                    className={cn(
                      "flex gap-3 px-3 py-2.5 text-sm transition-colors outline-none hover:bg-accent focus-visible:bg-accent",
                      !n.read && "bg-brand-orange/[0.06]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                        n.type === "payment_failed"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-brand-navy/[0.06] text-brand-navy dark:bg-white/10 dark:text-white",
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block leading-snug", !n.read && "font-medium")}>
                        {notificationText(t, n)}
                      </span>
                      {n.type === "chat" && n.data.preview && (
                        <span className="block truncate text-xs text-muted-foreground">{str(n.data.preview)}</span>
                      )}
                      <span className="block text-xs text-muted-foreground">{ago(n.createdAt)}</span>
                    </span>
                    {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-brand-orange" aria-hidden />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
