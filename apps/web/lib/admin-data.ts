import "server-only";

import {
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  orgBilling,
  organizationSuspensions,
  platformAuditLog,
  schema,
  sql,
  workspaces,
} from "@zfunnel/db";
import { PLANS } from "@zfunnel/shared";
import { asAdmin } from "./admin";

/**
 * Read models for the platform admin area. Every function goes through asAdmin, which runs
 * the admin guard before opening the cross-tenant system context.
 */

const { organization, user, member } = schema;
export const ADMIN_PAGE_SIZE = 25;

/** Postgres LIKE pattern for a user's search text, with wildcards escaped. */
function like(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function getPlatformOverview() {
  return asAdmin(async (tx) => {
    const [totals] = (await tx.execute(sql`
      select
        (select count(*) from "user")::int as users,
        (select count(*) from "user" where created_at >= now() - interval '30 days')::int as users30,
        (select count(*) from organization)::int as orgs,
        (select count(distinct m.organization_id) from member m
           join session s on s.user_id = m.user_id
           where s.updated_at >= now() - interval '30 days')::int as "activeOrgs",
        (select count(*) from workspaces)::int as workspaces`)) as unknown as {
      users: number;
      users30: number;
      orgs: number;
      activeOrgs: number;
      workspaces: number;
    }[];

    // Platform MRR from ZFunnel's own subscriptions (org_billing), at list price.
    const paid = await tx
      .select({ plan: orgBilling.plan })
      .from(orgBilling)
      .where(inArray(orgBilling.status, ["active", "trialing", "past_due"]));
    const mrr = paid.reduce((sum, r) => sum + (PLANS[r.plan]?.monthly ?? 0), 0);

    // GMV: paid customer orders (minus refunds), real money only, last 30 days, per currency.
    const gmv = (await tx.execute(sql`
      select currency, sum(total - refunded_amount)::bigint as amount
      from orders
      where status in ('paid', 'partially_refunded') and test = false
        and created_at >= now() - interval '30 days'
      group by currency order by amount desc`)) as unknown as { currency: string; amount: string }[];

    const days = (await tx.execute(sql`
      select to_char(d, 'YYYY-MM-DD') as day,
             (select count(*) from "user" u where u.created_at >= d and u.created_at < d + interval '1 day')::int as value
      from generate_series((current_date - 29)::timestamp, current_date::timestamp, interval '1 day') d
      order by d`)) as unknown as { day: string; value: number }[];

    return {
      ...totals!,
      mrr,
      payingOrgs: paid.length,
      gmv: gmv.map((g) => ({ currency: g.currency, amount: Number(g.amount) })),
      signups: days.map((d) => ({ day: d.day, value: d.value })),
    };
  });
}

export async function listOrganizations(q: string, page: number) {
  return asAdmin(async (tx) => {
    const where = q ? or(ilike(organization.name, like(q)), ilike(organization.slug, like(q))) : undefined;
    const [{ total }] = (await tx.select({ total: count() }).from(organization).where(where)) as [{ total: number }];
    const rows = await tx
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt,
        plan: orgBilling.plan,
        billingStatus: orgBilling.status,
        suspendedAt: organizationSuspensions.createdAt,
        members: sql<number>`(select count(*) from member m where m.organization_id = ${organization.id})::int`,
        workspaces: sql<number>`(select count(*) from workspaces w where w.organization_id = ${organization.id})::int`,
      })
      .from(organization)
      .leftJoin(orgBilling, eq(orgBilling.organizationId, organization.id))
      .leftJoin(organizationSuspensions, eq(organizationSuspensions.organizationId, organization.id))
      .where(where)
      .orderBy(desc(organization.createdAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE);
    return { rows, total, pages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
  });
}

export async function getOrganizationDetail(id: string) {
  return asAdmin(async (tx) => {
    const [org] = await tx
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt,
        suspendedAt: organizationSuspensions.createdAt,
        suspendReason: organizationSuspensions.reason,
      })
      .from(organization)
      .leftJoin(organizationSuspensions, eq(organizationSuspensions.organizationId, organization.id))
      .where(eq(organization.id, id));
    if (!org) return null;
    const [billing] = await tx.select().from(orgBilling).where(eq(orgBilling.organizationId, id));
    const members = await tx
      .select({ id: member.id, role: member.role, joined: member.createdAt, name: user.name, email: user.email })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, id))
      .orderBy(member.createdAt);
    const wsRows = await tx
      .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug, createdAt: workspaces.createdAt })
      .from(workspaces)
      .where(eq(workspaces.organizationId, id))
      .orderBy(workspaces.name);
    const [usage] = (await tx.execute(sql`
      with ws as (select id from workspaces where organization_id = ${id})
      select
        (select count(*) from funnels f where f.workspace_id in (select id from ws) and f.archived_at is null)::int as funnels,
        (select count(*) from contacts c where c.workspace_id in (select id from ws))::int as contacts,
        (select count(*) from orders o where o.workspace_id in (select id from ws))::int as orders`)) as unknown as {
      funnels: number;
      contacts: number;
      orders: number;
    }[];
    return { org, billing: billing ?? null, members, workspaces: wsRows, usage: usage! };
  });
}

export async function listUsers(q: string, page: number) {
  return asAdmin(async (tx) => {
    const where = q ? or(ilike(user.name, like(q)), ilike(user.email, like(q))) : undefined;
    const [{ total }] = (await tx.select({ total: count() }).from(user).where(where)) as [{ total: number }];
    const rows = await tx
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        organizations: sql<string[]>`coalesce((select array_agg(o.name order by o.name) from member m
          join organization o on o.id = m.organization_id where m.user_id = ${user.id}), '{}')`,
      })
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE);
    return { rows, total, pages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
  });
}

export async function listAdminAudit(page: number) {
  return asAdmin(async (tx) => {
    const [{ total }] = (await tx.select({ total: count() }).from(platformAuditLog)) as [{ total: number }];
    const rows = await tx
      .select({
        id: platformAuditLog.id,
        action: platformAuditLog.action,
        targetType: platformAuditLog.targetType,
        targetId: platformAuditLog.targetId,
        metadata: platformAuditLog.metadata,
        createdAt: platformAuditLog.createdAt,
        adminName: user.name,
        adminEmail: user.email,
      })
      .from(platformAuditLog)
      .leftJoin(user, eq(user.id, platformAuditLog.adminUserId))
      .orderBy(desc(platformAuditLog.createdAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE);
    return { rows, total, pages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
  });
}

/** Parses ?page= into a positive integer. */
export function pageParam(raw: string | string[] | undefined) {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
