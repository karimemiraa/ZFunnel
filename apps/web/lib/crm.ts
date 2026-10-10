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
  opportunities,
  orderItems,
  orders,
  pipelines,
  pipelineStages,
  schema,
  segmentCondition,
  segments,
  sql,
} from "@zfunnel/db";
import { inWorkspace } from "./funnels";
import type { WorkspaceContext } from "./workspaces";

export async function listContactsFiltered(
  ctx: WorkspaceContext,
  opts: { q?: string; tag?: string; segmentId?: string; limit?: number },
) {
  return inWorkspace(ctx, async (tx) => {
    const [segment] =
      opts.segmentId && /^[0-9a-f-]{36}$/i.test(opts.segmentId)
        ? await tx.select().from(segments).where(eq(segments.id, opts.segmentId))
        : [];
    const where = and(
      segment ? segmentCondition(segment.match, segment.rules) : undefined,
      opts.tag ? segmentCondition("all", [{ field: "tag", op: "has", value: opts.tag }]) : undefined,
      opts.q
        ? segmentCondition("any", [
            { field: "email", op: "contains", value: opts.q },
            { field: "name", op: "contains", value: opts.q },
          ])
        : undefined,
    );
    const [rows, [count]] = await Promise.all([
      tx
        .select({
          contact: contacts,
          orderCount: sql<number>`(select count(*)::int from orders o where o.contact_id = ${contacts.id} and o.status in ('paid','partially_refunded'))`,
          spent: sql<number>`(select coalesce(sum(o.total),0)::int from orders o where o.contact_id = ${contacts.id} and o.status in ('paid','partially_refunded'))`,
          funnelName: sql<string | null>`(select f.name from funnels f where f.id = ${contacts.sourceFunnelId})`,
        })
        .from(contacts)
        .where(where)
        .orderBy(desc(contacts.createdAt))
        .limit(opts.limit ?? 200),
      tx
        .select({ n: sql<number>`count(*)::int` })
        .from(contacts)
        .where(where),
    ]);
    return { rows, total: count?.n ?? 0 };
  });
}

export async function allTags(ctx: WorkspaceContext) {
  const rows = await inWorkspace(ctx, (tx) =>
    tx.execute(
      sql`select tag, count(*)::int as n from contacts, unnest(tags) as tag group by tag order by n desc, tag limit 100`,
    ),
  );
  return rows as unknown as { tag: string; n: number }[];
}

export async function getContactDetail(ctx: WorkspaceContext, contactId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(contactId)) return null;
  return inWorkspace(ctx, async (tx) => {
    const [c] = await tx.select().from(contacts).where(eq(contacts.id, contactId));
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
