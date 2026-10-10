import "server-only";

import { asc, eq, sql, stepVariants } from "@zfunnel/db";
import { inWorkspace } from "./funnels";
import type { WorkspaceContext } from "./workspaces";

export type VariantStats = { key: string; visitors: number; converted: number; rate: number };

export async function getVariants(ctx: WorkspaceContext, stepId: string) {
  return inWorkspace(ctx, (tx) =>
    tx.select().from(stepVariants).where(eq(stepVariants.stepId, stepId)).orderBy(asc(stepVariants.createdAt)),
  );
}

export async function getVariant(ctx: WorkspaceContext, variantId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(variantId)) return null;
  const [v] = await inWorkspace(ctx, (tx) => tx.select().from(stepVariants).where(eq(stepVariants.id, variantId)));
  return v ?? null;
}

/**
 * Per-variant results since the test started. A visitor converts if, after seeing the page,
 * they opt in or buy anywhere in the funnel (so a sales page is credited for the checkout).
 */
export async function getSplitStats(
  ctx: WorkspaceContext,
  funnelId: string,
  stepId: string,
  since: Date,
): Promise<VariantStats[]> {
  const rows = (await inWorkspace(ctx, (tx) =>
    tx.execute(sql`
      with v as (
        select coalesce(variant_id::text, 'a') as variant, visitor, min(created_at) as t
        from events
        where step_id = ${stepId} and type = 'view' and created_at >= ${since.toISOString()}
        group by 1, 2
      )
      select variant as key, count(*)::int as visitors,
        count(*) filter (where exists (
          select 1 from events e
          where e.funnel_id = ${funnelId} and e.visitor = v.visitor
            and e.type in ('optin', 'purchase', 'upsell') and e.created_at >= v.t
        ))::int as converted
      from v group by variant`),
  )) as unknown as { key: string; visitors: number; converted: number }[];
  return rows.map((r) => ({ ...r, rate: r.visitors ? r.converted / r.visitors : 0 }));
}

/**
 * Two-proportion z-test: how confident we are that B's rate differs from A's.
 * Returns 0–1 (e.g. 0.95 = 95% confidence). Needs a few conversions to mean anything.
 */
export function confidence(a: VariantStats | undefined, b: VariantStats | undefined) {
  if (!a || !b || a.visitors < 20 || b.visitors < 20) return null;
  const p = (a.converted + b.converted) / (a.visitors + b.visitors);
  const se = Math.sqrt(p * (1 - p) * (1 / a.visitors + 1 / b.visitors));
  if (!se) return null;
  const z = Math.abs(b.rate - a.rate) / se;
  // Normal CDF approximation (Abramowitz–Stegun 7.1.26).
  const t = 1 / (1 + 0.3275911 * (z / Math.SQRT2));
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-((z / Math.SQRT2) ** 2));
  return erf; // P(|Z| < z)
}
