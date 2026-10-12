"use client";

import { useT } from "@zfunnel/i18n/react";
import { cn } from "@zfunnel/ui/lib/utils";
import {
  CalendarIcon,
  CreditCardIcon,
  FilterIcon,
  GraduationCapIcon,
  KanbanIcon,
  MailIcon,
  MessageCircleIcon,
  StickyNoteIcon,
  TagIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { TimelineItem, TimelineKind } from "@/lib/timeline";
import { useFmt } from "@/lib/use-fmt";

const ICONS: Record<TimelineKind, LucideIcon> = {
  order: CreditCardIcon,
  form: FilterIcon,
  email: MailIcon,
  booking: CalendarIcon,
  course: GraduationCapIcon,
  chat: MessageCircleIcon,
  deal: KanbanIcon,
  note: StickyNoteIcon,
  tag_added: TagIcon,
  tag_removed: TagIcon,
  optin: FilterIcon,
  automation: ZapIcon,
  deal_moved: KanbanIcon,
  unsubscribed: MailIcon,
};

/** Filter chips group several kinds. */
const GROUPS = {
  orders: ["order"],
  emails: ["email", "unsubscribed"],
  forms: ["form", "optin"],
  bookings: ["booking"],
  courses: ["course"],
  chats: ["chat"],
  deals: ["deal", "deal_moved"],
  tags: ["tag_added", "tag_removed"],
  notes: ["note"],
  automations: ["automation"],
} as const satisfies Record<string, readonly TimelineKind[]>;
type Group = keyof typeof GROUPS;

export type SerializedTimelineItem = Omit<TimelineItem, "at"> & { at: string };

/** The contact's unified timeline (8.2): every item links to its record. */
export function Timeline({ items }: { items: SerializedTimelineItem[] }) {
  const t = useT();
  const f = useFmt();
  const [group, setGroup] = useState<Group | null>(null);
  const groups = useMemo(
    () =>
      (Object.keys(GROUPS) as Group[]).filter((g) =>
        items.some((i) => (GROUPS[g] as readonly TimelineKind[]).includes(i.kind)),
      ),
    [items],
  );
  const shown = group ? items.filter((i) => (GROUPS[group] as readonly TimelineKind[]).includes(i.kind)) : items;
  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
      active ? "border-foreground bg-foreground text-background" : "hover:border-foreground/30",
    );

  return (
    <div>
      {groups.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label={t("records.timeline.filter")}>
          <button type="button" className={chip(!group)} onClick={() => setGroup(null)} aria-pressed={!group}>
            {t("records.timeline.all")}
          </button>
          {groups.map((g) => (
            <button
              key={g}
              type="button"
              className={chip(group === g)}
              onClick={() => setGroup(g)}
              aria-pressed={group === g}
            >
              {t(`records.timeline.groups.${g}`)}
            </button>
          ))}
        </div>
      )}
      <ol data-testid="timeline">
        {shown.map((i) => {
          const Icon = ICONS[i.kind] ?? StickyNoteIcon;
          const label = t(`records.timeline.kinds.${i.kind}`, { title: i.title, detail: i.detail ?? "" });
          const detail =
            i.kind === "email" && i.detail
              ? t(`records.timeline.emailStatus.${i.detail}` as "records.timeline.emailStatus.sent")
              : i.kind === "booking" || i.kind === "chat" || i.kind === "course"
                ? i.detail
                  ? t(`records.timeline.status.${i.detail}` as "records.timeline.status.open")
                  : null
                : i.kind === "order" || i.kind === "deal"
                  ? i.detail
                  : null;
          return (
            <li key={i.key} className="relative flex gap-3 ps-1 pb-5">
              <span className="absolute start-[17px] top-8 bottom-0 w-px bg-border" aria-hidden />
              <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  {i.href ? (
                    <Link href={i.href} className="font-medium hover:underline">
                      {label}
                    </Link>
                  ) : (
                    <span className="font-medium">{label}</span>
                  )}
                  {i.money && <span className="tabular-nums">{f.money(i.money.amount, i.money.currency)}</span>}
                  <span className="text-muted-foreground">
                    · {f.timeAgo(i.at)}
                    {i.actor ? ` ${t("contacts.byActor", { actor: i.actor })}` : ""}
                  </span>
                </div>
                {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
                {i.body && <p className="mt-1.5 rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">{i.body}</p>}
              </div>
            </li>
          );
        })}
        {shown.length === 0 && <li className="text-sm text-muted-foreground">{t("contacts.noActivity")}</li>}
      </ol>
    </div>
  );
}
