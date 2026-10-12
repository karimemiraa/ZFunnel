import "server-only";

import { and, eq, events, funnelSteps, gte, isNull, sql } from "@zfunnel/db";
import { inWorkspace } from "./funnels";
import type { WorkspaceContext } from "./workspaces";

export const RANGES = { "7": 7, "30": 30, "90": 90 } as const;
export type RangeKey = keyof typeof RANGES;

const CONVERSION: Record<string, string> = {
  optin: "optin",
  checkout: "purchase",
  upsell: "upsell",
  downsell: "downsell",
};

export async function funnelAnalytics(ctx: WorkspaceContext, funnelId: string | null, days: number) {
  const since = new Date(Date.now() - days * 86400_000);
  return inWorkspace(ctx, async (tx) => {
    const scope = and(gte(events.createdAt, since), funnelId ? eq(events.funnelId, funnelId) : undefined);
    // Revenue is shown in the main currency (most revenue in range); other currencies are listed
    // separately and never added in.
    const byCurrency = await tx
      .select({ currency: events.currency, revenue: sql<number>`sum(${events.revenue})::int` })
      .from(events)
      .where(and(scope, sql`${events.currency} is not null`))
      .groupBy(events.currency);
    byCurrency.sort((a, b) => b.revenue - a.revenue);
    const currency = byCurrency[0]?.currency ?? "usd";
    const otherCurrencies = byCurrency.slice(1).map((r) => ({ currency: r.currency!, revenue: r.revenue }));
    const rev = sql<number>`coalesce(sum(${events.revenue}) filter (where ${events.currency} = ${currency}), 0)::int`;
    const [totals] = await tx
      .select({
        visitors: sql<number>`count(distinct ${events.visitor}) filter (where ${events.type} = 'view')::int`,
        views: sql<number>`count(*) filter (where ${events.type} = 'view')::int`,
        leads: sql<number>`count(*) filter (where ${events.type} = 'optin')::int`,
        sales: sql<number>`count(*) filter (where ${events.type} = 'purchase')::int`,
        revenue: rev,
      })
      .from(events)
      .where(scope);
    const daily = await tx
      .select({
        day: sql<string>`to_char(date_trunc('day', ${events.createdAt}), 'YYYY-MM-DD')`,
        visitors: sql<number>`count(distinct ${events.visitor}) filter (where ${events.type} = 'view')::int`,
        revenue: rev,
      })
      .from(events)
      .where(scope)
      .groupBy(sql`1`)
      .orderBy(sql`1`);
    const steps = funnelId
      ? await tx
          .select({
            id: funnelSteps.id,
            name: funnelSteps.name,
            type: funnelSteps.type,
            visitors: sql<number>`count(distinct ${events.visitor}) filter (where ${events.type} = 'view')::int`,
            // Distinct visitors, so a rate can never exceed 100%.
            optins: sql<number>`count(distinct ${events.visitor}) filter (where ${events.type} = 'optin')::int`,
            purchases: sql<number>`count(distinct ${events.visitor}) filter (where ${events.type} = 'purchase')::int`,
            accepts: sql<number>`count(distinct ${events.visitor}) filter (where ${events.type} in ('upsell','downsell'))::int`,
            revenue: rev,
          })
          .from(funnelSteps)
          .leftJoin(events, and(eq(events.stepId, funnelSteps.id), gte(events.createdAt, since)))
          .where(and(eq(funnelSteps.funnelId, funnelId), isNull(funnelSteps.deletedAt)))
          .groupBy(funnelSteps.id)
          .orderBy(funnelSteps.position)
      : [];

    // Fill missing days so the chart has a continuous x-axis.
    const byDay = new Map(daily.map((d) => [d.day, d]));
    const series = Array.from({ length: days }, (_, i) => {
      const day = new Date(Date.now() - (days - 1 - i) * 86400_000).toISOString().slice(0, 10);
      return byDay.get(day) ?? { day, visitors: 0, revenue: 0 };
    });
    return {
      totals: { ...totals!, currency, otherCurrencies },
      series,
      steps: steps.map((s) => {
        const key = CONVERSION[s.type];
        const conversions = key === "optin" ? s.optins : key === "purchase" ? s.purchases : key ? s.accepts : 0;
        return { ...s, conversions, rate: s.visitors ? conversions / s.visitors : 0, tracked: Boolean(key) };
      }),
    };
  });
}
