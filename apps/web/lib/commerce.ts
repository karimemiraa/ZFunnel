import "server-only";

import {
  and,
  asc,
  contacts,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  orderItems,
  orders,
  paymentAccounts,
  prices,
  products,
  sql,
  stepOffers,
  subscriptions,
} from "@zfunnel/db";
import { getStepOffers, toRuntimeOffers } from "@zfunnel/payments";
import { inWorkspace } from "./funnels";
import type { WorkspaceContext } from "./workspaces";

export async function listProducts(ctx: WorkspaceContext) {
  return inWorkspace(ctx, async (tx) => {
    const list = await tx.select().from(products).where(isNull(products.archivedAt)).orderBy(desc(products.createdAt));
    const priceRows = list.length
      ? await tx
          .select()
          .from(prices)
          .where(
            and(
              inArray(
                prices.productId,
                list.map((p) => p.id),
              ),
              isNull(prices.archivedAt),
            ),
          )
          .orderBy(asc(prices.createdAt))
      : [];
    const sales = list.length
      ? await tx
          .select({
            productId: prices.productId,
            revenue: sql<number>`coalesce(sum(${orderItems.amount}),0)::int`,
            count: sql<number>`count(*)::int`,
          })
          .from(orderItems)
          .innerJoin(prices, eq(prices.id, orderItems.priceId))
          .where(eq(orderItems.status, "paid"))
          .groupBy(prices.productId)
      : [];
    return list.map((p) => ({
      ...p,
      prices: priceRows.filter((r) => r.productId === p.id),
      sales: sales.find((s) => s.productId === p.id) ?? { revenue: 0, count: 0 },
    }));
  });
}
export type ProductWithPrices = Awaited<ReturnType<typeof listProducts>>[number];

export async function getStepOfferList(ctx: WorkspaceContext, stepId: string) {
  return inWorkspace(ctx, (tx) => getStepOffers(tx, stepId));
}

export async function getEditorOffers(ctx: WorkspaceContext, stepId: string) {
  return toRuntimeOffers(await getStepOfferList(ctx, stepId));
}

export async function getPaymentAccount(ctx: WorkspaceContext) {
  return inWorkspace(ctx, async (tx) => {
    const [a] = await tx.select().from(paymentAccounts).where(eq(paymentAccounts.provider, "stripe"));
    return a ?? null;
  });
}

export async function listOrders(ctx: WorkspaceContext, opts: { q?: string; status?: string; limit?: number } = {}) {
  return inWorkspace(ctx, async (tx) => {
    const filters = [];
    if (opts.status && opts.status !== "all") filters.push(eq(orders.status, opts.status as never));
    if (opts.q) {
      const n = Number(opts.q.replace("#", ""));
      filters.push(
        or(
          ilike(contacts.email, `%${opts.q}%`),
          ilike(contacts.name, `%${opts.q}%`),
          Number.isInteger(n) && n > 0 ? eq(orders.number, n) : sql`false`,
        ),
      );
    }
    const rows = await tx
      .select({ order: orders, email: contacts.email, name: contacts.name })
      .from(orders)
      .leftJoin(contacts, eq(contacts.id, orders.contactId))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(opts.limit ?? 100);
    const items = rows.length
      ? await tx
          .select()
          .from(orderItems)
          .where(
            inArray(
              orderItems.orderId,
              rows.map((r) => r.order.id),
            ),
          )
          .orderBy(asc(orderItems.createdAt))
      : [];
    return rows.map((r) => ({
      ...r.order,
      email: r.email,
      name: r.name,
      items: items.filter((i) => i.orderId === r.order.id),
    }));
  });
}
export type OrderRow = Awaited<ReturnType<typeof listOrders>>[number];

export async function orderStats(ctx: WorkspaceContext) {
  return inWorkspace(ctx, async (tx) => {
    // Never add different currencies together: one row per currency, the biggest first.
    const rows = await tx
      .select({
        revenue: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} in ('paid','partially_refunded')), 0)::int`,
        paidCount: sql<number>`count(*) filter (where ${orders.status} in ('paid','partially_refunded'))::int`,
        last30: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} in ('paid','partially_refunded') and ${orders.paidAt} > now() - interval '30 days'), 0)::int`,
        currency: orders.currency,
      })
      .from(orders)
      .groupBy(orders.currency);
    rows.sort((a, b) => b.revenue - a.revenue);
    const row = rows[0] ?? { revenue: 0, paidCount: 0, last30: 0, currency: "usd" };
    const others = rows.slice(1).filter((r) => r.revenue > 0);
    const [subs] = await tx
      .select({ active: sql<number>`count(*) filter (where ${subscriptions.status} in ('active','trialing'))::int` })
      .from(subscriptions);
    return { ...row, others, activeSubscriptions: subs?.active ?? 0 };
  });
}

export async function listContacts(ctx: WorkspaceContext, opts: { q?: string; limit?: number } = {}) {
  return inWorkspace(ctx, async (tx) => {
    const where = opts.q ? or(ilike(contacts.email, `%${opts.q}%`), ilike(contacts.name, `%${opts.q}%`)) : undefined;
    return tx
      .select({
        contact: contacts,
        orderCount: sql<number>`(select count(*)::int from orders o where o.contact_id = "contacts"."id" and o.status in ('paid','partially_refunded'))`,
        spent: sql<number>`(select coalesce(sum(o.total),0)::int from orders o where o.contact_id = "contacts"."id" and o.status in ('paid','partially_refunded'))`,
        funnelName: sql<string | null>`(select f.name from funnels f where f.id = ${contacts.sourceFunnelId})`,
      })
      .from(contacts)
      .where(where)
      .orderBy(desc(contacts.createdAt))
      .limit(opts.limit ?? 200);
  });
}

export async function countStepOffers(ctx: WorkspaceContext, stepIds: string[]) {
  if (!stepIds.length) return new Map<string, number>();
  const rows = await inWorkspace(ctx, (tx) =>
    tx
      .select({ stepId: stepOffers.stepId, n: sql<number>`count(*)::int` })
      .from(stepOffers)
      .where(inArray(stepOffers.stepId, stepIds))
      .groupBy(stepOffers.stepId),
  );
  return new Map(rows.map((r) => [r.stepId, r.n]));
}
