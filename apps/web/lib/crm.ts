import "server-only";

import {
  and,
  asc,
  contactActivities,
  contactFields,
  contacts,
  desc,
  eq,
  funnels,
  inArray,
  isNull,
  opportunities,
  orderItems,
  orders,
  pipelines,
  pipelineStages,
  schema,
  segments,
  sql,
} from "@zfunnel/db";
import { inWorkspace } from "./funnels";
import type { ListFilters } from "./list-filters";
import { contactOrderCount, contactSpent, contactWhere } from "./list-queries";
import type { WorkspaceContext } from "./workspaces";

/** One page of the contacts list with the filter bar's filters (and an optional saved segment). */
export async function listContactsFiltered(
  ctx: WorkspaceContext,
  opts: { filters: ListFilters; segmentId?: string; ids?: string[]; limit?: number; offset?: number },
) {
  return inWorkspace(ctx, async (tx) => {
    const where = and(
      await contactWhere(tx, opts.filters, opts.segmentId),
      opts.ids
        ? inArray(contacts.id, opts.ids.length ? opts.ids : ["00000000-0000-0000-0000-000000000000"])
        : undefined,
    );
    const [rows, [count]] = await Promise.all([
      tx
        .select({
          contact: contacts,
          orderCount: contactOrderCount,
          spent: contactSpent,
          funnelName: sql<string | null>`(select f.name from funnels f where f.id = ${contacts.sourceFunnelId})`,
        })
        .from(contacts)
        .where(where)
        .orderBy(desc(contacts.createdAt), desc(contacts.id))
        .limit(opts.limit ?? 50)
        .offset(opts.offset ?? 0),
      tx
        .select({ n: sql<number>`count(*)::int` })
        .from(contacts)
        .where(where),
    ]);
    return { rows, total: count?.n ?? 0 };
  });
}

/** Ids of every contact matching the filters ("select all" in bulk actions), capped. */
export async function matchingContactIds(
  ctx: WorkspaceContext,
  filters: ListFilters,
  segmentId?: string,
  cap = 10_000,
) {
  return inWorkspace(ctx, async (tx) => {
    const rows = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(await contactWhere(tx, filters, segmentId))
      .limit(cap);
    return rows.map((r) => r.id);
  });
}

export async function allTags(ctx: WorkspaceContext) {
  const rows = await inWorkspace(ctx, (tx) =>
    tx.execute(
      sql`select tag, count(*)::int as n from contacts, unnest(tags) as tag where deleted_at is null group by tag order by n desc, tag limit 100`,
    ),
  );
  return rows as unknown as { tag: string; n: number }[];
}

export async function getContactDetail(ctx: WorkspaceContext, contactId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(contactId)) return null;
  return inWorkspace(ctx, async (tx) => {
    const [c] = await tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, contactId), isNull(contacts.deletedAt)));
    if (!c) return null;
    const [activity, contactOrders, fields, deals, sourceFunnel] = await Promise.all([
      tx
        .select({ a: contactActivities, actor: schema.user.name })
        .from(contactActivities)
        .leftJoin(schema.user, eq(schema.user.id, contactActivities.actorUserId))
        .where(eq(contactActivities.contactId, contactId))
        .orderBy(desc(contactActivities.createdAt))
        .limit(100),
      tx.select().from(orders).where(eq(orders.contactId, contactId)).orderBy(desc(orders.createdAt)),
      tx.select().from(contactFields).orderBy(asc(contactFields.position)),
      tx
        .select({
          deal: opportunities,
          stage: pipelineStages.name,
          color: pipelineStages.color,
          pipeline: pipelines.name,
        })
        .from(opportunities)
        .innerJoin(pipelineStages, eq(pipelineStages.id, opportunities.stageId))
        .innerJoin(pipelines, eq(pipelines.id, opportunities.pipelineId))
        .where(eq(opportunities.contactId, contactId)),
      c.sourceFunnelId
        ? tx.select({ name: funnels.name }).from(funnels).where(eq(funnels.id, c.sourceFunnelId))
        : Promise.resolve([]),
    ]);
    const items = contactOrders.length
      ? await tx
          .select()
          .from(orderItems)
          .where(
            inArray(
              orderItems.orderId,
              contactOrders.map((o) => o.id),
            ),
          )
      : [];
    return {
      contact: c,
      activity,
      orders: contactOrders.map((o) => ({ ...o, items: items.filter((i) => i.orderId === o.id) })),
      fields,
      deals,
      sourceFunnel: sourceFunnel[0]?.name ?? null,
    };
  });
}

export async function listSegments(ctx: WorkspaceContext) {
  return inWorkspace(ctx, (tx) => tx.select().from(segments).orderBy(asc(segments.name)));
}

export async function listFields(ctx: WorkspaceContext) {
  return inWorkspace(ctx, (tx) => tx.select().from(contactFields).orderBy(asc(contactFields.position)));
}

export async function getPipelineBoard(ctx: WorkspaceContext, pipelineId?: string) {
  return inWorkspace(ctx, async (tx) => {
    const all = await tx.select().from(pipelines).orderBy(asc(pipelines.position), asc(pipelines.createdAt));
    const current = all.find((p) => p.id === pipelineId) ?? all[0];
    if (!current) return { pipelines: all, current: null, stages: [], deals: [] };
    const stages = await tx
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, current.id))
      .orderBy(asc(pipelineStages.position));
    const deals = await tx
      .select({ deal: opportunities, contactName: contacts.name, contactEmail: contacts.email })
      .from(opportunities)
      .leftJoin(contacts, eq(contacts.id, opportunities.contactId))
      .where(eq(opportunities.pipelineId, current.id))
      .orderBy(asc(opportunities.position), desc(opportunities.createdAt));
    return { pipelines: all, current, stages, deals };
  });
}
