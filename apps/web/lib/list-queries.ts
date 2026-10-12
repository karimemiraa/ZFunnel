import "server-only";

import {
  and,
  contacts,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  lt,
  or,
  orders,
  segmentCondition,
  segments,
  sql,
  type SQL,
  type Tx,
} from "@zfunnel/db";
import { dateRange, toCents, type ListFilters } from "./list-filters";

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const PAID = sql`('paid','partially_refunded')`;

/** Lifetime spend of the contact row in scope (cents). */
export const contactSpent = sql<number>`(select coalesce(sum(o.total),0)::int from orders o where o.contact_id = "contacts"."id" and o.status in ${PAID})`;
export const contactOrderCount = sql<number>`(select count(*)::int from orders o where o.contact_id = "contacts"."id" and o.status in ${PAID})`;

/** WHERE for the contacts list: never soft-deleted rows, plus an optional saved segment. */
export async function contactWhere(tx: Tx, f: ListFilters, segmentId?: string): Promise<SQL | undefined> {
  const [segment] =
    segmentId && /^[0-9a-f-]{36}$/i.test(segmentId)
      ? await tx.select().from(segments).where(eq(segments.id, segmentId))
      : [];
  const { start, end } = dateRange(f);
  const min = toCents(f.min);
  const max = toCents(f.max);
  const isCustomer = sql`exists (select 1 from orders o where o.contact_id = ${contacts.id} and o.status in ${PAID})`;
  return and(
    isNull(contacts.deletedAt),
    segment ? segmentCondition(segment.match, segment.rules) : undefined,
    f.q
      ? or(
          ilike(contacts.email, `%${escapeLike(f.q)}%`),
          ilike(sql`coalesce(${contacts.name}, '')`, `%${escapeLike(f.q)}%`),
        )
      : undefined,
    f.tags?.length
      ? sql`${contacts.tags} @> ${sql`array[${sql.join(
          f.tags.map((tg) => sql`${tg}`),
          sql`, `,
        )}]::text[]`}`
      : undefined,
    start ? gte(contacts.createdAt, start) : undefined,
    end ? lt(contacts.createdAt, end) : undefined,
    f.funnel ? eq(contacts.sourceFunnelId, f.funnel) : undefined,
    f.status === "customer" ? isCustomer : f.status === "lead" ? sql`not ${isCustomer}` : undefined,
    f.status === "unsubscribed" ? isNotNull(contacts.unsubscribedAt) : undefined,
    min !== undefined ? sql`${contactSpent} >= ${min}` : undefined,
    max !== undefined ? sql`${contactSpent} <= ${max}` : undefined,
  );
}

/** WHERE for the orders list (the query left-joins contacts for search and tags). */
export function orderWhere(f: ListFilters): SQL | undefined {
  const { start, end } = dateRange(f);
  const min = toCents(f.min);
  const max = toCents(f.max);
  const n = f.q ? Number(f.q.replace("#", "")) : NaN;
  return and(
    f.status ? eq(orders.status, f.status as never) : undefined,
    f.q
      ? or(
          ilike(contacts.email, `%${escapeLike(f.q)}%`),
          ilike(contacts.name, `%${escapeLike(f.q)}%`),
          Number.isInteger(n) && n > 0 ? eq(orders.number, n) : sql`false`,
        )
      : undefined,
    f.tags?.length
      ? sql`${contacts.tags} @> ${sql`array[${sql.join(
          f.tags.map((tg) => sql`${tg}`),
          sql`, `,
        )}]::text[]`}`
      : undefined,
    start ? gte(orders.createdAt, start) : undefined,
    end ? lt(orders.createdAt, end) : undefined,
    f.funnel ? eq(orders.funnelId, f.funnel) : undefined,
    min !== undefined ? gte(orders.total, min) : undefined,
    max !== undefined ? sql`${orders.total} <= ${max}` : undefined,
  );
}
