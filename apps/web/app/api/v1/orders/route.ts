import { contacts, desc, eq, inArray, orderItems, orders } from "@zfunnel/db";
import { authenticate, inApi } from "@/lib/api-auth";

/** GET /api/v1/orders?limit=50: newest first, with items and buyer email. */
export async function GET(req: Request) {
  const a = await authenticate(req);
  if (a instanceof Response) return a;
  const limit = Math.min(200, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 50));
  const data = await inApi(a, async (tx) => {
    const rows = await tx
      .select({ o: orders, email: contacts.email })
      .from(orders)
      .leftJoin(contacts, eq(contacts.id, orders.contactId))
      .orderBy(desc(orders.createdAt))
      .limit(limit);
    const items = rows.length
      ? await tx
          .select()
          .from(orderItems)
          .where(
            inArray(
              orderItems.orderId,
              rows.map((r) => r.o.id),
            ),
          )
      : [];
    return rows.map(({ o, email }) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      currency: o.currency,
      total: o.total,
      refunded: o.refundedAmount,
      test: o.test,
      email,
      createdAt: o.createdAt.toISOString(),
      paidAt: o.paidAt?.toISOString() ?? null,
      items: items
        .filter((i) => i.orderId === o.id)
        .map((i) => ({ product: i.productName, role: i.role, amount: i.amount, status: i.status })),
    }));
  });
  return Response.json({ data });
}
