import {
  createPaymentIntent,
  createPendingOrder,
  createSubscription,
  ensureCustomer,
  ensureStripePrice,
  getPaymentSetup,
  getProfile,
  getStepOffers,
  getStoreOffer,
  saveProfile,
  system,
  upsertContact,
  type OfferView,
} from "@zfunnel/payments";
import { eq, orderItems, payments, prices } from "@zfunnel/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { affiliateForOrder } from "@/lib/affiliate";
import { jsonError, publicPost } from "@/lib/api";
import { resolveStepForWorkspace } from "@/lib/resolve";

const shippingSchema = z.object({
  name: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1, "Please enter your address.").max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1, "Please enter your city.").max(100),
  postalCode: z.string().trim().min(1, "Please enter your postal code.").max(20),
  region: z.string().trim().max(100).optional(),
  country: z.string().trim().min(2, "Please choose your country.").max(60),
});

const bodySchema = z.object({
  // Funnel checkout: a step and its offer. Store checkout: just a price.
  stepId: z.string().uuid().optional(),
  mainOfferId: z.string().uuid().optional(),
  storePriceId: z.string().uuid().optional(),
  shipping: shippingSchema.optional(),
  bumpOfferIds: z.array(z.string().uuid()).max(5).default([]),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(254),
  name: z.string().trim().min(1, "Please enter your name.").max(120),
});

/**
 * Step 1 of checkout: validates the cart against the step's real offers (never trusting
 * client prices), creates a pending order, and returns what the browser needs to pay.
 */
export async function POST(req: Request) {
  const g = await publicPost(req, "checkout");
  if ("error" in g) return g.error;
  const parsed = bodySchema.safeParse(g.body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid checkout.");
  const { stepId, mainOfferId, storePriceId, shipping, bumpOfferIds, email, name } = parsed.data;
  const store = Boolean(storePriceId);
  if (!store && (!stepId || !mainOfferId)) return jsonError("Invalid checkout.");
  const affCookie = (await cookies()).get("zf_aff")?.value;

  const step = store ? null : await resolveStepForWorkspace(g.ws.id, stepId!);
  if (!store && !step) return jsonError("This checkout is no longer available.", 404);

  try {
    // 1) Short transaction: validate the cart and create the pending order.
    const prep = await system(async (tx) => {
      const setup = await getPaymentSetup(tx, g.ws.id);
      if (!setup) return { error: "This store isn't accepting payments yet." } as const;
      let main: OfferView | undefined;
      let bumps: OfferView[] = [];
      if (store) {
        const offer = await getStoreOffer(tx, g.ws.id, storePriceId!);
        if (!offer) return { error: "Sorry, this product is sold out or no longer available." } as const;
        if (offer.requiresShipping && !shipping) return { error: "Please enter your shipping address." } as const;
        main = offer;
      } else {
        const offers = await getStepOffers(tx, stepId!);
        main = offers.find((o) => o.offerId === mainOfferId && o.role === "main");
        bumps = offers.filter((o) => o.role === "bump" && bumpOfferIds.includes(o.offerId));
      }
      if (!main) return { error: "Please choose a product." } as const;
      const cart: OfferView[] = [main, ...bumps];
      if (cart.some((o) => o.currency !== main.currency))
        return { error: "All products in one order must use the same currency." } as const;
      const contact = await upsertContact(tx, g.ws.id, {
        email,
        name,
        funnelId: step?.funnelId ?? null,
        stepId: stepId ?? null,
        ip: g.ip,
      });
      const affiliateId = await affiliateForOrder(tx, g.ws.id, affCookie, contact.id);
      const order = await createPendingOrder(tx, {
        workspaceId: g.ws.id,
        contactId: contact.id,
        funnelId: step?.funnelId ?? null,
        stepId: stepId ?? null,
        provider: setup.provider,
        test: setup.provider === "test" || !setup.livemode,
        items: cart,
        affiliateId,
        shipping: shipping ?? null,
      });
      const profile = setup.provider === "stripe" ? await getProfile(tx, contact.id, "stripe") : null;
      return { setup, main, bumps, cart, contact, order, profile } as const;
    });
    if ("error" in prep) return jsonError(prep.error ?? "Checkout failed.");
    const { setup, main, bumps, cart, contact, order, profile } = prep;
    const amountDueNow = cart.reduce((s, o) => s + (o.trialDays ? 0 : o.amount), 0);

    const attachPayment = (externalId: string, provider: "stripe" | "test", raw?: object) =>
      system(async (tx) => {
        const [p] = await tx
          .insert(payments)
          .values({
            workspaceId: g.ws.id,
            orderId: order.id,
            provider,
            externalId,
            kind: "checkout",
            amount: amountDueNow,
            currency: main.currency,
            raw,
          })
          .returning();
        await tx.update(orderItems).set({ paymentId: p!.id }).where(eq(orderItems.orderId, order.id));
      });

    if (setup.provider === "test") {
      await attachPayment(`test_${order.id}`, "test");
      return NextResponse.json({ orderId: order.id, provider: "test" });
    }

    // 2) Stripe calls happen outside any database transaction.
    const acct = setup.accountId;
    const customerId = await ensureCustomer(acct, {
      customerId: profile?.customerId,
      email,
      name,
      contactId: contact.id,
    });
    if (customerId !== profile?.customerId)
      await system((tx) =>
        saveProfile(tx, { workspaceId: g.ws.id, contactId: contact.id, provider: "stripe", customerId }),
      );
    const metadata = { zfunnel_order_id: order.id, zfunnel_workspace_id: g.ws.id };

    if (main.type === "one_time") {
      const pi = await createPaymentIntent(acct, {
        amount: amountDueNow,
        currency: main.currency,
        customerId,
        description: `Order #${order.number}: ${cart.map((c) => c.productName).join(", ")}`,
        metadata,
        idempotencyKey: `order-${order.id}`,
      });
      await attachPayment(pi.id, "stripe");
      return NextResponse.json({
        orderId: order.id,
        provider: "stripe",
        clientSecret: pi.client_secret,
        secretType: "payment",
      });
    }

    // Subscription or payment plan: bumps ride along on the first invoice.
    const priceIdFor = async (o: OfferView, interval: "month" | "year" | null) => {
      const id = await ensureStripePrice(acct, {
        stripePriceId: o.stripePriceId,
        productName: o.productName,
        amount: o.amount,
        currency: o.currency,
        interval,
        zfPriceId: o.priceId,
      });
      if (!o.stripePriceId)
        await system((tx) => tx.update(prices).set({ stripePriceId: id }).where(eq(prices.id, o.priceId)));
      return id;
    };
    const mainPrice = await priceIdFor(main, main.interval ?? "month");
    const extraPriceIds = await Promise.all(bumps.map((b) => priceIdFor(b, null)));
    const cancelAt =
      main.type === "payment_plan" && main.installments
        ? Math.floor(Date.now() / 1000) +
          Math.round(main.installments * (main.interval === "year" ? 365 : 30.44) * 86400) -
          3600
        : undefined;
    const sub = await createSubscription(acct, {
      customerId,
      stripePriceId: mainPrice,
      trialDays: main.trialDays,
      extraPriceIds,
      metadata,
      idempotencyKey: `order-${order.id}`,
      cancelAt,
    });
    const invoiceId =
      typeof sub.subscription.latest_invoice === "string"
        ? sub.subscription.latest_invoice
        : sub.subscription.latest_invoice?.id;
    await attachPayment(sub.subscription.id, "stripe", { invoiceId, priceId: main.priceId });
    return NextResponse.json({
      orderId: order.id,
      provider: "stripe",
      clientSecret: sub.clientSecret,
      secretType: sub.secretType,
    });
  } catch (err) {
    console.error("[checkout/start]", err);
    return jsonError("We couldn't start your payment. Please try again.", 502);
  }
}
