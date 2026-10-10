import { and, eq, orgBilling, orders, paymentAccounts, payments, subscriptions, sql } from "@zfunnel/db";
import {
  constructWebhookEvent,
  markPaymentFailed,
  markPaymentSucceeded,
  syncCommission,
  system,
  type Stripe,
} from "@zfunnel/payments";

/**
 * Stripe webhook. Events from connected accounts (customers' payments) and from the
 * platform account (ZFunnel's own subscriptions, see handlePlatform). The checkout API already
 * finalizes orders synchronously; this is the safety net for closed tabs, async payment
 * methods, renewals, refunds and account status changes. Every handler is idempotent.
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });
  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(await req.text(), signature);
  } catch (err) {
    console.error("[stripe webhook] bad signature", (err as Error).message);
    return new Response("invalid signature", { status: 400 });
  }

  try {
    await handle(event);
  } catch (err) {
    console.error(`[stripe webhook] ${event.type} failed`, err);
    return new Response("handler error", { status: 500 }); // Stripe retries
  }
  return Response.json({ received: true });
}

/** Events about ZFunnel's own subscriptions (platform account: no `event.account`). */
async function handlePlatform(event: Stripe.Event) {
  const planOf = (v: unknown) => (v === "starter" || v === "pro" || v === "scale" ? v : null);
  switch (event.type) {
    case "checkout.session.completed": {
      const cs = event.data.object;
      const orgId = cs.metadata?.zfunnel_organization_id;
      const plan = planOf(cs.metadata?.zfunnel_plan);
      if (cs.mode !== "subscription" || !orgId || !plan) return;
      await system((tx) =>
        tx
          .insert(orgBilling)
          .values({
            organizationId: orgId,
            plan,
            status: "active",
            provider: "stripe",
            stripeCustomerId: String(cs.customer),
            stripeSubscriptionId: String(cs.subscription),
          })
          .onConflictDoUpdate({
            target: orgBilling.organizationId,
            set: {
              plan,
              status: "active",
              provider: "stripe",
              stripeSubscriptionId: String(cs.subscription),
              cancelAtPeriodEnd: false,
            },
          }),
      );
      return;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const s = event.data.object;
      const orgId = s.metadata?.zfunnel_organization_id;
      if (!orgId) return;
      // Plan switches made in the billing portal show up as a new price lookup key.
      const key = s.items.data[0]?.price.lookup_key ?? "";
      const plan = planOf(/^zfunnel_(\w+)_monthly$/.exec(key)?.[1]) ?? planOf(s.metadata?.zfunnel_plan);
      const status =
        (["active", "trialing", "past_due", "canceled", "incomplete"] as const).find((x) => x === s.status) ??
        "canceled";
      await system((tx) =>
        tx
          .update(orgBilling)
          .set({
            ...(plan ? { plan } : {}),
            status: event.type === "customer.subscription.deleted" ? "canceled" : status,
            stripeSubscriptionId: s.id,
            cancelAtPeriodEnd: s.cancel_at_period_end,
            currentPeriodEnd: s.items.data[0]?.current_period_end
              ? new Date(s.items.data[0].current_period_end * 1000)
              : null,
          })
          .where(eq(orgBilling.organizationId, orgId)),
      );
      return;
    }
  }
}

async function handle(event: Stripe.Event) {
  if (!event.account) return handlePlatform(event);
  switch (event.type) {
    case "account.updated": {
      const a = event.data.object;
      await system((tx) =>
        tx
          .update(paymentAccounts)
          .set({
            chargesEnabled: Boolean(a.charges_enabled),
            detailsSubmitted: Boolean(a.details_submitted),
            displayName: a.business_profile?.name ?? a.settings?.dashboard?.display_name ?? null,
          })
          .where(and(eq(paymentAccounts.provider, "stripe"), eq(paymentAccounts.externalId, a.id))),
      );
      return;
    }
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      await system(async (tx) => {
        const [p] = await tx
          .select()
          .from(payments)
          .where(and(eq(payments.provider, "stripe"), eq(payments.externalId, pi.id)));
        if (!p) return;
        if (event.type === "payment_intent.succeeded") await markPaymentSucceeded(tx, p.id);
        else if (p.status !== "succeeded")
          await markPaymentFailed(tx, p.id, pi.last_payment_error?.message ?? "Payment failed");
      });
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const s = event.data.object;
      await system(async (tx) => {
        await tx
          .update(subscriptions)
          .set({
            status: s.status,
            cancelAtPeriodEnd: s.cancel_at_period_end,
            currentPeriodEnd: s.items.data[0]?.current_period_end
              ? new Date(s.items.data[0].current_period_end * 1000)
              : null,
          })
          .where(and(eq(subscriptions.provider, "stripe"), eq(subscriptions.externalId, s.id)));
        // First invoice of a checkout subscription paid → finalize its order if the tab was closed.
        if (s.status === "active" || s.status === "trialing") {
          const [p] = await tx
            .select()
            .from(payments)
            .where(and(eq(payments.provider, "stripe"), eq(payments.externalId, s.id)));
          if (p && p.status !== "succeeded") await markPaymentSucceeded(tx, p.id);
        }
      });
      return;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (!piId) return;
      await system(async (tx) => {
        const [p] = await tx
          .select()
          .from(payments)
          .where(and(eq(payments.provider, "stripe"), eq(payments.externalId, piId)));
        if (!p) return;
        // amount_refunded is cumulative per charge: store it per payment, then re-sum the order.
        const full = charge.amount_refunded >= charge.amount;
        await tx
          .update(payments)
          .set({ refundedAmount: charge.amount_refunded, ...(full ? { status: "refunded" as const } : {}) })
          .where(eq(payments.id, p.id));
        const [sum] = await tx
          .select({ refunded: sql<number>`coalesce(sum(${payments.refundedAmount}), 0)::int` })
          .from(payments)
          .where(eq(payments.orderId, p.orderId));
        const [order] = await tx.select().from(orders).where(eq(orders.id, p.orderId));
        if (!order) return;
        const refunded = Math.min(sum?.refunded ?? 0, order.total);
        await tx
          .update(orders)
          .set({
            refundedAmount: refunded,
            status: refunded >= order.total ? "refunded" : refunded > 0 ? "partially_refunded" : order.status,
          })
          .where(eq(orders.id, p.orderId));
        await syncCommission(tx, p.orderId);
      });
      return;
    }
    default:
      return;
  }
}
