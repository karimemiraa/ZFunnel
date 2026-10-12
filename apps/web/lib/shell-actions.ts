"use server";

import {
  and,
  contacts,
  conversations,
  count,
  courses,
  desc,
  eq,
  funnels,
  funnelSteps,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  not,
  notifications,
  or,
  orders,
  products,
  sql,
  type NotificationType,
} from "@zfunnel/db";
import { inWorkspace } from "./funnels";
import { requireUser } from "./session";
import { getWorkspaceForUser } from "./workspaces";

/**
 * Dashboard shell data (Phase 8.1 badges, 8.3 search, 8.5i notifications). Every query runs through
 * withWorkspace (inWorkspace), so RLS limits it to the member's workspace. All of it is polled or
 * typed into, so each query is a small indexed count or a LIMITed lookup.
 */

async function ctxFor(workspaceSlug: string) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  return ctx ? { user, ctx } : null;
}

export type ShellNotification = {
  id: string;
  type: NotificationType;
  entityId: string | null;
  data: Record<string, string | number | null>;
  read: boolean;
  createdAt: string;
};

export type ShellPoll = {
  inbox: number;
  orders: number;
  unread: number;
  notifications: ShellNotification[];
};

const DAY = 86_400_000;

/**
 * Badge counts and the latest notifications. `ordersSince` is the client's last visit to Orders;
 * new orders count from then, or from 24 hours ago when there is no (valid, recent) last visit.
 */
export async function pollShell(workspaceSlug: string, ordersSince?: string | null): Promise<ShellPoll | null> {
  const found = await ctxFor(workspaceSlug);
  if (!found) return null;
  const { user, ctx } = found;
  const last = ordersSince ? new Date(ordersSince) : null;
  const floor = Date.now() - 30 * DAY;
  const since =
    last && !Number.isNaN(last.getTime()) && last.getTime() > floor && last.getTime() <= Date.now()
      ? last
      : new Date(Date.now() - DAY);
  return inWorkspace(ctx, async (tx) => {
    const [inbox] = await tx
      .select({ n: count() })
      .from(conversations)
      .where(and(eq(conversations.status, "open"), eq(conversations.unread, true)));
    const [newOrders] = await tx
      .select({ n: count() })
      .from(orders)
      .where(and(gte(orders.createdAt, since), isNotNull(orders.paidAt)));
    const notRead = not(sql`${user.id} = any(${notifications.readBy})`);
    const [unread] = await tx
      .select({ n: count() })
      .from(notifications)
      .where(and(notRead, gte(notifications.createdAt, new Date(Date.now() - 30 * DAY))));
    const rows = await tx
      .select({
        id: notifications.id,
        type: notifications.type,
        entityId: notifications.entityId,
        data: notifications.data,
        createdAt: notifications.createdAt,
        read: sql<boolean>`${user.id} = any(${notifications.readBy})`,
      })
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(20);
    return {
      inbox: inbox?.n ?? 0,
      orders: newOrders?.n ?? 0,
      unread: unread?.n ?? 0,
      notifications: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    };
  });
}

/** Marks the given notifications (or all of them) as read for the current user only. */
export async function markNotificationsRead(workspaceSlug: string, ids?: string[]): Promise<{ ok: boolean }> {
  const found = await ctxFor(workspaceSlug);
  if (!found) return { ok: false };
  const { user, ctx } = found;
  const valid = ids?.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100);
  if (ids && !valid?.length) return { ok: true };
  await inWorkspace(ctx, (tx) =>
    tx
      .update(notifications)
      .set({ readBy: sql`array_append(${notifications.readBy}, ${user.id})` })
      .where(
        and(not(sql`${user.id} = any(${notifications.readBy})`), valid ? inArray(notifications.id, valid) : undefined),
      ),
  );
  return { ok: true };
}

export type SearchHit = {
  kind: "funnel" | "page" | "contact" | "order" | "product" | "course";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

const LIMIT = 5;
/** Escapes LIKE wildcards so "50%" searches for the text, not a pattern. */
const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Command palette search: a handful of matches per record type, scoped to one workspace. */
export async function searchWorkspace(workspaceSlug: string, query: string): Promise<SearchHit[]> {
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];
  const found = await ctxFor(workspaceSlug);
  if (!found) return [];
  const { ctx } = found;
  const base = `/${ctx.workspace.slug}`;
  const pattern = like(q);
  const n = Number(q.replace(/^#/, ""));
  return inWorkspace(ctx, async (tx) => {
    const hits: SearchHit[] = [];
    const fs = await tx
      .select({ id: funnels.id, name: funnels.name })
      .from(funnels)
      .where(and(isNull(funnels.archivedAt), ilike(funnels.name, pattern)))
      .orderBy(desc(funnels.createdAt))
      .limit(LIMIT);
    for (const f of fs) hits.push({ kind: "funnel", id: f.id, title: f.name, href: `${base}/funnels/${f.id}` });

    const steps = await tx
      .select({ id: funnelSteps.id, name: funnelSteps.name, funnelId: funnels.id, funnel: funnels.name })
      .from(funnelSteps)
      .innerJoin(funnels, eq(funnels.id, funnelSteps.funnelId))
      .where(and(isNull(funnels.archivedAt), ilike(funnelSteps.name, pattern)))
      .limit(LIMIT);
    for (const s of steps)
      hits.push({
        kind: "page",
        id: s.id,
        title: s.name,
        subtitle: s.funnel,
        href: `${base}/funnels/${s.funnelId}?step=${s.id}`,
      });

    const cs = await tx
      .select({ id: contacts.id, name: contacts.name, email: contacts.email })
      .from(contacts)
      .where(or(ilike(contacts.email, pattern), ilike(contacts.name, pattern)))
      .orderBy(desc(contacts.createdAt))
      .limit(LIMIT);
    for (const c of cs)
      hits.push({
        kind: "contact",
        id: c.id,
        title: c.name || c.email,
        subtitle: c.name ? c.email : undefined,
        href: `${base}/contacts/${c.id}`,
      });

    const os = await tx
      .select({ id: orders.id, number: orders.number, email: contacts.email, name: contacts.name })
      .from(orders)
      .leftJoin(contacts, eq(contacts.id, orders.contactId))
      .where(
        Number.isInteger(n) && n > 0 && n < 2_147_483_647
          ? eq(orders.number, n)
          : or(ilike(contacts.email, pattern), ilike(contacts.name, pattern)),
      )
      .orderBy(desc(orders.createdAt))
      .limit(LIMIT);
    for (const o of os)
      hits.push({
        kind: "order",
        id: o.id,
        title: String(o.number),
        subtitle: o.name || o.email || undefined,
        href: `${base}/orders?q=${o.number}`,
      });

    const ps = await tx
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(isNull(products.archivedAt), ilike(products.name, pattern)))
      .limit(LIMIT);
    for (const p of ps) hits.push({ kind: "product", id: p.id, title: p.name, href: `${base}/products` });

    const crs = await tx
      .select({ id: courses.id, title: courses.title })
      .from(courses)
      .where(ilike(courses.title, pattern))
      .limit(LIMIT);
    for (const c of crs) hits.push({ kind: "course", id: c.id, title: c.title, href: `${base}/courses/${c.id}` });

    return hits;
  });
}
