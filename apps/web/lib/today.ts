import "server-only";

import {
  and,
  bookings,
  contacts,
  conversations,
  desc,
  domains,
  eq,
  events,
  funnels,
  funnelSteps,
  isNull,
  orders,
  paymentAccounts,
  payments,
  products,
  revenueGoals,
  sql,
  subscriptions,
  webinarRegistrations,
  webinars,
} from "@zfunnel/db";
import { inWorkspace } from "./funnels";
import {
  compare,
  goalPace,
  lastDays,
  monthBounds,
  monthKey,
  PERIODS,
  periodWindows,
  rate,
  resolveGoal,
  type Delta,
  type Pace,
  type Period,
  type Window,
} from "./today-math";
import type { WorkspaceContext } from "./workspaces";

/** Hours before an unanswered chat shows up in "Needs attention". */
export const UNANSWERED_HOURS = 4;
/** Pending checkouts older than this count as abandoned. */
const ABANDONED_HOURS = 1;
/** Webinars starting within this many days with no registrants are flagged. */
const WEBINAR_SOON_DAYS = 7;

const ts = (d: Date) => sql`${d.toISOString()}::timestamptz`;
const inWindow = (col: unknown, w: Window) => sql`${col} >= ${ts(w.from)} and ${col} < ${ts(w.to)}`;
const n = (v: unknown) => Number(v ?? 0);

/** Net paid revenue of an order. */
const net = sql`(${orders.total} - ${orders.refundedAmount})`;
const paid = sql`${orders.paidAt} is not null and ${orders.status} <> 'failed'`;

export type Metric = { current: number; previous: number; delta: Delta };
export type PeriodMetrics = {
  revenue: Metric;
  orders: Metric;
  leads: Metric;
  conversion: Metric;
  /** Revenue in other currencies in the current window, never added to the main figure. */
  otherRevenue: { currency: string; amount: number }[];
};

export type AttentionItem =
  | { kind: "failedPayments"; count: number }
  | { kind: "pastDue"; count: number }
  | { kind: "unanswered"; count: number; conversationId: string }
  | { kind: "drafts"; count: number; funnelId: string; funnelName: string }
  | { kind: "abandoned"; count: number }
  | { kind: "webinarEmpty"; webinarId: string; title: string; startAt: Date }
  | { kind: "domainFailing"; hostname: string }
  | { kind: "stripe" };

export type ActivityItem =
  | { kind: "order"; at: Date; id: string; number: number; amount: number; currency: string; who: string }
  | { kind: "lead"; at: Date; id: string; who: string }
  | { kind: "booking"; at: Date; calendarId: string; who: string; startAt: Date };

/** Everything the Today home shows, in a handful of parallel aggregate queries. */
export async function todayData(ctx: WorkspaceContext, now = new Date()) {
  const windows = Object.fromEntries(PERIODS.map((p) => [p, periodWindows(p, now)])) as Record<
    Period,
    ReturnType<typeof periodWindows>
  >;
  const all = PERIODS.flatMap((p) => [
    { key: `${p}_c`, w: windows[p].current },
    { key: `${p}_p`, w: windows[p].previous },
  ]);
  const earliest = windows["30d"].previous.from;
  const month = monthBounds(now);
  const days = lastDays(30, now);

  const [money, people, attention, recent] = await Promise.all([
    // 1. Orders: revenue + counts per currency for every window, the month, the daily series and top funnels.
    inWorkspace(ctx, async (tx) => {
      const sums = all.map(
        ({ key, w }) =>
          sql`coalesce(sum(${net}) filter (where ${inWindow(orders.paidAt, w)}), 0)::bigint as ${sql.raw(`"r_${key}"`)},
              count(*) filter (where ${inWindow(orders.paidAt, w)})::int as ${sql.raw(`"o_${key}"`)}`,
      );
      const since = month.start < earliest ? month.start : earliest;
      const byCurrency = (await tx.execute(sql`
        select ${orders.currency} as currency, ${sql.join(sums, sql`, `)},
          coalesce(sum(${net}) filter (where ${inWindow(orders.paidAt, { from: month.start, to: month.end })}), 0)::bigint as month
        from ${orders} where ${paid} and ${orders.paidAt} >= ${ts(since)}
        group by 1`)) as unknown as Record<string, string | number>[];
      const daily = (await tx.execute(sql`
        select ${orders.currency} as currency, to_char(date_trunc('day', ${orders.paidAt} at time zone 'UTC'), 'YYYY-MM-DD') as day,
          sum(${net})::bigint as revenue
        from ${orders} where ${paid} and ${orders.paidAt} >= ${ts(new Date(`${days[0]}T00:00:00Z`))}
        group by 1, 2`)) as unknown as { currency: string; day: string; revenue: string }[];
      const top = await tx
        .select({
          id: funnels.id,
          name: funnels.name,
          currency: orders.currency,
          revenue: sql<number>`sum(${net})::bigint`,
          orders: sql<number>`count(*)::int`,
        })
        .from(orders)
        .innerJoin(funnels, eq(funnels.id, orders.funnelId))
        .where(sql`${paid} and ${inWindow(orders.paidAt, windows["30d"].current)}`)
        .groupBy(funnels.id, orders.currency);
      const goals = await tx.select().from(revenueGoals);
      return { byCurrency, daily, top, goals };
    }),

    // 2. Leads (contacts) and funnel conversion (events) for every window.
    inWorkspace(ctx, async (tx) => {
      const leadCols = all.map(
        ({ key, w }) => sql`count(*) filter (where ${inWindow(contacts.createdAt, w)})::int as ${sql.raw(`"${key}"`)}`,
      );
      const [leads] = (await tx.execute(
        sql`select ${sql.join(leadCols, sql`, `)} from ${contacts} where ${contacts.deletedAt} is null and ${contacts.createdAt} >= ${ts(earliest)}`,
      )) as unknown as Record<string, number>[];
      const convCols = all.map(
        ({ key, w }) =>
          sql`count(distinct ${events.visitor}) filter (where ${events.type} = 'view' and ${inWindow(events.createdAt, w)})::int as ${sql.raw(`"v_${key}"`)},
              count(distinct ${events.visitor}) filter (where ${events.type} in ('optin','purchase') and ${inWindow(events.createdAt, w)})::int as ${sql.raw(`"c_${key}"`)}`,
      );
      const [conv] = (await tx.execute(
        sql`select ${sql.join(convCols, sql`, `)} from ${events} where ${events.createdAt} >= ${ts(earliest)}`,
      )) as unknown as Record<string, number>[];
      return { leads: leads ?? {}, conv: conv ?? {} };
    }),

    // 3. Needs attention + onboarding state.
    inWorkspace(ctx, async (tx) => {
      const [c] = (await tx.execute(sql`
        select
          (select count(*)::int from ${payments} where ${payments.status} = 'failed' and ${payments.createdAt} >= ${ts(windows["30d"].current.from)}) as failed,
          (select count(*)::int from ${subscriptions} where ${subscriptions.status} in ('past_due','unpaid')) as past_due,
          (select count(*)::int from ${orders} where ${orders.status} = 'pending'
             and ${orders.createdAt} < ${ts(new Date(now.getTime() - ABANDONED_HOURS * 3_600_000))}
             and ${orders.createdAt} >= ${ts(windows["7d"].current.from)}) as abandoned,
          (select count(*)::int from ${paymentAccounts} where ${paymentAccounts.chargesEnabled}) as stripe,
          (select count(*)::int from ${funnels} where ${funnels.archivedAt} is null) as funnels,
          (select count(*)::int from ${products} where ${products.archivedAt} is null) as products,
          (select count(*)::int from ${domains} where ${domains.status} = 'active') as domains,
          (select count(*)::int from ${contacts} where ${contacts.deletedAt} is null) as contacts
      `)) as unknown as Record<string, number>[];
      const unanswered = (await tx.execute(sql`
        select c.id, count(*) over ()::int as total from ${conversations} c
        where c.status = 'open'
          and c.last_message_at < ${ts(new Date(now.getTime() - UNANSWERED_HOURS * 3_600_000))}
          and (select m.sender from conversation_messages m where m.conversation_id = c.id
               order by m.created_at desc limit 1) = 'visitor'
        order by c.last_message_at asc limit 1`)) as unknown as { id: string; total: number }[];
      const drafts = await tx
        .select({
          funnelId: funnels.id,
          funnelName: funnels.name,
          count: sql<number>`count(*)::int`,
        })
        .from(funnelSteps)
        .innerJoin(funnels, eq(funnels.id, funnelSteps.funnelId))
        .where(
          and(
            isNull(funnels.archivedAt),
            isNull(funnelSteps.deletedAt),
            sql`(${funnelSteps.publishedAt} is null or ${funnelSteps.draftUpdatedAt} > ${funnelSteps.publishedAt})`,
          ),
        )
        .groupBy(funnels.id)
        .orderBy(desc(sql`max(${funnelSteps.draftUpdatedAt})`));
      const soon = new Date(now.getTime() + WEBINAR_SOON_DAYS * 86_400_000);
      const emptyWebinars = await tx
        .select({ id: webinars.id, title: webinars.title, startAt: sql<string>`${webinars.schedule}->>'startAt'` })
        .from(webinars)
        .leftJoin(webinarRegistrations, eq(webinarRegistrations.webinarId, webinars.id))
        .where(
          and(
            eq(webinars.status, "published"),
            sql`${webinars.schedule}->>'kind' = 'live'`,
            sql`(${webinars.schedule}->>'startAt')::timestamptz between ${ts(now)} and ${ts(soon)}`,
          ),
        )
        .groupBy(webinars.id)
        .having(sql`count(${webinarRegistrations.id}) = 0`)
        .limit(3);
      const failingDomains = await tx
        .select({ hostname: domains.hostname })
        .from(domains)
        .where(eq(domains.status, "failed"))
        .limit(3);
      return { counts: c ?? {}, unanswered, drafts, emptyWebinars, failingDomains };
    }),

    // 4. Recent activity.
    inWorkspace(ctx, async (tx) => {
      const [o, l, b] = [
        await tx
          .select({
            at: orders.paidAt,
            id: orders.id,
            number: orders.number,
            amount: orders.total,
            currency: orders.currency,
            name: contacts.name,
            email: contacts.email,
          })
          .from(orders)
          .leftJoin(contacts, eq(contacts.id, orders.contactId))
          .where(paid)
          .orderBy(desc(orders.paidAt))
          .limit(6),
        await tx
          .select({ at: contacts.createdAt, id: contacts.id, name: contacts.name, email: contacts.email })
          .from(contacts)
          .where(isNull(contacts.deletedAt))
          .orderBy(desc(contacts.createdAt))
          .limit(6),
        await tx
          .select({
            at: bookings.createdAt,
            calendarId: bookings.calendarId,
            name: bookings.name,
            startAt: bookings.startAt,
          })
          .from(bookings)
          .where(eq(bookings.status, "confirmed"))
          .orderBy(desc(bookings.createdAt))
          .limit(6),
      ];
      const items: ActivityItem[] = [
        ...o.map((r) => ({
          kind: "order" as const,
          at: r.at!,
          id: r.id,
          number: r.number,
          amount: r.amount,
          currency: r.currency,
          who: r.name || r.email || "",
        })),
        ...l.map((r) => ({ kind: "lead" as const, at: r.at, id: r.id, who: r.name || r.email })),
        ...b.map((r) => ({
          kind: "booking" as const,
          at: r.at,
          calendarId: r.calendarId,
          who: r.name,
          startAt: r.startAt,
        })),
      ];
      return items.sort((a, z) => z.at.getTime() - a.at.getTime()).slice(0, 8);
    }),
  ]);

  // Main currency: the goal's, else the one with most revenue in the last 30 days.
  const goal = resolveGoal(money.goals, monthKey(now));
  const rows: (Record<string, string | number> & { currency: string })[] = money.byCurrency.map((r) => ({
    ...r,
    currency: String(r.currency),
  }));
  rows.sort((a, z) => n(z["r_30d_c"]) - n(a["r_30d_c"]));
  const currency = goal?.currency ?? rows[0]?.currency ?? "usd";
  const main = rows.find((r) => r.currency === currency);

  const metric = (cur: number, prev: number): Metric => ({ current: cur, previous: prev, delta: compare(cur, prev) });
  const periods = Object.fromEntries(
    PERIODS.map((p) => {
      const ordersC = rows.reduce((s, r) => s + n(r[`o_${p}_c`]), 0);
      const ordersP = rows.reduce((s, r) => s + n(r[`o_${p}_p`]), 0);
      const conv = people.conv;
      return [
        p,
        {
          revenue: metric(n(main?.[`r_${p}_c`]), n(main?.[`r_${p}_p`])),
          orders: metric(ordersC, ordersP),
          leads: metric(n(people.leads[`${p}_c`]), n(people.leads[`${p}_p`])),
          conversion: metric(
            rate(n(conv[`c_${p}_c`]), n(conv[`v_${p}_c`])),
            rate(n(conv[`c_${p}_p`]), n(conv[`v_${p}_p`])),
          ),
          otherRevenue: rows
            .filter((r) => r.currency !== currency && n(r[`r_${p}_c`]) > 0)
            .map((r) => ({ currency: r.currency, amount: n(r[`r_${p}_c`]) })),
        } satisfies PeriodMetrics,
      ];
    }),
  ) as Record<Period, PeriodMetrics>;

  const dayMap = new Map(money.daily.filter((d) => d.currency === currency).map((d) => [d.day, n(d.revenue)]));
  const series = days.map((day) => ({ day, value: dayMap.get(day) ?? 0 }));

  const monthRevenue = n(goal ? main?.month : undefined);
  const goalState: { amount: number; currency: string; month: string; revenue: number; pace: Pace } | null = goal
    ? {
        amount: goal.amount,
        currency: goal.currency,
        month: goal.month,
        revenue: monthRevenue,
        pace: goalPace(goal.amount, monthRevenue, now),
      }
    : null;

  const topFunnels = money.top
    .filter((f) => f.currency === currency)
    .map((f) => ({ id: f.id, name: f.name, revenue: n(f.revenue), orders: f.orders }))
    .sort((a, z) => z.revenue - a.revenue)
    .slice(0, 5);

  const c = attention.counts;
  const items: AttentionItem[] = [];
  if (n(c.failed) > 0) items.push({ kind: "failedPayments", count: n(c.failed) });
  if (n(c.past_due) > 0) items.push({ kind: "pastDue", count: n(c.past_due) });
  const un = attention.unanswered[0];
  if (un) items.push({ kind: "unanswered", count: n(un.total), conversationId: un.id });
  if (n(c.abandoned) > 0) items.push({ kind: "abandoned", count: n(c.abandoned) });
  for (const w of attention.emptyWebinars)
    items.push({ kind: "webinarEmpty", webinarId: w.id, title: w.title, startAt: new Date(w.startAt) });
  for (const d of attention.failingDomains) items.push({ kind: "domainFailing", hostname: d.hostname });
  for (const d of attention.drafts.slice(0, 3))
    items.push({ kind: "drafts", count: d.count, funnelId: d.funnelId, funnelName: d.funnelName });
  if (n(c.stripe) === 0) items.push({ kind: "stripe" });

  return {
    currency,
    periods,
    series,
    goal: goalState,
    goals: money.goals,
    topFunnels,
    attention: items,
    recent,
    state: {
      stripe: n(c.stripe) > 0,
      funnels: n(c.funnels),
      products: n(c.products),
      domains: n(c.domains),
      contacts: n(c.contacts),
      hasRevenue: rows.length > 0,
      hasDrafts: attention.drafts.length > 0,
    },
  };
}

export type TodayData = Awaited<ReturnType<typeof todayData>>;
