import { eq, orderItems, payments } from "@zfunnel/db";
import {
  chargeOffSession,
  claimStep,
  createSubscription,
  ensureStripePrice,
  getFunnelSession,
  getPaymentSetup,
  getProfile,
  getStepOffers,
  markPaymentFailed,
  markPaymentSucceeded,
  recordSubscription,
  releaseStep,
  SESSION_COOKIE,
  system,
} from "@zfunnel/payments";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, publicPost } from "@/lib/api";
import { resolveStepForWorkspace } from "@/lib/resolve";

const bodySchema = z.object({ stepId: z.string().uuid(), offerId: z.string().uuid().optional() });

/** One-click upsell: charges the card saved at checkout and adds the item to the same order. */
export async function POST(req: Request) {
  const g = await publicPost(req, "upsell");
  if ("error" in g) return g.error;
  const parsed = bodySchema.safeParse(g.body);
  if (!parsed.success) return jsonError("Invalid request.");
  const { stepId, offerId } = parsed.data;

  const step = await resolveStepForWorkspace(g.ws.id, stepId);
  if (!step) return jsonError("This offer is no longer available.", 404);
  const sessionId = (await cookies()).get(SESSION_COOKIE)?.value;

  const prep = await system(async (tx) => {
    const session = await getFunnelSession(tx, g.ws.id, sessionId);
    if (!session?.orderId || !session.contactId || session.funnelId !== step.funnelId)
      return { error: "Your session has expired. Please start the checkout again.", status: 410 };
    const offers = (await getStepOffers(tx, stepId)).filter((o) => o.role === "upsell" || o.role === "downsell");
    const offer = offerId ? offers.find((o) => o.offerId === offerId) : offers[0];
    if (!offer) return { error: "This offer isn't set up yet.", status: 404 };
    const setup = await getPaymentSetup(tx, g.ws.id);
    if (!setup) return { error: "Payments are not available.", status: 503 };
    const profile = await getProfile(tx, session.contactId, setup.provider);
    if (!profile?.paymentMethodId)
      return { error: "We couldn't find your saved card. Please contact support.", status: 409 };
    // Claim first: a double click or replay can never charge twice.
    if (!(await claimStep(tx, session.id, stepId))) return { alreadyHandled: true as const };
    const [p] = await tx
      .insert(payments)
      .values({
        workspaceId: g.ws.id,
        orderId: session.orderId,
        provider: setup.provider,
        kind: "upsell",
        amount: offer.trialDays ? 0 : offer.amount,
        currency: offer.currency,
      })
      .returning();
    await tx.insert(orderItems).values({
      workspaceId: g.ws.id,
      orderId: session.orderId,
      priceId: offer.priceId,
      role: offer.role,
      productName: offer.productName,
      priceLabel: offer.label,
      amount: offer.trialDays ? 0 : offer.amount,
      paymentId: p!.id,
    });
    return { session, offer, setup, profile, paymentId: p!.id };
  });

  if ("alreadyHandled" in prep) return NextResponse.json({ ok: true, redirect: step.nextPath });
  if ("error" in prep) return jsonError(prep.error!, prep.status);
  const { session, offer, setup, profile, paymentId } = prep;
  const fail = async (message: string) => {
    await system(async (tx) => {
      await markPaymentFailed(tx, paymentId, message);
      await releaseStep(tx, session.id, stepId);
    });
    return jsonError(message, 402);
  };

  if (setup.provider === "test") {
    await system((tx) => markPaymentSucceeded(tx, paymentId, { test: true }));
    return NextResponse.json({ ok: true, redirect: step.nextPath });
  }

  const meta = { zfunnel_order_id: session.orderId!, zfunnel_workspace_id: g.ws.id, zfunnel_kind: "upsell" };
  try {
    if (offer.type === "one_time") {
      const r = await chargeOffSession(setup.accountId, {
        amount: offer.amount,
        currency: offer.currency,
        customerId: profile.customerId,
        paymentMethodId: profile.paymentMethodId!,
        description: offer.productName,
        metadata: meta,
        idempotencyKey: `upsell-${session.id}-${stepId}`,
      });
      await system((tx) =>
        tx
          .update(payments)
          .set({
            externalId: r.intentId ?? null,
            status: r.status === "requires_action" ? "requires_action" : "pending",
          })
          .where(eq(payments.id, paymentId)),
      );
      if (r.status === "failed") return fail(r.message);
      if (r.status === "requires_action")
        return NextResponse.json({
          requiresAction: true,
          clientSecret: r.clientSecret,
          paymentId,
          accountId: setup.accountId,
          publishableKey: setup.publishableKey,
        });
      await system((tx) => markPaymentSucceeded(tx, paymentId));
    } else {
      const stripePriceId = await ensureStripePrice(setup.accountId, {
        stripePriceId: offer.stripePriceId,
        productName: offer.productName,
        amount: offer.amount,
        currency: offer.currency,
        interval: offer.interval ?? "month",
        zfPriceId: offer.priceId,
      });
      const sub = await createSubscription(setup.accountId, {
        customerId: profile.customerId,
        stripePriceId,
        trialDays: offer.trialDays,
        extraPriceIds: [],
        paymentMethodId: profile.paymentMethodId!,
        metadata: meta,
        idempotencyKey: `upsell-${session.id}-${stepId}`,
      });
      if (sub.subscription.status !== "active" && sub.subscription.status !== "trialing")
        return fail("Your card was declined.");
      await system(async (tx) => {
        await tx.update(payments).set({ externalId: sub.subscription.id }).where(eq(payments.id, paymentId));
        await markPaymentSucceeded(tx, paymentId);
        await recordSubscription(tx, {
          workspaceId: g.ws.id,
          contactId: session.contactId!,
          priceId: offer.priceId,
          orderId: session.orderId!,
          provider: "stripe",
          externalId: sub.subscription.id,
          status: sub.subscription.status,
        });
      });
    }
  } catch (err) {
    console.error("[upsell]", err);
    return fail("Your card was declined. Please try another option.");
  }
  return NextResponse.json({ ok: true, redirect: step.nextPath });
}
