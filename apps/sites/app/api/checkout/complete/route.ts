import { and, eq, orderItems, orders, payments, prices } from "@zfunnel/db";
import { enqueue } from "@zfunnel/queue";
import {
  chargeTestCard,
  logActivity,
  getPaymentSetup,
  markPaymentFailed,
  markPaymentSucceeded,
  recordTestSubscriptions,
  recordSubscription,
  retrievePaymentIntent,
  retrieveSubscription,
  saveProfile,
  SESSION_COOKIE,
  startFunnelSession,
  system,
} from "@zfunnel/payments";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, publicPost, sessionCookie } from "@/lib/api";
import { resolveStepForWorkspace } from "@/lib/resolve";
import { track } from "@/lib/track";

const bodySchema = z.object({
  orderId: z.string().uuid(),
  test: z.object({ card: z.string().max(30), expiry: z.string().max(10), cvc: z.string().max(5) }).optional(),
});

/**
 * Step 2 of checkout. The browser has confirmed payment (Stripe.js) or sent a test card;
 * we verify the result with the provider ourselves, never trusting the client.
 */
export async function POST(req: Request) {
  const g = await publicPost(req, "checkout-complete");
  if ("error" in g) return g.error;
  const parsed = bodySchema.safeParse(g.body);
  if (!parsed.success) return jsonError("Invalid request.");
  const { orderId, test } = parsed.data;

  const loaded = await system(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.workspaceId, g.ws.id)));
    if (!order) return null;
    const [payment] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, orderId), eq(payments.kind, "checkout")));
    const setup = await getPaymentSetup(tx, g.ws.id);
    return order && payment ? { order, payment, setup } : null;
  });
  if (!loaded) return jsonError("Order not found.", 404);
  const { order, payment, setup } = loaded;

  if (payment.status !== "succeeded") {
    if (order.provider === "test") {
      if (setup?.provider !== "test") return jsonError("Test payments are disabled.", 403);
      const r = chargeTestCard(test?.card ?? "", test?.expiry ?? "", test?.cvc ?? "");
      if (!r.ok) {
        await system((tx) => markPaymentFailed(tx, payment.id, r.message));
        return jsonError(r.message, 402);
      }
      await system(async (tx) => {
        await markPaymentSucceeded(tx, payment.id, { test: true, last4: r.last4 });
        await saveProfile(tx, {
          workspaceId: g.ws.id,
          contactId: order.contactId!,
          provider: "test",
          customerId: `test_cus_${order.contactId}`,
          paymentMethodId: r.paymentMethodId,
          brand: r.brand,
          last4: r.last4,
        });
        await recordTestSubscriptions(tx, { workspaceId: g.ws.id, contactId: order.contactId!, orderId: order.id });
      });
    } else {
      if (setup?.provider !== "stripe") return jsonError("Payments are not configured.", 503);
      const id = payment.externalId!;
      if (id.startsWith("sub_")) {
        const sub = await retrieveSubscription(setup.accountId, id);
        if (sub.status !== "active" && sub.status !== "trialing")
          return jsonError("Your payment hasn't gone through yet. Please try again.", 402);
        const pm = typeof sub.default_payment_method === "object" ? sub.default_payment_method : null;
        const raw = (payment.raw ?? {}) as { priceId?: string };
        await system(async (tx) => {
          await markPaymentSucceeded(tx, payment.id);
          await saveProfile(tx, {
            workspaceId: g.ws.id,
            contactId: order.contactId!,
            provider: "stripe",
            customerId: String(sub.customer),
            paymentMethodId: pm?.id,
            brand: pm?.card?.brand,
            last4: pm?.card?.last4,
          });
          await recordSubscription(tx, {
            workspaceId: g.ws.id,
            contactId: order.contactId!,
            priceId: raw.priceId ?? null,
            orderId: order.id,
            provider: "stripe",
            externalId: sub.id,
            status: sub.status,
            currentPeriodEnd: sub.items.data[0]?.current_period_end
              ? new Date(sub.items.data[0].current_period_end * 1000)
              : null,
          });
        });
      } else {
        const pi = await retrievePaymentIntent(setup.accountId, id);
        if (pi.status !== "succeeded") return jsonError("Your payment hasn't gone through yet. Please try again.", 402);
        const pm = typeof pi.payment_method === "object" ? pi.payment_method : null;
        await system(async (tx) => {
          await markPaymentSucceeded(tx, payment.id);
          await saveProfile(tx, {
            workspaceId: g.ws.id,
            contactId: order.contactId!,
            provider: "stripe",
            customerId: String(pi.customer),
            paymentMethodId: pm?.id ?? (typeof pi.payment_method === "string" ? pi.payment_method : null),
            brand: pm?.card?.brand,
            last4: pm?.card?.last4,
          });
        });
      }
    }
  }

  if (payment.status !== "succeeded" && order.contactId)
    await system(async (tx) => {
      const items = await tx
        .select({ name: orderItems.productName, productId: prices.productId })
        .from(orderItems)
        .leftJoin(prices, eq(prices.id, orderItems.priceId))
        .where(eq(orderItems.orderId, order.id));
      await logActivity(tx, {
        workspaceId: g.ws.id,
        contactId: order.contactId!,
        type: "purchase",
        body: `#${order.number}: ${items.map((i) => i.name).join(", ")}`,
        data: { orderId: order.id },
      });
      await enqueue("workflow-events", {
        workspaceId: g.ws.id,
        contactId: order.contactId!,
        type: "purchase",
        data: {
          orderId: order.id,
          funnelId: order.funnelId ?? undefined,
          productIds: items.flatMap((i) => (i.productId ? [i.productId] : [])).join(","),
        },
      });
    });
  if (payment.status !== "succeeded")
    await track(req.headers, {
      workspaceId: g.ws.id,
      funnelId: order.funnelId!,
      stepId: order.stepId!,
      type: "purchase",
      revenue: payment.amount,
      currency: payment.currency,
    });
  const session = await system((tx) =>
    startFunnelSession(tx, {
      workspaceId: g.ws.id,
      funnelId: order.funnelId!,
      contactId: order.contactId!,
      orderId: order.id,
    }),
  );
  const step = order.stepId ? await resolveStepForWorkspace(g.ws.id, order.stepId) : null;
  const res = NextResponse.json({ ok: true, redirect: step?.nextPath ?? null });
  res.cookies.set(SESSION_COOKIE, session.id, sessionCookie);
  return res;
}
