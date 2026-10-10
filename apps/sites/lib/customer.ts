import "server-only";

import { signValue, verifyValue } from "@zfunnel/email";
import { and, contacts, desc, eq, inArray, orderItems, orders, prices, products, subscriptions } from "@zfunnel/db";
import { system } from "@zfunnel/payments";
import { cookies } from "next/headers";

export const CUSTOMER_COOKIE = "zf_cust";
const SESSION_DAYS = 7;
export const LOGIN_LINK_MINUTES = 30;

export function customerCookieValue(contactId: string, workspaceId: string) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86_400;
  return signValue("customer", `${contactId}:${workspaceId}:${exp}`);
}

export const customerCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 86_400,
};

/** The signed-in customer for this workspace, or null. */
export async function currentCustomer(workspaceId: string) {
  const raw = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  const v = raw ? verifyValue("customer", raw) : null;
  if (!v) return null;
  const [contactId, ws, exp] = v.split(":");
  if (ws !== workspaceId || !contactId || Number(exp) < Date.now() / 1000) return null;
  const [c] = await system((tx) =>
    tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.workspaceId, workspaceId))),
  );
  return c ?? null;
}

/** Scheme + host the visitor used (Caddy sets x-forwarded-proto in production). */
export function requestOrigin(h: Headers) {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto.split(",")[0]!.trim()}://${host}`;
}

export async function customerAccount(workspaceId: string, contactId: string) {
  return system(async (tx) => {
    const orderRows = await tx
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.workspaceId, workspaceId),
          eq(orders.contactId, contactId),
          inArray(orders.status, ["paid", "refunded", "partially_refunded"]),
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(100);
    const items = orderRows.length
      ? await tx
          .select({
            orderId: orderItems.orderId,
            name: orderItems.productName,
            label: orderItems.priceLabel,
            amount: orderItems.amount,
            status: orderItems.status,
          })
          .from(orderItems)
          .where(
            inArray(
              orderItems.orderId,
              orderRows.map((o) => o.id),
            ),
          )
      : [];
    const subs = await tx
      .select({
        s: subscriptions,
        product: products.name,
        amount: prices.amount,
        currency: prices.currency,
        interval: prices.interval,
      })
      .from(subscriptions)
      .leftJoin(prices, eq(prices.id, subscriptions.priceId))
      .leftJoin(products, eq(products.id, prices.productId))
      .where(and(eq(subscriptions.workspaceId, workspaceId), eq(subscriptions.contactId, contactId)))
      .orderBy(desc(subscriptions.createdAt));
    return {
      orders: orderRows.map((o) => ({ ...o, items: items.filter((i) => i.orderId === o.id && i.status === "paid") })),
      subscriptions: subs,
    };
  });
}
