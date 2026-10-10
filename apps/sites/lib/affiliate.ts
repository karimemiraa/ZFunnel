import "server-only";

import { affiliates, affiliateSettings, and, commissions, desc, eq, orders, type Tx } from "@zfunnel/db";
import { system } from "@zfunnel/payments";

/** Parses the zf_aff cookie ("code.timestamp"). */
export function parseAffCookie(v: string | undefined) {
  const m = v ? /^([a-z0-9-]{3,32})\.(\d{10,14})$/.exec(v) : null;
  return m ? { code: m[1]!, at: Number(m[2]) } : null;
}

/**
 * Affiliate to credit for an order, if any: the program must be on, the click inside the
 * cookie window, and the affiliate can't be the buyer.
 */
export async function affiliateForOrder(
  tx: Tx,
  workspaceId: string,
  cookie: string | undefined,
  buyerContactId: string,
) {
  const ref = parseAffCookie(cookie);
  if (!ref) return null;
  const [settings] = await tx.select().from(affiliateSettings).where(eq(affiliateSettings.workspaceId, workspaceId));
  if (!settings?.enabled || Date.now() - ref.at > settings.cookieDays * 86_400_000) return null;
  const [a] = await tx
    .select()
    .from(affiliates)
    .where(
      and(eq(affiliates.workspaceId, workspaceId), eq(affiliates.code, ref.code), eq(affiliates.status, "active")),
    );
  if (!a || a.contactId === buyerContactId) return null;
  return a.id;
}

export async function affiliateProgram(workspaceId: string) {
  const [s] = await system((tx) =>
    tx.select().from(affiliateSettings).where(eq(affiliateSettings.workspaceId, workspaceId)),
  );
  return s?.enabled ? s : null;
}

export async function affiliateDashboard(workspaceId: string, contactId: string) {
  return system(async (tx) => {
    const [a] = await tx
      .select()
      .from(affiliates)
      .where(and(eq(affiliates.workspaceId, workspaceId), eq(affiliates.contactId, contactId)));
    if (!a) return null;
    const list = await tx
      .select({ c: commissions, number: orders.number, total: orders.total })
      .from(commissions)
      .innerJoin(orders, eq(orders.id, commissions.orderId))
      .where(eq(commissions.affiliateId, a.id))
      .orderBy(desc(commissions.createdAt))
      .limit(50);
    const sum = (st: string) => list.filter((x) => x.c.status === st).reduce((s, x) => s + x.c.amount, 0);
    return {
      a,
      list,
      pending: sum("pending"),
      paid: sum("paid"),
      referrals: list.filter((x) => x.c.status !== "void").length,
      currency: list[0]?.c.currency ?? "usd",
    };
  });
}
