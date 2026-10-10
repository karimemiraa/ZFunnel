import "server-only";

import { eq, getDb, orgBilling, sql, withSystem, type OrgBilling } from "@zfunnel/db";
import {
  FEATURE_LABELS,
  LIMIT_LABELS,
  PLANS,
  TRIAL_DAYS,
  type FeatureKey,
  type LimitKey,
  type Plan,
} from "@zfunnel/shared";

export type BillingState = {
  plan: Plan;
  /** trial: free trial running · active: paid · past_due: paid but failing · expired: trial over / cancelled. */
  status: "trial" | "active" | "past_due" | "expired";
  trialEndsAt: Date | null;
  daysLeft: number | null;
  row: OrgBilling | null;
};

export async function getBillingState(organizationId: string): Promise<BillingState> {
  return withSystem(getDb(), async (tx) => {
    const [row] = await tx.select().from(orgBilling).where(eq(orgBilling.organizationId, organizationId));
    if (row && (row.status === "active" || row.status === "trialing" || row.status === "past_due"))
      return {
        plan: PLANS[row.plan],
        status: row.status === "past_due" ? "past_due" : "active",
        trialEndsAt: null,
        daysLeft: null,
        row,
      };
    const [org] = (await tx.execute(
      sql`select created_at from organization where id = ${organizationId}`,
    )) as unknown as { created_at: Date }[];
    const created = org ? new Date(org.created_at) : new Date();
    const trialEndsAt = new Date(created.getTime() + TRIAL_DAYS * 86_400_000);
    const msLeft = trialEndsAt.getTime() - Date.now();
    return {
      plan: PLANS.trial,
      status: msLeft > 0 && !row ? "trial" : "expired",
      trialEndsAt,
      daysLeft: Math.max(0, Math.ceil(msLeft / 86_400_000)),
      row: row ?? null,
    };
  });
}

/** Current usage across every workspace of the organization. */
export async function getUsage(organizationId: string): Promise<Record<LimitKey, number>> {
  const [r] = (await withSystem(getDb(), (tx) =>
    tx.execute(sql`
      with ws as (select id from workspaces where organization_id = ${organizationId})
      select
        (select count(*) from ws)::int as workspaces,
        (select count(*) from funnels f where f.workspace_id in (select id from ws) and f.archived_at is null)::int as funnels,
        (select count(*) from contacts c where c.workspace_id in (select id from ws))::int as contacts,
        (select count(*) from email_messages m where m.workspace_id in (select id from ws)
           and m.created_at >= date_trunc('month', now()) and coalesce(m.meta->>'test', 'false') <> 'true'
           and coalesce(m.meta->>'kind', '') <> 'login')::int as "emailsPerMonth",
        (select count(*) from domains d where d.workspace_id in (select id from ws))::int as domains,
        (select count(*) from member where organization_id = ${organizationId})::int as members`),
  )) as unknown as Record<LimitKey, number>[];
  return r!;
}

const UPGRADE = "Upgrade in Settings → Billing.";

/**
 * Gate for anything that consumes plan resources. Returns an error message to show,
 * or null when allowed. Published pages, opt-ins and checkouts are never blocked.
 */
export async function enforce(organizationId: string, key: LimitKey | FeatureKey, adding = 1): Promise<string | null> {
  const state = await getBillingState(organizationId);
  if (state.status === "expired")
    return "Your free trial has ended. Choose a plan in Settings → Billing to keep building. Your live funnels keep working.";
  if (key in FEATURE_LABELS) {
    const f = key as FeatureKey;
    return state.plan.features[f]
      ? null
      : `${FEATURE_LABELS[f]} isn't included in the ${state.plan.name} plan. ${UPGRADE}`;
  }
  const k = key as LimitKey;
  const limit = state.plan.limits[k];
  if (limit === null) return null;
  const used = (await getUsage(organizationId))[k];
  if (used + adding <= limit) return null;
  return `Your ${state.plan.name} plan includes ${limit.toLocaleString()} ${LIMIT_LABELS[k].toLowerCase()} (you have ${used.toLocaleString()}). ${UPGRADE}`;
}
