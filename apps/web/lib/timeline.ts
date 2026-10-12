/**
 * The contact's unified timeline (Phase 8.2). Items come from the records themselves (orders,
 * form responses, emails, bookings, enrollments, chats, deals) so each one links to its record.
 * Logged activities fill in what has no record of its own (notes, tags, opt-ins, automations,
 * unsubscribes). Activity types that duplicate a record (purchase, form, email, booking) are
 * dropped in favour of the record. Pure, so it can be unit-tested.
 */

export type TimelineKind =
  | "order"
  | "form"
  | "email"
  | "booking"
  | "course"
  | "chat"
  | "deal"
  | "note"
  | "tag_added"
  | "tag_removed"
  | "optin"
  | "automation"
  | "deal_moved"
  | "unsubscribed";

export type TimelineItem = {
  /** Unique within the timeline (kind + source id). */
  key: string;
  kind: TimelineKind;
  at: Date;
  /** Main text: an order number, form name, email subject, course title… (user content, not translated). */
  title: string;
  /** Secondary detail, e.g. "opened" for an email or the stage for a deal. */
  detail?: string | null;
  href?: string | null;
  actor?: string | null;
  /** Amount in cents with currency (orders and deals). */
  money?: { amount: number; currency: string } | null;
  /** Long text shown under the line (notes). */
  body?: string | null;
};

export type TimelineSources = {
  ws: string;
  orders: {
    id: string;
    number: number;
    status: string;
    total: number;
    currency: string;
    createdAt: Date;
    items: string[];
  }[];
  forms: { id: string; stepId: string | null; blockId: string; formName: string; createdAt: Date }[];
  emails: {
    id: string;
    subject: string;
    sentAt: Date | null;
    createdAt: Date;
    openedAt: Date | null;
    clickedAt: Date | null;
    broadcastId: string | null;
    workflowId?: string | null;
    status: string;
  }[];
  bookings: { id: string; calendarId: string; calendarName: string; startAt: Date; createdAt: Date; status: string }[];
  courses: { id: string; courseId: string; title: string; createdAt: Date; revokedAt: Date | null }[];
  chats: { id: string; createdAt: Date; lastMessageAt: Date; status: string; pageUrl: string }[];
  deals: {
    id: string;
    title: string;
    stage: string;
    pipeline: string;
    value: number;
    currency: string;
    createdAt: Date;
  }[];
  activities: { id: string; type: string; body: string | null; actor: string | null; createdAt: Date }[];
};

/** Activity types that a record already represents. */
const COVERED = new Set(["purchase", "upsell", "form", "email_sent", "email_opened", "email_clicked", "booking"]);
const ACTIVITY_KINDS: Record<string, TimelineKind> = {
  note: "note",
  tag_added: "tag_added",
  tag_removed: "tag_removed",
  optin: "optin",
  automation: "automation",
  deal_moved: "deal_moved",
  unsubscribed: "unsubscribed",
};

export function buildTimeline(s: TimelineSources, limit = 200): TimelineItem[] {
  const base = `/${s.ws}`;
  const items: TimelineItem[] = [
    ...s.orders.map((o) => ({
      key: `order:${o.id}`,
      kind: "order" as const,
      at: o.createdAt,
      title: `#${o.number}`,
      detail: o.items.join(", ") || null,
      href: `${base}/orders/${o.id}`,
      money: { amount: o.total, currency: o.currency },
    })),
    ...s.forms.map((f) => ({
      key: `form:${f.id}`,
      kind: "form" as const,
      at: f.createdAt,
      title: f.formName,
      href: f.stepId ? `${base}/forms/${f.stepId}/${encodeURIComponent(f.blockId)}` : null,
    })),
    ...s.emails
      .filter((e) => e.status !== "queued" || e.sentAt)
      .map((e) => ({
        key: `email:${e.id}`,
        kind: "email" as const,
        at: e.sentAt ?? e.createdAt,
        title: e.subject,
        detail: e.clickedAt ? "clicked" : e.openedAt ? "opened" : e.status,
        href: e.broadcastId
          ? `${base}/email/${e.broadcastId}`
          : e.workflowId
            ? `/automation/${s.ws}/${e.workflowId}`
            : null,
      })),
    ...s.bookings.map((b) => ({
      key: `booking:${b.id}`,
      kind: "booking" as const,
      at: b.createdAt,
      title: b.calendarName,
      detail: b.status,
      href: `${base}/calendars/${b.calendarId}`,
    })),
    ...s.courses.map((c) => ({
      key: `course:${c.id}`,
      kind: "course" as const,
      at: c.createdAt,
      title: c.title,
      detail: c.revokedAt ? "revoked" : null,
      href: `${base}/courses/${c.courseId}`,
    })),
    ...s.chats.map((c) => ({
      key: `chat:${c.id}`,
      kind: "chat" as const,
      at: c.createdAt,
      title: c.pageUrl,
      detail: c.status,
      href: `${base}/inbox?c=${c.id}`,
    })),
    ...s.deals.map((d) => ({
      key: `deal:${d.id}`,
      kind: "deal" as const,
      at: d.createdAt,
      title: d.title,
      detail: `${d.pipeline} · ${d.stage}`,
      href: `${base}/pipelines`,
      money: { amount: d.value, currency: d.currency },
    })),
    ...s.activities.flatMap((a) => {
      const kind = ACTIVITY_KINDS[a.type];
      if (!kind || COVERED.has(a.type)) return [];
      return [
        {
          key: `activity:${a.id}`,
          kind,
          at: a.createdAt,
          title: a.type === "note" ? "" : (a.body ?? ""),
          body: a.type === "note" ? a.body : null,
          actor: a.actor,
        },
      ];
    }),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime() || a.key.localeCompare(b.key)).slice(0, limit);
}

/** Counts per kind, for the filter chips above the timeline. */
export function timelineCounts(items: TimelineItem[]) {
  const out: Partial<Record<TimelineKind, number>> = {};
  for (const i of items) out[i.kind] = (out[i.kind] ?? 0) + 1;
  return out;
}
